import { useState, useEffect } from 'react'
import { getAtleti, getPattini, getEventiSpeciali } from '../utils/sheetsApi'
import { calcolaAlert, formattaData, trimestreCorrente, scadenzaTrimestreCorrente, pattiniDaPagare } from '../utils/dateUtils'

export default function Dashboard() {
  const [atleti, setAtleti] = useState([])
  const [pattini, setPattini] = useState([])
  const [eventi, setEventi] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carica() {
      try {
        const [a, p, e] = await Promise.all([getAtleti(), getPattini(), getEventiSpeciali()])
        setAtleti(a)
        setPattini(p)
        setEventi(e)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  const atletiAttivi = atleti.filter(a => a.Attivo === 'TRUE')
  const pattiniNoleggiati = pattini.filter(p => p.ID_Atleta)
  const pattiniLiberi = pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto')
  const alerts = calcolaAlert(atletiAttivi, pattini)
  const daPagare = pattiniDaPagare(pattini)
  const trimestre = trimestreCorrente()
  const scadenzaTrimestre = scadenzaTrimestreCorrente()

  // Prossimo evento e alert gare
  const oggi = new Date()
  const prossimoEvento = eventi
    .filter(e => new Date(e.Data) >= oggi)
    .sort((a, b) => new Date(a.Data) - new Date(b.Data))[0]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: '24px' }}>🛼</span>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{atletiAttivi.length}</div>
          <div className="stat-label">Atleti attivi</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: pattiniLiberi.length === 0 ? 'var(--accent)' : 'var(--accent-ok)' }}>
            {pattiniLiberi.length}
          </div>
          <div className="stat-label">Pattini liberi</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{pattiniNoleggiati.length}</div>
          <div className="stat-label">In noleggio</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: daPagare.length > 0 ? 'var(--accent-warn)' : 'var(--accent-ok)' }}>
            {daPagare.length}
          </div>
          <div className="stat-label">Da riscuotere</div>
        </div>
      </div>

      {/* PROSSIMO EVENTO */}
      {prossimoEvento && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-title">Prossimo evento</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{prossimoEvento.Titolo}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                {formattaData(prossimoEvento.Data)}
                {prossimoEvento.Luogo && ` — ${prossimoEvento.Luogo}`}
              </div>
            </div>
            <span className={`badge badge-${prossimoEvento.Tipo === 'Gara' ? 'danger' : 'muted'}`}>
              {prossimoEvento.Tipo}
            </span>
          </div>
        </div>
      )}

      {/* ALERT NOLEGGIO */}
      {trimestre && daPagare.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span>💰</span>
            <div className="section-title" style={{ margin: 0 }}>Noleggio — {trimestre.label}</div>
          </div>
          <div style={{ color: 'var(--accent-warn)', fontWeight: '600' }}>
            {daPagare.length} atleti da riscuotere
          </div>
          {scadenzaTrimestre && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Scadenza trimestre: {formattaData(scadenzaTrimestre)}
            </div>
          )}
        </div>
      )}

      {/* ALERT SCADENZE */}
      {alerts.length > 0 ? (
        <div className="card">
          <div className="section-title">⚠️ Scadenze prossime 30 giorni</div>
          {alerts.map((a, i) => (
            <AlertRow key={i} alert={a} />
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

function AlertRow({ alert }) {
  const isScaduto = alert.stato === 'scaduto'
  const isMancante = alert.stato === 'mancante'
  const label = alert.tipo === 'certificato' ? 'Cert. medico' : 'Tessera FISR'

  let badgeClass = 'badge-warn'
  let testoGiorni = `${alert.giorni} giorni`
  if (isScaduto) { badgeClass = 'badge-danger'; testoGiorni = `Scaduto ${Math.abs(alert.giorni)}gg fa` }
  if (isMancante) { badgeClass = 'badge-danger'; testoGiorni = 'Mancante' }

  return (
    <div className="atleta-row" style={{ cursor: 'default' }}>
      <div className="atleta-avatar">
        {alert.atleta.split(' ').map(p => p[0]).join('').slice(0, 2)}
      </div>
      <div className="atleta-info">
        <div className="atleta-nome">{alert.atleta}</div>
        <div className="atleta-sub">{label} {!isMancante && `— ${formattaData(alert.data)}`}</div>
      </div>
      <span className={`badge ${badgeClass}`}>{testoGiorni}</span>
    </div>
  )
}
