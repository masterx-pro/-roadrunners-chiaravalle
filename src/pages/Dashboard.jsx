import { useState, useEffect } from 'react'
import { getAtleti, getPattini, getEventiSpeciali, resetPagamentiNoleggio } from '../utils/sheetsApi'
import { calcolaAlert, formattaData, trimestreCorrente, scadenzaTrimestreCorrente, pattiniDaPagare } from '../utils/dateUtils'

export default function Dashboard() {
  const [atleti, setAtleti] = useState([])
  const [pattini, setPattini] = useState([])
  const [eventi, setEventi] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostraResetTrimestre, setMostraResetTrimestre] = useState(false)
  const [resetInCorso, setResetInCorso] = useState(false)
  const [trimestreNuovo, setTrimestreNuovo] = useState(null)

  useEffect(() => {
    async function carica() {
      try {
        const [a, p, e] = await Promise.all([getAtleti(), getPattini(), getEventiSpeciali()])
        setAtleti(a)
        setPattini(p)
        setEventi(e)

        // Controlla cambio trimestre
        const trim = trimestreCorrente()
        if (trim) {
          const anno = new Date().getFullYear()
          const chiaveTrimestre = `${trim.id}-${anno}`
          const ultimoTrimestre = localStorage.getItem('ultimo_trimestre')
          if (ultimoTrimestre && ultimoTrimestre !== chiaveTrimestre) {
            setTrimestreNuovo({ chiave: chiaveTrimestre, label: trim.label })
            setMostraResetTrimestre(true)
          } else if (!ultimoTrimestre) {
            localStorage.setItem('ultimo_trimestre', chiaveTrimestre)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    carica()
  }, [])

  async function confermaReset() {
    setResetInCorso(true)
    try {
      await resetPagamentiNoleggio(pattini)
      localStorage.setItem('ultimo_trimestre', trimestreNuovo.chiave)
      // Ricarica pattini aggiornati
      const p = await getPattini()
      setPattini(p)
      setMostraResetTrimestre(false)
    } catch (err) {
      console.error('Errore reset:', err)
    } finally {
      setResetInCorso(false)
    }
  }

  function annullaReset() {
    localStorage.setItem('ultimo_trimestre', trimestreNuovo.chiave)
    setMostraResetTrimestre(false)
  }

  if (loading) return <div className="loading-center">Caricamento...</div>

  const atletiAttivi = atleti.filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
  const pattiniNoleggiati = pattini.filter(p => p.ID_Atleta)
  const pattiniLiberi = pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto')
  const alerts = calcolaAlert(atletiAttivi, pattini, eventi)
  const daPagare = pattiniDaPagare(pattini)
  const trimestre = trimestreCorrente()
  const scadenzaTrimestre = scadenzaTrimestreCorrente()

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

      {/* BANNER RESET TRIMESTRE */}
      {mostraResetTrimestre && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.5)', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
            Nuovo trimestre
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
            {trimestreNuovo?.label}
          </div>
          <div style={{ color: 'var(--accent-warn)', fontSize: '14px', marginBottom: '16px' }}>
            I pagamenti noleggio verranno azzerati a "Da pagare".
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={annullaReset} disabled={resetInCorso} style={{ flex: 1 }}>
              Annulla
            </button>
            <button className="btn btn-primary" onClick={confermaReset} disabled={resetInCorso} style={{ flex: 1 }}>
              {resetInCorso ? 'Reset...' : 'Conferma reset'}
            </button>
          </div>
        </div>
      )}

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
                {formattaData(prossimoEvento.Data_Inizio || prossimoEvento.Data)}
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

      {/* DOCUMENTI UTILI */}
      <div className="section-title">Documenti utili</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <a
          href="https://drive.google.com/file/d/1L2bEyGIqyYWRGTBD3XV6HtRAPCkk9YzE/view"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 0', textDecoration: 'none'
          }}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-soft)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '22px', flexShrink: 0
          }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>
              Regolamento Tecnico Corsa
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
              Stagione 2025/2026 — Skate Italia
            </div>
          </div>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '13px' }}>
            Apri →
          </span>
        </a>
      </div>

      {/* ALERT SCADENZE */}
      {alerts.length > 0 ? (
        <div className="card">
          <div className="section-title">⚠️ Scadenze prossime 90 giorni</div>
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
  const isUrgente = alert.stato === 'urgente'
  const isMancante = alert.stato === 'mancante'
  const label = alert.tipo === 'certificato' ? 'Cert. medico' : 'Tessera FISR'

  let badgeClass = 'badge-warn'
  let testoGiorni = `${alert.giorni} giorni`
  if (isUrgente) { badgeClass = 'badge-urgente'; testoGiorni = `${alert.giorni}gg` }
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
