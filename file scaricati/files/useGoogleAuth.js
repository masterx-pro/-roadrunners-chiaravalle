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
          return
        }

        sessionStorage.setItem('gapi_token', response.access_token)
        sessionStorage.setItem('gapi_token_expiry', Date.now() + response.expires_in * 1000)

        try {
          const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
          })
          const userInfo = await userRes.json()
          const email = userInfo.email

          const { verificaUtente } = await import('../utils/sheetsApi')
          const utenteAutorizzato = await verificaUtente(email)

          if (!utenteAutorizzato) {
            window.google.accounts.oauth2.revoke(response.access_token)
            sessionStorage.removeItem('gapi_token')
            sessionStorage.removeItem('gapi_token_expiry')
            setErrore('non_autorizzato')
            setLoading(false)
            return
          }

          setUser({
            email,
            nome: utenteAutorizzato.Nome || userInfo.name,
            ruolo: utenteAutorizzato.Ruolo || 'Dirigente'
          })
          setIsSignedIn(true)
          setErrore(null)
        } catch (err) {
          console.error('Errore verifica utente:', err)
          setErrore('errore_verifica')
        } finally {
          setLoading(false)
        }
      }
    })
    setTokenClient(client)

    const token = sessionStorage.getItem('gapi_token')
    const expiry = sessionStorage.getItem('gapi_token_expiry')
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
    const token = sessionStorage.getItem('gapi_token')
    if (token) window.google.accounts.oauth2.revoke(token)
    sessionStorage.removeItem('gapi_token')
    sessionStorage.removeItem('gapi_token_expiry')
    setIsSignedIn(false)
    setUser(null)
  }, [])

  const getToken = useCallback(() => sessionStorage.getItem('gapi_token'), [])

  return { isSignedIn, user, loading, errore, signIn, signOut, getToken }
}
