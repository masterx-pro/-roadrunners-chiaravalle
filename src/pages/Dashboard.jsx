import { useState, useEffect } from 'react'
import { getAtleti, getPattini, getEventiSpeciali, leggiSheet } from '../utils/sheetsApi'
import { SHEETS } from '../config/google'
import { calcolaAlert, formattaData } from '../utils/dateUtils'

export default function Dashboard({ nav }) {
  const [atleti, setAtleti] = useState([])
  const [pattini, setPattini] = useState([])
  const [eventi, setEventi] = useState([])
  const [pagamenti, setPagamenti] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carica() {
      try {
        const [a, p, e, pag] = await Promise.all([
          getAtleti(), getPattini(), getEventiSpeciali(), leggiSheet(SHEETS.PAGAMENTI)
        ])
        setAtleti(a)
        setPattini(p)
        setEventi(e)
        setPagamenti(pag)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  const atletiAttivi = atleti.filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
  const pattiniNoleggiati = pattini.filter(p => p.ID_Atleta)
  const pattiniLiberi = pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto')
  const alerts = calcolaAlert(atletiAttivi, pattini, eventi)
  const noleggiDaPagare = pagamenti.filter(p => p.Tipo === 'Noleggio' && p.Stato !== 'Pagato')

  // Prossimo evento
  const oggi = new Date()
  const prossimoEvento = eventi
    .filter(e => new Date(e.Data_Inizio || e.Data) >= oggi)
    .sort((a, b) => new Date(a.Data_Inizio || a.Data) - new Date(b.Data_Inizio || b.Data))[0]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: '24px' }}>🛼</span>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => nav.navigaA('atleti', { tipoVista: 'Agonista' })} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{atletiAttivi.filter(a => (a.Tipo_Atleta || 'Agonista') === 'Agonista').length}</div>
          <div className="stat-label">🏅 Agonisti</div>
        </div>
        <div className="stat-card" onClick={() => nav.navigaA('atleti', { tipoVista: 'Non agonista' })} style={{ cursor: 'pointer' }}>
          <div className="stat-value">{atletiAttivi.filter(a => a.Tipo_Atleta === 'Non agonista').length}</div>
          <div className="stat-label">🎿 Non agonisti</div>
        </div>
        <div className="stat-card" onClick={() => nav.navigaA('attrezzature', { filtro: 'liberi' })} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: pattiniLiberi.length === 0 ? 'var(--accent)' : 'var(--accent-ok)' }}>
            {pattiniLiberi.length}
          </div>
          <div className="stat-label">Pattini liberi</div>
        </div>
        <div className="stat-card" onClick={() => nav.navigaA('attrezzature', { filtro: 'noleggiati' })} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{pattiniNoleggiati.length}</div>
          <div className="stat-label">In noleggio</div>
        </div>
        <div className="stat-card" onClick={() => nav.navigaA('atleti', { filtro: 'noleggio_da_pagare' })} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: noleggiDaPagare.length > 0 ? 'var(--accent-warn)' : 'var(--accent-ok)' }}>
            {noleggiDaPagare.length}
          </div>
          <div className="stat-label">Noleggio da riscuotere</div>
        </div>
      </div>

      {/* QUOTE ASSOCIATIVE */}
      {(() => {
        const quoteAssociative = pagamenti.filter(p => p.Tipo === 'Quota')
        const quotePagate = quoteAssociative.filter(p => p.Stato === 'Pagato')
        const quoteDaPagare = quoteAssociative.filter(p => p.Stato !== 'Pagato')
        const totaleQuoteDovuto = quoteAssociative.reduce((sum, p) => sum + (parseFloat(p.Importo) || 0), 0)
        const totaleQuotePagato = quotePagate.reduce((sum, p) => sum + (parseFloat(p.Importo) || 0), 0)

        if (quoteAssociative.length === 0) return null

        return (
          <div className="card" style={{ marginBottom: '16px', cursor: 'pointer' }}
            onClick={() => nav.navigaA('atleti', {})}
          >
            <div className="section-title" style={{ margin: '0 0 12px 0' }}>💳 Quote associative</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--accent-ok)' }}>
                    {quotePagate.length}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Pagate</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: quoteDaPagare.length > 0 ? 'var(--accent-warn)' : 'var(--accent-ok)' }}>
                    {quoteDaPagare.length}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Da pagare</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700' }}>
                  €{totaleQuotePagato}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  su €{totaleQuoteDovuto}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* PROSSIMO EVENTO */}
      {prossimoEvento && (
        <div className="card" style={{ marginBottom: '16px', cursor: 'pointer' }}
          onClick={() => nav.navigaA('calendario', { evento: prossimoEvento.ID_Evento })}
        >
          <div className="section-title">Prossimo evento</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{prossimoEvento.Titolo}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                {formattaData(prossimoEvento.Data_Inizio || prossimoEvento.Data)}
                {prossimoEvento.Luogo && ` — ${prossimoEvento.Luogo}`}
              </div>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>›</span>
          </div>
        </div>
      )}

      {/* ALERT SCADENZE */}
      {alerts.length > 0 ? (
        <div className="card">
          <div className="section-title">⚠️ Scadenze prossime 90 giorni</div>
          {alerts.map((a, i) => (
            <AlertRow key={i} alert={a} onClick={(alert) => {
              nav.navigaA('atleti', { atletaId: alert.idAtleta, sottoVista: 'scadenze' })
            }} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span>
            <span style={{ color: 'var(--accent-ok)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nessuna scadenza urgente
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertRow({ alert, onClick }) {
  const isScaduto = alert.stato === 'scaduto'
  const isUrgente = alert.stato === 'urgente'
  const isMancante = alert.stato === 'mancante'
  const label = alert.tipo === 'certificato' ? 'Cert. medico' : 'Tessera FISR'

  let badgeClass = 'badge-warn'
  let testoGiorni = `${alert.giorni} giorni`
  if (isUrgente) { badgeClass = 'badge-urgente'; testoGiorni = `${alert.giorni}gg` }
  if (isScaduto) { badgeClass = 'badge-danger'; testoGiorni = `Scaduto ${Math.abs(alert.giorni)}gg fa` }
  if (isMancante) { badgeClass = 'badge-danger'; testoGiorni = 'Mancante' }

  return (
    <div className="atleta-row" style={{ cursor: 'pointer' }} onClick={() => onClick?.(alert)}>
      <div className="atleta-avatar">
        {alert.atleta.split(' ').map(p => p[0]).join('').slice(0, 2)}
      </div>
      <div className="atleta-info">
        <div className="atleta-nome">{alert.atleta}</div>
        <div className="atleta-sub">{label} {!isMancante && `— ${formattaData(alert.data)}`}</div>
      </div>
      {alert.telefono && (
        <a
          href={`https://wa.me/39${alert.telefono.replace(/[\s\-\+\(\)]/g, '')}?text=${encodeURIComponent(
            `Buongiorno, le ricordiamo che ${label.toLowerCase()} di ${alert.atleta} ${
              alert.stato === 'mancante' ? 'non risulta presente' :
              alert.stato === 'scaduto' ? 'risulta scaduto' :
              `scade tra ${alert.giorni} giorni`
            }. La preghiamo di provvedere.`
          )}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '18px', textDecoration: 'none', padding: '4px 8px', flexShrink: 0 }}
        >
          📱
        </a>
      )}
      <span className={`badge ${badgeClass}`}>{testoGiorni}</span>
    </div>
  )
}
