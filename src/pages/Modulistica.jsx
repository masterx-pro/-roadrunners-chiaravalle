import { useState, useEffect } from 'react'
import { getModulistica } from '../utils/sheetsApi'

export default function Modulistica() {
  const [moduli, setModuli] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getModulistica().then(m => { setModuli(m); setLoading(false) })
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  const moduliAttivi = moduli.filter(m => m.Attivo === 'TRUE')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Modulistica</h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
        Scarica i moduli da stampare e consegnare ad atleti e famiglie.
      </p>

      <div className="card">
        {moduliAttivi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">Nessun modulo disponibile</div>
          </div>
        ) : (
          moduliAttivi.map(m => (
            <a
              key={m.ID_Modulo}
              href={`https://drive.google.com/file/d/${m.Drive_File_ID}/view`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 0', borderBottom: '1px solid var(--border)'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-soft)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '22px', flexShrink: 0
                }}>
                  📄
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>
                    {m.Nome}
                  </div>
                  {m.Descrizione && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                      {m.Descrizione}
                    </div>
                  )}
                  {m.Stagione && (
                    <span className="badge badge-muted" style={{ marginTop: '6px' }}>{m.Stagione}</span>
                  )}
                </div>
                <span style={{ color: 'var(--accent)', fontSize: '13px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                  Apri →
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
