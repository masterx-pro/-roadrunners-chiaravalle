import { useState, useEffect } from 'react'
import { getPattini, getAtleti, leggiSheet, aggiornaRiga } from '../utils/sheetsApi'
import { formattaData } from '../utils/dateUtils'
import { SHEETS } from '../config/google'

export default function Attrezzature() {
  const [tab, setTab] = useState('pattini')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attrezzature</h1>
      </div>

      {/* TAB SELECTOR */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn ${tab === 'pattini' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('pattini')}
          style={{ flex: 1 }}
        >
          🛼 Pattini
        </button>
        <button
          className={`btn ${tab === 'ruote' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('ruote')}
          style={{ flex: 1 }}
        >
          ⚙️ Ruote
        </button>
      </div>

      {tab === 'pattini' && <PattiniView />}
      {tab === 'ruote'   && <RuoteView />}
    </div>
  )
}

// ============================================================
// PATTINI
// ============================================================

function PattiniView() {
  const [pattini, setPattini] = useState([])
  const [atleti, setAtleti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('tutti') // tutti | liberi | noleggiati | rotti

  useEffect(() => {
    async function carica() {
      const [p, a] = await Promise.all([getPattini(), getAtleti()])
      setPattini(p)
      setAtleti(a)
      setLoading(false)
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  const pattiniFiltrati = pattini.filter(p => {
    if (filtro === 'liberi')     return !p.ID_Atleta && p.Stato !== 'Rotto'
    if (filtro === 'noleggiati') return !!p.ID_Atleta
    if (filtro === 'rotti')      return p.Stato === 'Rotto'
    return true
  })

  const nomeAtleta = (id) => {
    const a = atleti.find(a => a.ID_Atleta === id)
    return a ? `${a.Nome} ${a.Cognome}` : id
  }

  async function togglePagamento(pattino, idx) {
    const nuovoStato = pattino.Stato_Pagamento === 'Pagato' ? 'Da pagare' : 'Pagato'
    const valori = [
      pattino.ID_Pattino, pattino.Numero_Identificativo, pattino.Taglia,
      pattino.Stato, pattino.ID_Atleta, pattino.Data_Inizio_Noleggio,
      nuovoStato, pattino.Note
    ]
    await aggiornaRiga(SHEETS.PATTINI, idx, valori)
    setPattini(prev => prev.map((p, i) =>
      p.ID_Pattino === pattino.ID_Pattino ? { ...p, Stato_Pagamento: nuovoStato } : p
    ))
  }

  return (
    <>
      {/* STATS RAPIDE */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['tutti', 'liberi', 'noleggiati', 'rotti'].map(f => (
          <button
            key={f}
            className={`btn ${filtro === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltro(f)}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}
            <span style={{ opacity: 0.7 }}>
              ({f === 'tutti' ? pattini.length
                : f === 'liberi' ? pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto').length
                : f === 'noleggiati' ? pattini.filter(p => p.ID_Atleta).length
                : pattini.filter(p => p.Stato === 'Rotto').length})
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {pattiniFiltrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛼</div>
            <div className="empty-state-text">Nessun pattino</div>
          </div>
        ) : (
          pattiniFiltrati.map((p, i) => (
            <div key={p.ID_Pattino} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: '700',
                fontSize: '14px', flexShrink: 0
              }}>
                {p.Taglia}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '15px' }}>{p.Numero_Identificativo}</div>
                {p.ID_Atleta ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {nomeAtleta(p.ID_Atleta)} · dal {formattaData(p.Data_Inizio_Noleggio)}
                  </div>
                ) : (
                  <div style={{ color: 'var(--accent-ok)', fontSize: '13px' }}>Disponibile</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span className={`badge ${
                  p.Stato === 'Rotto' ? 'badge-danger' :
                  p.Stato === 'Usurato' ? 'badge-warn' : 'badge-ok'
                }`}>{p.Stato}</span>
                {p.ID_Atleta && (
                  <button
                    className={`badge ${p.Stato_Pagamento === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}
                    style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                    onClick={() => togglePagamento(p, i)}
                  >
                    {p.Stato_Pagamento}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ============================================================
// RUOTE — MAGAZZINO
// ============================================================

function RuoteView() {
  const [ruote, setRuote] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    leggiSheet(SHEETS.RUOTE).then(r => { setRuote(r); setLoading(false) })
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  return (
    <div className="card">
      {ruote.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚙️</div>
          <div className="empty-state-text">Magazzino vuoto</div>
        </div>
      ) : (
        ruote.map(r => (
          <div key={r.ID_Set} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 0', borderBottom: '1px solid var(--border)'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '20px', flexShrink: 0
            }}>⚙️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>
                {r.Diametro_mm}mm · {r.Durezza_A}A
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Quantità: {r.Quantita} · {r.Note}
              </div>
            </div>
            <span className={`badge ${
              r.Stato === 'Da sostituire' ? 'badge-danger' :
              r.Stato === 'Usurate' ? 'badge-warn' : 'badge-ok'
            }`}>{r.Stato}</span>
          </div>
        ))
      )}
    </div>
  )
}
