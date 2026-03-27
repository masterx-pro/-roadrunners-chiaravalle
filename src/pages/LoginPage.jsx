export default function LoginPage({ onSignIn, errore }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      background: 'var(--bg)',
      gap: '24px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Logo" width="140px" style={{ marginBottom: '16px' }} />
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--text-primary)'
        }}>
          A.S.D. Road Runners
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
          Chiaravalle
        </p>
      </div>

      {/* ERRORE ACCESSO NEGATO */}
      {errore === 'non_autorizzato' && (
        <div style={{
          background: 'rgba(232,51,74,0.15)',
          border: '1px solid rgba(232,51,74,0.4)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          textAlign: 'center',
          maxWidth: '320px'
        }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>🚫</div>
          <div style={{ fontFamily: 'var(--font-display)', color: '#FF6B7A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Accesso non autorizzato
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            Il tuo account non è abilitato. Contatta il responsabile della società.
          </div>
        </div>
      )}

      {errore === 'errore_verifica' && (
        <div style={{
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          textAlign: 'center',
          maxWidth: '320px'
        }}>
          <div style={{ color: 'var(--accent-warn)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
            Errore di connessione
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            Impossibile verificare le credenziali. Riprova.
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-full" onClick={onSignIn} style={{ maxWidth: '280px' }}>
        <GoogleIcon />
        Accedi con Google
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
