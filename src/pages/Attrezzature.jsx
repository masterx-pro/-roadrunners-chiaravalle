import { useState, useEffect } from 'react'
import { getPattini, getAtleti, getCategorie, creaPattino, aggiornaPattino, assegnaPattino, restituisciPattino, getRuote, creaSetRuote, aggiornaSetRuote, eliminaSetRuote, aggiornaRiga, aggiornaNumeroGara, scriviLog, getStoricoPattinoById, leggiSheet, aggiornaPagamento, calcolaDisponibilitaRuote, assegnaRuote, getAssegnazioniRuote, rimuoviAssegnazioneRuote } from '../utils/sheetsApi'
import { formattaData } from '../utils/dateUtils'
import { SHEETS } from '../config/google'
import { esportaPattiniExcel, esportaRuoteExcel } from '../utils/exportUtils'

const isAttivo = v => ['TRUE', 'true', 'True'].includes(v?.trim())

export default function Attrezzature({ nav }) {
  const [tab, setTab] = useState(() => {
    const stato = nav.stato
    if (stato.tab === 'attrezzature' && stato.vista === 'ruote_assegnate') return 'ruote_assegnate'
    return 'pattini'
  })

  if (tab === 'ruote_assegnate') {
    return <RuoteAssegnatePanel nav={nav} onBack={() => { setTab('ruote'); nav.indietro() }} />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attrezzature</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className={`btn ${tab === 'pattini' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pattini')} style={{ flex: 1 }}>
          🛼 Pattini
        </button>
        <button className={`btn ${tab === 'ruote' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('ruote')} style={{ flex: 1 }}>
          ⚙️ Ruote
        </button>
        <button className={`btn ${tab === 'numeri' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('numeri')} style={{ flex: 1 }}>
          🔢 Numeri
        </button>
      </div>

      {tab === 'pattini' && <PattiniView nav={nav} />}
      {tab === 'ruote' && <RuoteView nav={nav} />}
      {tab === 'numeri' && <NumeriView />}
    </div>
  )
}

// ============================================================
// PATTINI
// ============================================================

function PattiniView({ nav }) {
  const [pattini, setPattini] = useState([])
  const [atleti, setAtleti] = useState([])
  const [pagamenti, setPagamenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState(() => {
    const stato = nav.stato
    return (stato.tab === 'attrezzature' && stato.filtro) || 'tutti'
  })
  const [vista, setVista] = useState('lista')
  const [selezionato, setSelezionato] = useState(null)
  const [selIdx, setSelIdx] = useState(null)

  function navigaVista(nuovaVista) {
    nav.avanti({ tab: 'attrezzature', vista: nuovaVista })
    setVista(nuovaVista)
  }

  useEffect(() => {
    const stato = nav.stato
    if (stato.tab === 'attrezzature' && !stato.vista) {
      setVista('lista')
      setSelezionato(null)
    }
  }, [nav.stato])

  function ricarica() {
    setLoading(true)
    Promise.all([getPattini(), getAtleti(), leggiSheet(SHEETS.PAGAMENTI)]).then(([p, a, pag]) => {
      setPattini(p); setAtleti(a); setPagamenti(pag); setLoading(false)
    })
  }

  function getStatoPagamentoPattino(pattino) {
    if (!pattino.ID_Atleta) return null
    const pagNoleggio = pagamenti.filter(p =>
      p.ID_Atleta === pattino.ID_Atleta &&
      p.Tipo === 'Noleggio' &&
      p.Stato !== 'Pagato'
    )
    return pagNoleggio.length > 0 ? 'Da pagare' : 'Pagato'
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (vista === 'nuovo') {
    return <NuovoPattino onBack={() => nav.indietro()} onSaved={() => { setVista('lista'); ricarica() }} />
  }

  if (vista === 'dettaglio' && selezionato) {
    return <DettaglioPattino
      pattino={selezionato}
      idx={selIdx}
      atleti={atleti}
      pagamenti={pagamenti}
      onBack={() => nav.indietro()}
      onSaved={() => { setVista('lista'); setSelezionato(null); ricarica() }}
    />
  }

  const nomeAtleta = (id) => {
    const a = atleti.find(at => at.ID_Atleta === id)
    return a ? `${a.Nome} ${a.Cognome}` : id
  }

  const pattiniFiltrati = pattini.filter(p => {
    if (filtro === 'liberi') return !p.ID_Atleta && p.Stato !== 'Rotto'
    if (filtro === 'noleggiati') return !!p.ID_Atleta
    if (filtro === 'rotti') return p.Stato === 'Rotto'
    return true
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button className="btn btn-ghost" onClick={() => esportaPattiniExcel(pattini, atleti)} style={{ padding: '6px 12px', fontSize: '13px' }}>📥 Excel</button>
        <button className="btn btn-primary" onClick={() => navigaVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>+</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['tutti', 'liberi', 'noleggiati', 'rotti'].map(f => {
          const labels = { tutti: 'Tutti', liberi: 'Liberi', noleggiati: 'Noleggiati', rotti: 'Rotti' }
          const counts = {
            tutti: pattini.length,
            liberi: pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto').length,
            noleggiati: pattini.filter(p => p.ID_Atleta).length,
            rotti: pattini.filter(p => p.Stato === 'Rotto').length
          }
          return (
            <button key={f} className={`btn ${filtro === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(f)} style={{ fontSize: '13px', padding: '6px 12px' }}>
              {labels[f]}{' '}
              <span style={{ opacity: 0.7 }}>({counts[f]})</span>
            </button>
          )
        })}
      </div>

      <div className="card">
        {pattiniFiltrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛼</div>
            <div className="empty-state-text">Nessun pattino</div>
          </div>
        ) : (
          pattiniFiltrati.map(p => {
            const realIdx = pattini.findIndex(pp => pp.ID_Pattino === p.ID_Pattino)
            return (
              <div key={p.ID_Pattino} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => { setSelezionato(p); setSelIdx(realIdx); navigaVista('dettaglio') }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                  {p.Taglia}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{p.Marca || p.ID_Pattino}</div>
                  {p.ID_Atleta ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {nomeAtleta(p.ID_Atleta)} · dal {formattaData(p.Data_Inizio_Noleggio)}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--accent-ok)', fontSize: '13px' }}>Disponibile</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className={`badge ${p.Stato === 'Rotto' ? 'badge-danger' : p.Stato === 'Usurato' ? 'badge-warn' : 'badge-ok'}`}>{p.Stato}</span>
                  {p.ID_Atleta && (() => {
                    const statoPag = getStatoPagamentoPattino(p)
                    return statoPag && (
                      <span className={`badge ${statoPag === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}>{statoPag}</span>
                    )
                  })()}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

// ============================================================
// NUOVO PATTINO
// ============================================================

function NuovoPattino({ onBack, onSaved }) {
  const [marca, setMarca] = useState('')
  const [taglia, setTaglia] = useState('')
  const [stato, setStato] = useState('Buono')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSalva() {
    if (!taglia) return
    setSaving(true)
    try {
      await creaPattino({ marca, taglia, stato, note })
      await scriviLog('Nuovo', 'Pattino', `${marca || ''} taglia ${taglia}`)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Nuovo Pattino</h1>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Marca</label>
          <input className="form-input" value={marca} onChange={e => setMarca(e.target.value)} placeholder="es. Risport, Edea..." />
        </div>
        <div className="form-group">
          <label className="form-label">Taglia *</label>
          <input className="form-input" type="number" value={taglia} onChange={e => setTaglia(e.target.value)} placeholder="es. 38" />
        </div>
        <div className="form-group">
          <label className="form-label">Stato</label>
          <select className="form-input" value={stato} onChange={e => setStato(e.target.value)}>
            <option>Buono</option><option>Usurato</option><option>Rotto</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows="2" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving || !taglia} style={{ marginTop: '12px' }}>
        {saving ? 'Salvataggio...' : 'Salva pattino'}
      </button>
    </div>
  )
}

// ============================================================
// DETTAGLIO PATTINO
// ============================================================

function DettaglioPattino({ pattino, idx, atleti, pagamenti, onBack, onSaved }) {
  const [modifica, setModifica] = useState(false)
  const [assegna, setAssegna] = useState(false)
  const [saving, setSaving] = useState(false)
  const [storico, setStorico] = useState([])
  const [loadingStorico, setLoadingStorico] = useState(true)

  useEffect(() => {
    getStoricoPattinoById(pattino.ID_Pattino)
      .then(s => setStorico(s))
      .catch(() => setStorico([]))
      .finally(() => setLoadingStorico(false))
  }, [pattino.ID_Pattino])

  // Form modifica
  const [marca, setMarca] = useState(pattino.Marca || '')
  const [taglia, setTaglia] = useState(pattino.Taglia || '')
  const [stato, setStato] = useState(pattino.Stato || 'Buono')
  const [note, setNote] = useState(pattino.Note || '')

  // Form assegna
  const [atletaId, setAtletaId] = useState('')
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0])

  const atletiAttivi = atleti.filter(a => isAttivo(a.Attivo))

  const nomeAtleta = (id) => {
    const a = atleti.find(at => at.ID_Atleta === id)
    return a ? `${a.Nome} ${a.Cognome}` : id
  }

  async function handleSalvaModifica() {
    setSaving(true)
    try {
      await aggiornaPattino(idx, { ...pattino, Marca: marca, Taglia: taglia, Stato: stato, Note: note })
      onSaved()
    } finally { setSaving(false) }
  }

  async function handleAssegna() {
    if (!atletaId) return
    setSaving(true)
    try {
      await assegnaPattino(pattino.ID_Pattino, atletaId, dataInizio)
      onSaved()
    } finally { setSaving(false) }
  }

  async function handleRestituisci() {
    setSaving(true)
    try {
      await restituisciPattino(pattino.ID_Pattino)
      onSaved()
    } finally { setSaving(false) }
  }

  function getStatoPagamentoPattino() {
    if (!pattino.ID_Atleta) return null
    const pagNoleggio = (pagamenti || []).filter(p =>
      p.ID_Atleta === pattino.ID_Atleta &&
      p.Tipo === 'Noleggio' &&
      p.Stato !== 'Pagato'
    )
    return pagNoleggio.length > 0 ? 'Da pagare' : 'Pagato'
  }

  async function handleTogglePagamento() {
    const pagNoleggio = (pagamenti || []).filter(p =>
      p.ID_Atleta === pattino.ID_Atleta &&
      p.Tipo === 'Noleggio' &&
      p.Stato !== 'Pagato'
    )
    if (pagNoleggio.length === 0) return
    setSaving(true)
    try {
      const oggi = new Date().toISOString().split('T')[0]
      for (const pag of pagNoleggio) {
        await aggiornaPagamento(pag.ID_Pagamento, { Stato: 'Pagato', Data_Pagamento: oggi })
      }
      onSaved()
    } finally { setSaving(false) }
  }

  if (modifica) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-ghost" onClick={() => setModifica(false)} style={{ padding: '8px 12px' }}>← Indietro</button>
          <h1 className="page-title" style={{ fontSize: '22px' }}>Modifica Pattino</h1>
        </div>
        <div className="card">
          <div className="form-group">
            <label className="form-label">Marca</label>
            <input className="form-input" value={marca} onChange={e => setMarca(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Taglia</label>
            <input className="form-input" type="number" value={taglia} onChange={e => setTaglia(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Stato</label>
            <select className="form-input" value={stato} onChange={e => setStato(e.target.value)}>
              <option>Buono</option><option>Usurato</option><option>Rotto</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <textarea className="form-input" rows="2" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSalvaModifica} disabled={saving} style={{ marginTop: '12px' }}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <button className="btn btn-secondary" onClick={() => setModifica(true)} style={{ padding: '6px 14px', fontSize: '13px' }}>Modifica</button>
      </div>

      {/* INFO PATTINO */}
      <div className="card card-elevated" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🛼</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{pattino.Marca || pattino.ID_Pattino}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Taglia {pattino.Taglia} · {pattino.ID_Pattino}</p>
        <div style={{ marginTop: '8px' }}>
          <span className={`badge ${pattino.Stato === 'Rotto' ? 'badge-danger' : pattino.Stato === 'Usurato' ? 'badge-warn' : 'badge-ok'}`}>{pattino.Stato}</span>
        </div>
        {pattino.Note && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>{pattino.Note}</p>}
      </div>

      {/* NOLEGGIO */}
      {pattino.ID_Atleta ? (
        <>
          <div className="section-title">Noleggio attivo</div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Atleta</span>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>{nomeAtleta(pattino.ID_Atleta)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Dal</span>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>{formattaData(pattino.Data_Inizio_Noleggio)}</span>
            </div>
            {(() => {
              const statoPag = getStatoPagamentoPattino()
              return statoPag && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pagamento</span>
                  {statoPag === 'Da pagare' ? (
                    <button
                      className="badge badge-warn"
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={handleTogglePagamento}
                      disabled={saving}
                    >
                      Da pagare (tocca)
                    </button>
                  ) : (
                    <span className="badge badge-ok">Pagato</span>
                  )}
                </div>
              )
            })()}
          </div>
          <button className="btn btn-ghost btn-full" onClick={handleRestituisci} disabled={saving} style={{ marginBottom: '16px' }}>
            {saving ? 'Restituzione...' : 'Restituisci pattino'}
          </button>
        </>
      ) : (
        <>
          <div className="section-title">Assegna ad atleta</div>
          {assegna ? (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Atleta</label>
                <select className="form-input" value={atletaId} onChange={e => setAtletaId(e.target.value)}>
                  <option value="">— Seleziona atleta —</option>
                  {atletiAttivi.map(a => (
                    <option key={a.ID_Atleta} value={a.ID_Atleta}>{a.Nome} {a.Cognome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Data inizio noleggio</label>
                <input className="form-input" type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" onClick={() => setAssegna(false)} style={{ flex: 1 }}>Annulla</button>
                <button className="btn btn-primary" onClick={handleAssegna} disabled={saving || !atletaId} style={{ flex: 1 }}>
                  {saving ? 'Assegnazione...' : 'Assegna'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-primary btn-full" onClick={() => setAssegna(true)} style={{ marginBottom: '16px' }}>
              Assegna ad atleta
            </button>
          )}
        </>
      )}

      {/* STORICO UTILIZZI */}
      <div className="section-title">Storico utilizzi</div>
      <div className="card">
        {loadingStorico ? (
          <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Caricamento...</div>
        ) : storico.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">Nessuno storico disponibile</div>
          </div>
        ) : (
          storico.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < storico.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.Nome_Atleta}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {formattaData(s.Data_Inizio)} — {formattaData(s.Data_Fine)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// RUOTE
// ============================================================

function RuoteView({ nav }) {
  const [ruote, setRuote] = useState([])
  const [ruoteConDisp, setRuoteConDisp] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [selezionato, setSelezionato] = useState(null)
  const [selIdx, setSelIdx] = useState(null)
  const [assegnaRuoteSet, setAssegnaRuoteSet] = useState(null)

  function navigaVista(nuovaVista) {
    nav.avanti({ tab: 'attrezzature', vista: nuovaVista })
    setVista(nuovaVista)
  }

  useEffect(() => {
    const stato = nav.stato
    if (stato.tab === 'attrezzature' && !stato.vista) {
      setVista('lista')
      setSelezionato(null)
      setAssegnaRuoteSet(null)
    }
  }, [nav.stato])

  async function ricarica() {
    setLoading(true)
    const r = await getRuote()
    const filtrate = r.filter(r => r.Stato !== 'Eliminato')
    setRuote(filtrate)
    const conDisp = await calcolaDisponibilitaRuote(filtrate)
    setRuoteConDisp(conDisp)
    setLoading(false)
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (vista === 'nuovo') {
    return <NuovoSetRuote onBack={() => nav.indietro()} onSaved={() => { setVista('lista'); ricarica() }} />
  }

  if (vista === 'dettaglio' && selezionato) {
    return <DettaglioRuote
      ruote={selezionato}
      idx={selIdx}
      onBack={() => nav.indietro()}
      onSaved={() => { setVista('lista'); setSelezionato(null); ricarica() }}
    />
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button className="btn btn-ghost" onClick={() => esportaRuoteExcel(ruote)} style={{ padding: '6px 12px', fontSize: '13px' }}>📥 Excel</button>
        <button className="btn btn-primary" onClick={() => navigaVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>+</button>
      </div>

      <div className="card">
        {ruoteConDisp.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text">Magazzino vuoto</div>
          </div>
        ) : (
          ruoteConDisp.map((r, i) => {
            const realIdx = i
            return (
              <div key={r.ID_Set} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => { setSelezionato(r); setSelIdx(realIdx); navigaVista('dettaglio') }}
                  >⚙️</div>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setSelezionato(r); setSelIdx(realIdx); navigaVista('dettaglio') }}>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{r.Diametro_mm}mm · {r.Durezza_A}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {r.Quantita_Disponibile}/{r.Quantita_Totale} disponibili
                      {r.Quantita_Assegnata > 0 && ` · ${r.Quantita_Assegnata} assegnate`}
                      {r.Note && ` · ${r.Note}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`badge ${r.Stato === 'Da sostituire' ? 'badge-danger' : r.Stato === 'Usurate' ? 'badge-warn' : r.Quantita_Disponibile > 0 ? 'badge-ok' : 'badge-danger'}`}>
                      {r.Quantita_Disponibile > 0 ? `${r.Quantita_Disponibile} disp.` : 'Esaurite'}
                    </span>
                    {r.Quantita_Disponibile > 0 && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={(e) => { e.stopPropagation(); setAssegnaRuoteSet(r) }}
                      >
                        Assegna
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {assegnaRuoteSet && (
        <AssegnaRuotePanel
          set={assegnaRuoteSet}
          onDone={() => { setAssegnaRuoteSet(null); ricarica() }}
          onAnnulla={() => setAssegnaRuoteSet(null)}
        />
      )}
    </>
  )
}

// ============================================================
// NUOVO SET RUOTE
// ============================================================

function NuovoSetRuote({ onBack, onSaved }) {
  const [diametro, setDiametro] = useState('')
  const [durezza, setDurezza] = useState('')
  const [quantita, setQuantita] = useState('')
  const [stato, setStato] = useState('Buone')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSalva() {
    if (!diametro || !durezza || !quantita) return
    setSaving(true)
    try {
      await creaSetRuote({ diametro, durezza, quantita, stato, note })
      await scriviLog('Nuovo', 'Set Ruote', `${diametro}mm ${durezza} x${quantita}`)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Nuovo Set Ruote</h1>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Diametro (mm) *</label>
          <input className="form-input" type="number" value={diametro} onChange={e => setDiametro(e.target.value)} placeholder="es. 62" />
        </div>
        <div className="form-group">
          <label className="form-label">Durezza *</label>
          <input className="form-input" type="text" value={durezza} onChange={e => setDurezza(e.target.value)} placeholder="es. 92A, SHR, 84A/80A" />
        </div>
        <div className="form-group">
          <label className="form-label">Quantità *</label>
          <input className="form-input" type="number" value={quantita} onChange={e => setQuantita(e.target.value)} placeholder="es. 8" />
        </div>
        <div className="form-group">
          <label className="form-label">Stato</label>
          <select className="form-input" value={stato} onChange={e => setStato(e.target.value)}>
            <option>Buone</option><option>Usurate</option><option>Da sostituire</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows="2" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving || !diametro || !durezza || !quantita} style={{ marginTop: '12px' }}>
        {saving ? 'Salvataggio...' : 'Salva set ruote'}
      </button>
    </div>
  )
}

// ============================================================
// DETTAGLIO RUOTE
// ============================================================

function DettaglioRuote({ ruote, idx, onBack, onSaved }) {
  const [diametro, setDiametro] = useState(ruote.Diametro_mm || '')
  const [durezza, setDurezza] = useState(ruote.Durezza_A || '')
  const [quantita, setQuantita] = useState(ruote.Quantita || '')
  const [stato, setStato] = useState(ruote.Stato || 'Buone')
  const [note, setNote] = useState(ruote.Note || '')
  const [saving, setSaving] = useState(false)
  const [confermaElimina, setConfermaElimina] = useState(false)

  async function handleSalva() {
    setSaving(true)
    try {
      await aggiornaSetRuote(idx, { ...ruote, Diametro_mm: diametro, Durezza_A: durezza, Quantita: quantita, Stato: stato, Note: note })
      onSaved()
    } finally { setSaving(false) }
  }

  async function handleElimina() {
    setSaving(true)
    try {
      await eliminaSetRuote(idx, ruote)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Modifica Ruote</h1>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Diametro (mm)</label>
          <input className="form-input" type="number" value={diametro} onChange={e => setDiametro(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Durezza</label>
          <input className="form-input" type="text" value={durezza} onChange={e => setDurezza(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Quantità</label>
          <input className="form-input" type="number" value={quantita} onChange={e => setQuantita(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Stato</label>
          <select className="form-input" value={stato} onChange={e => setStato(e.target.value)}>
            <option>Buone</option><option>Usurate</option><option>Da sostituire</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows="2" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginTop: '12px' }}>
        {saving ? 'Salvataggio...' : 'Salva modifiche'}
      </button>

      {confermaElimina ? (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '12px', textAlign: 'center' }}>
          <div style={{ color: '#FF6B7A', fontWeight: '600', marginBottom: '8px' }}>Eliminare questo set di ruote?</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => setConfermaElimina(false)} style={{ flex: 1 }}>Annulla</button>
            <button className="btn btn-primary" onClick={handleElimina} disabled={saving} style={{ flex: 1, background: 'var(--accent)' }}>
              {saving ? 'Eliminazione...' : 'Elimina'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-full" onClick={() => setConfermaElimina(true)} style={{ marginTop: '8px', color: '#FF6B7A' }}>
          Elimina set ruote
        </button>
      )}
    </div>
  )
}

// ============================================================
// ASSEGNA RUOTE PANEL (riutilizzabile)
// ============================================================

function AssegnaRuotePanel({ set, evento, atletiPreselezionati, onDone, onAnnulla }) {
  const [atleti, setAtleti] = useState([])
  const [atletaSelezionato, setAtletaSelezionato] = useState('')
  const [quantita, setQuantita] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carica() {
      const a = atletiPreselezionati || await getAtleti()
      const attivi = a.filter(at => at.Attivo === 'TRUE' || at.Attivo === 'true')
      setAtleti(attivi)
      setLoading(false)
    }
    carica()
  }, [])

  const atletiFiltrati = ricerca
    ? atleti.filter(a =>
        `${a.Nome} ${a.Cognome}`.toLowerCase().includes(ricerca.toLowerCase())
      )
    : atleti

  async function handleAssegna() {
    if (!atletaSelezionato || parseInt(quantita) < 1) return
    setSaving(true)
    try {
      const atleta = atleti.find(a => a.Codice_Fiscale === atletaSelezionato)
      if (!atleta) throw new Error('Atleta non trovato')

      await assegnaRuote(
        set.ID_Set,
        atleta.Codice_Fiscale,
        `${atleta.Nome} ${atleta.Cognome}`,
        parseInt(quantita),
        evento || '',
        note
      )
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-center">Caricamento...</div>

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
        Assegna ruote — {set.Diametro_mm}mm {set.Durezza_A}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
        Disponibili: {set.Quantita_Disponibile}
      </div>

      <div className="form-group">
        <label className="form-label">Atleta</label>
        <input
          className="form-input"
          placeholder="Cerca atleta..."
          value={ricerca}
          onChange={e => setRicerca(e.target.value)}
        />
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
        {atletiFiltrati.slice(0, 20).map(a => (
          <div
            key={a.Codice_Fiscale}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: atletaSelezionato === a.Codice_Fiscale ? 'var(--accent-soft)' : 'transparent',
              borderRadius: '4px'
            }}
            onClick={() => setAtletaSelezionato(a.Codice_Fiscale)}
          >
            <div className="atleta-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
              {a.Nome?.[0]}{a.Cognome?.[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{a.Nome} {a.Cognome}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.Nome_Categoria || ''}</div>
            </div>
            {atletaSelezionato === a.Codice_Fiscale && (
              <span style={{ color: 'var(--accent)', fontSize: '16px' }}>✓</span>
            )}
          </div>
        ))}
      </div>

      <div className="form-group">
        <label className="form-label">Quantità</label>
        <input
          className="form-input"
          type="number"
          min="1"
          max={set.Quantita_Disponibile}
          value={quantita}
          onChange={e => setQuantita(e.target.value === '' ? '' : e.target.value)}
          onBlur={e => {
            if (!e.target.value || parseInt(e.target.value) < 1) setQuantita(1)
          }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Note (opzionale)</label>
        <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Es. per gara regionale" />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" onClick={handleAssegna} disabled={saving || !atletaSelezionato} style={{ flex: 1 }}>
          {saving ? 'Assegnazione...' : `Assegna ${quantita} ruote`}
        </button>
        <button className="btn btn-ghost" onClick={onAnnulla} style={{ flex: 1 }}>
          Annulla
        </button>
      </div>
    </div>
  )
}

// ============================================================
// RUOTE ASSEGNATE (da Dashboard)
// ============================================================

function RuoteAssegnatePanel({ nav, onBack }) {
  const [assegnazioni, setAssegnazioni] = useState([])
  const [ruoteMagazzino, setRuoteMagazzino] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    async function carica() {
      const [ar, ruote] = await Promise.all([getAssegnazioniRuote(), getRuote()])
      const attive = ar.filter(a => parseInt(a.Quantita) > 0)
      setAssegnazioni(attive)
      setRuoteMagazzino(ruote)
      setLoading(false)
    }
    carica()
  }, [])

  async function handleRiconsegna(assegnazione) {
    setSaving(assegnazione.ID_Assegnazione)
    try {
      await rimuoviAssegnazioneRuote(assegnazione.ID_Assegnazione)
      setAssegnazioni(prev => prev.filter(a => a.ID_Assegnazione !== assegnazione.ID_Assegnazione))
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  const perAtleta = {}
  assegnazioni.forEach(a => {
    if (!perAtleta[a.ID_Atleta]) {
      perAtleta[a.ID_Atleta] = { nome: a.Nome_Atleta, ruote: [] }
    }
    perAtleta[a.ID_Atleta].ruote.push(a)
  })

  if (loading) return <div className="loading-center">Caricamento...</div>

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Ruote assegnate</h1>
      </div>

      {Object.keys(perAtleta).length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">Nessuna ruota assegnata</div>
          </div>
        </div>
      ) : (
        Object.entries(perAtleta).map(([cf, dati]) => (
          <div className="card" key={cf} style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
              {dati.nome}
            </div>
            {dati.ruote.map(r => {
              const set = ruoteMagazzino.find(s => s.ID_Set === r.ID_Set)
              return (
                <div key={r.ID_Assegnazione} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '14px' }}>
                      {set ? `${set.Diametro_mm}mm — ${set.Durezza_A}` : `Set ${r.ID_Set}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {r.Quantita} ruote · {r.Data_Assegnazione ? new Date(r.Data_Assegnazione).toLocaleDateString('it-IT') : ''}
                      {r.Evento && ` · ${r.Evento}`}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent)' }}
                    disabled={saving === r.ID_Assegnazione}
                    onClick={() => handleRiconsegna(r)}
                  >
                    {saving === r.ID_Assegnazione ? '...' : '↩ Riconsegna'}
                  </button>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

// ============================================================
// NUMERI DI GARA
// ============================================================

function NumeriView() {
  const [atleti, setAtleti] = useState([])
  const [categorie, setCategorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('tutte')
  const [editing, setEditing] = useState(null) // ID_Atleta in modifica
  const [valoreEdit, setValoreEdit] = useState('')
  const [saving, setSaving] = useState(false)

  function ricarica() {
    setLoading(true)
    Promise.all([getAtleti(), getCategorie()]).then(([a, c]) => {
      setAtleti(a); setCategorie(c); setLoading(false)
    })
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  const atletiAttivi = atleti.filter(a => isAttivo(a.Attivo))
  const categorieAttive = categorie.filter(c => isAttivo(c.Attiva))

  const atletiFiltrati = atletiAttivi
    .filter(a => filtro === 'tutte' || a.Nome_Categoria === filtro)
    .sort((a, b) => `${a.Cognome} ${a.Nome}`.localeCompare(`${b.Cognome} ${b.Nome}`))

  const conNumero = atletiAttivi.filter(a => a.Numero_Gara?.trim())

  // Duplicato = stesso numero E stesso sesso (campo Sesso dall'atleta)
  function isDuplicato(atleta, tutti) {
    if (!atleta.Numero_Gara?.trim()) return false
    return tutti.some(a =>
      a.ID_Atleta !== atleta.ID_Atleta &&
      a.Numero_Gara?.trim() === atleta.Numero_Gara.trim() &&
      a.Sesso === atleta.Sesso
    )
  }

  const numDuplicatiUnici = [...new Set(
    conNumero.filter(a => isDuplicato(a, atletiAttivi)).map(a => `${a.Numero_Gara.trim()}_${a.Sesso}`)
  )].length

  // Controllo duplicato per il valore in editing
  const editingAtleta = editing ? atletiAttivi.find(a => a.ID_Atleta === editing) : null
  const duplicatoDi = editing && valoreEdit.trim() && editingAtleta
    ? atletiAttivi.find(a => a.ID_Atleta !== editing && a.Numero_Gara?.trim() === valoreEdit.trim() && a.Sesso === editingAtleta.Sesso)
    : null

  async function handleSalva(idAtleta) {
    setSaving(true)
    try {
      const numero = valoreEdit.trim()
      await aggiornaNumeroGara(atleti, idAtleta, numero)
      const a = atleti.find(at => at.ID_Atleta === idAtleta)
      await scriviLog('Modifica', 'Numero gara', `${a.Nome} ${a.Cognome} → #${numero || '—'}`)
      setEditing(null)
      setValoreEdit('')
      ricarica()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* STATISTICHE */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px' }}>
            <span style={{ fontWeight: '600' }}>{conNumero.length}</span>
            <span style={{ color: 'var(--text-secondary)' }}> con numero / {atletiAttivi.length} totale</span>
          </div>
          {numDuplicatiUnici > 0 && (
            <span className="badge badge-danger">{numDuplicatiUnici} duplicat{numDuplicatiUnici > 1 ? 'i' : 'o'}</span>
          )}
        </div>
      </div>

      {/* FILTRO CATEGORIE */}
      {categorieAttive.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${filtro === 'tutte' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltro('tutte')}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >Tutte</button>
          {categorieAttive.map(c => (
            <button
              key={c.ID_Categoria}
              className={`btn ${filtro === c.Nome ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltro(filtro === c.Nome ? 'tutte' : c.Nome)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >{c.Nome}</button>
          ))}
        </div>
      )}

      {/* LISTA ATLETI */}
      <div className="card">
        {atletiFiltrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔢</div>
            <div className="empty-state-text">Nessun atleta</div>
          </div>
        ) : (
          atletiFiltrati.map(a => {
            const isEditing = editing === a.ID_Atleta
            const hasDuplicato = !isEditing && isDuplicato(a, atletiAttivi)

            return (
              <div key={a.ID_Atleta} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="atleta-avatar" style={{ width: '36px', height: '36px', fontSize: '13px', flexShrink: 0 }}>
                  {a.Nome?.[0]}{a.Cognome?.[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{a.Nome} {a.Cognome}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{a.Nome_Categoria || '—'}</div>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        value={valoreEdit}
                        onChange={e => setValoreEdit(e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', fontSize: '14px', textAlign: 'center' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSalva(a.ID_Atleta); if (e.key === 'Escape') { setEditing(null); setValoreEdit('') } }}
                      />
                      <button className="btn btn-primary" onClick={() => handleSalva(a.ID_Atleta)} disabled={saving} style={{ padding: '4px 8px', fontSize: '13px', lineHeight: 1 }}>✓</button>
                      <button className="btn btn-ghost" onClick={() => { setEditing(null); setValoreEdit('') }} style={{ padding: '4px 8px', fontSize: '13px', lineHeight: 1 }}>✕</button>
                    </div>
                    {duplicatoDi && (
                      <div style={{ color: 'var(--accent-warn)', fontSize: '11px' }}>
                        Numero già assegnato a {duplicatoDi.Nome} {duplicatoDi.Cognome}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700',
                      color: a.Numero_Gara?.trim() ? 'var(--text-primary)' : 'var(--text-secondary)',
                      minWidth: '36px', textAlign: 'center'
                    }}>
                      {a.Numero_Gara?.trim() ? `#${a.Numero_Gara}` : '—'}
                    </span>
                    {hasDuplicato && <span style={{ color: 'var(--accent-warn)', fontSize: '12px' }}>⚠️</span>}
                    <button className="btn btn-ghost" onClick={() => { setEditing(a.ID_Atleta); setValoreEdit(a.Numero_Gara || '') }} style={{ padding: '4px 6px', fontSize: '13px', lineHeight: 1 }}>✏️</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
