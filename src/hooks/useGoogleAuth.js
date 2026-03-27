import { useState, useEffect, useCallback } from 'react'
import { GOOGLE_CONFIG } from '../config/google'

export function useGoogleAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState(null)
  const [tokenClient, setTokenClient] = useState(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogleAuth
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  const initGoogleAuth = useCallback(() => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.CLIENT_ID,
      scope: GOOGLE_CONFIG.SCOPES,
      callback: async (response) => {
        if (response.error) {
          console.error('Auth error:', response.error)
          setLoading(false)
          return
        }

        const accessToken = response.access_token

        // Salva token
        localStorage.setItem('gapi_token', accessToken)
        localStorage.setItem('gapi_token_expiry', Date.now() + response.expires_in * 1000)

        try {
          // Recupera email usando il token appena ricevuto (non da localStorage)
          const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          })

          if (!userRes.ok) throw new Error('Errore userinfo: ' + userRes.status)

          const userInfo = await userRes.json()
          const email = userInfo.email
          console.log('Email:', email)

          // Verifica su foglio Utenti
          const { verificaUtente } = await import('../utils/sheetsApi')
          const utenteAutorizzato = await verificaUtente(email)
          console.log('Utente autorizzato:', utenteAutorizzato)

          if (!utenteAutorizzato) {
            window.google.accounts.oauth2.revoke(accessToken)
            localStorage.removeItem('gapi_token')
            localStorage.removeItem('gapi_token_expiry')
            setErrore('non_autorizzato')
            setLoading(false)
            return
          }

          setUser({
            email,
            nome: utenteAutorizzato.Nome || userInfo.name,
            ruolo: utenteAutorizzato.Ruolo || 'Dirigente'
          })
          localStorage.setItem('user_email', email)
          localStorage.setItem('user_nome', utenteAutorizzato.Nome || userInfo.name || email)
          setIsSignedIn(true)
          setErrore(null)
        } catch (err) {
          console.error('Errore verifica:', err)
          setErrore('errore_verifica')
        } finally {
          setLoading(false)
        }
      }
    })
    setTokenClient(client)

    const token = localStorage.getItem('gapi_token')
    const expiry = localStorage.getItem('gapi_token_expiry')
    if (token && expiry && Date.now() < parseInt(expiry)) {
      setIsSignedIn(true)
    }
    setLoading(false)
  }, [])

  const signIn = useCallback(() => {
    setErrore(null)
    if (tokenClient) tokenClient.requestAccessToken()
  }, [tokenClient])

  const signOut = useCallback(() => {
    const token = localStorage.getItem('gapi_token')
    if (token) window.google.accounts.oauth2.revoke(token)
    localStorage.removeItem('gapi_token')
    localStorage.removeItem('gapi_token_expiry')
    setIsSignedIn(false)
    setUser(null)
  }, [])

  const getToken = useCallback(() => localStorage.getItem('gapi_token'), [])

  return { isSignedIn, user, loading, errore, signIn, signOut, getToken }
}
