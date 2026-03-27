import { useState, useEffect } from 'react'
import { getSlotFissi, getEventiSpeciali, getAtleti, registraPresenza, salvaPresenzaSingola, getPresenze, aggiornaIscrittGara, aggiornaStatoPagamentoGara } from '../utils/sheetsApi'
import { formattaData, statoScadenza, giorniAllaScadenza } from '../utils/dateUtils'
import { esportaIscrittGaraPDF, esportaIscrittGaraExcel } from '../utils/exportUtils'

const isAttivo = v => ['TRUE', 'true', 'True'].includes(v?.trim())

function formattaRange(dataInizio, dataFine) {
  if (!dataInizio) return '—'
  const dI = new Date(dataInizio)
  const inizio = dI.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  if (!dataFine || dataFine === dataInizio) {
    return `${inizio} ${dI.getFullYear()}`
  }
  const dF = new Date(dataFine)
  const fine = dF.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${inizio} – ${fine}`
}

export default function Calendario() {
  const [slotFissi, setSlotFissi] = useState([])
  const [eventi, setEventi] = useState([])
  const [atleti, setAtleti] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState(null) // { tipo: 'presenze'|'gara', dati }
  const [tab, setTab] = useState('allenamenti')

  useEffect(() => {
    async function carica() {
      const [s, e, a] = await Promise.all([getSlotFissi(), getEventiSpeciali(), getAtleti()])
      setSlotFissi(s)
      setEventi(e)
      setAtleti(a)
      setLoading(false)
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (vista?.tipo === 'presenze') {
    return <RegistroPresenze evento={vista.dati} atleti={atleti} onBack={() => setVista(null)} />
  }

  if (vista?.tipo === 'gara') {
    return <DettaglioGara
      gara={vista.dati}
      atleti={atleti}
      onBack={() => setVista(null)}
      onUpdate={(garaAggiornata) => {
        setEventi(prev => prev.map(e => e.ID_Evento === garaAggiornata.ID_Evento ? garaAggiornata : e))
        setVista({ tipo: 'gara', dati: garaAggiornata })
      }}
    />
  }

  const oggi = new Date()
  const prossimiEventi = eventi
    .filter(e => new Date(e.Data_Inizio) >= oggi)
    .sort((a, b) => new Date(a.Data_Inizio) - new Date(b.Data_Inizio))
    .slice(0, 15)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Calendario</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className={`btn ${tab === 'allenamenti' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('allenamenti')} style={{ flex: 1 }}>
          Allenamenti
        </button>
        <button className={`btn ${tab === 'eventi' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('eventi')} style={{ flex: 1 }}>
          Gare & eventi
        </button>
      </div>

      {tab === 'allenamenti' && (() => {
        const attivi = slotFissi.filter(s => isAttivo(s.Attivo))
        const grouped = {}
        attivi.forEach(s => {
          const g = s.Giorno_Settimana || '—'
          if (!grouped[g]) grouped[g] = []
          grouped[g].push(s)
        })
        const giorni = Object.entries(grouped)

        return (
          <>
            <div className="section-title">Slot fissi settimanali</div>
            <div className="card">
              {giorni.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📅</div>
                  <div className="empty-state-text">Nessuno slot configurato</div>
                </div>
              ) : (
                giorni.map(([giorno, slots]) => {
                  const primo = slots[0]
                  const nomiCategorie = [...new Set(
                    slots.map(s => (s.Nome_Categoria || s.ID_Categoria || '').replace(/\s*[MF]$/i, '').trim()).filter(Boolean)
                  )].join(', ') || '—'
                  const oggi = new Date().toISOString().split('T')[0]
                  const idRif = `${giorno}_${oggi}`

                  return (
                    <div
                      key={giorno}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => setVista({ tipo: 'presenze', dati: { tipo: 'slot', Giorno_Settimana: giorno, Ora_Inizio: primo.Ora_Inizio, Ora_Fine: primo.Ora_Fine, Nome_Categoria: nomiCategorie, ID_Slot: idRif, Data: oggi } })}
                    >
                      <div style={{ width: '48px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent)', flexShrink: 0 }}>
                        {giorno.slice(0, 3)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>{primo.Ora_Inizio} – {primo.Ora_Fine}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {nomiCategorie}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Presenze →</span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )
      })()}

      {tab === 'eventi' && (
        <>
          <div className="section-title">Prossimi eventi</div>
          <div className="card">
            {prossimiEventi.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏆</div>
                <div className="empty-state-text">Nessun evento in programma</div>
              </div>
            ) : (
              prossimiEventi.map(e => {
                const isGara = e.Tipo === 'Gara' || e.Tipo === 'Trasferta'
                const alertIscrizione = isGara ? statoScadenza(e.Scad_Iscrizione) : null
                const haAlert = alertIscrizione === 'scaduto' || alertIscrizione === 'urgente' || alertIscrizione === 'in_scadenza'

                return (
                  <div
                    key={e.ID_Evento}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setVista({ tipo: isGara ? 'gara' : 'presenze', dati: e })}
                  >
                    <div style={{ width: '52px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {new Date(e.Data_Inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600' }}>{e.Titolo}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {formattaRange(e.Data_Inizio, e.Data_Fine)}
                        {e.Luogo && ` · ${e.Luogo}`}
                      </div>
                      {haAlert && (
                        <div style={{ color: '#FCD34D', fontSize: '12px', marginTop: '2px' }}>
                          ⚠️ Iscrizioni {alertIscrizione === 'scaduto' ? 'chiuse' : `scadono tra ${giorniAllaScadenza(e.Scad_Iscrizione)}gg`}
                        </div>
                      )}
                    </div>
                    <span className={`badge ${e.Tipo === 'Gara' ? 'badge-danger' : e.Tipo === 'Trasferta' ? 'badge-warn' : 'badge-muted'}`}>{e.Tipo}</span>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// DETTAGLIO GARA con scadenze
// ============================================================

function DettaglioGara({ gara, atleti, onBack, onUpdate }) {
  const [iscritti, setIscritti] = useState(
    gara.Iscritti ? gara.Iscritti.split(',').filter(Boolean) : []
  )
  const [saving, setSaving] = useState(false)
  const [statoPag, setStatoPag] = useState(gara.Stato_Pagamento_Gara || 'Da pagare')

  const scadenze = [
    { label: 'Iscrizione atleti', data: gara.Scad_Iscrizione, icona: '📋' },
    { label: 'Pagamento quota', data: gara.Scad_Pagamento, icona: '💰' },
    { label: 'Comunicazione convocati', data: gara.Data_Convocati, icona: '👥' },
  ].filter(s => s.data)

  async function toggleIscritto(idAtleta) {
    const nuovoIscritto = !iscritti.includes(idAtleta)
    const nuoviIscritti = nuovoIscritto
      ? [...iscritti, idAtleta]
      : iscritti.filter(id => id !== idAtleta)
    setSaving(true)
    try {
      await aggiornaIscrittGara(gara.ID_Evento, idAtleta, nuovoIscritto)
      setIscritti(nuoviIscritti)
    } finally {
      setSaving(false)
    }
  }

  async function togglePagamento() {
    const nuovo = statoPag === 'Pagato' ? 'Da pagare' : 'Pagato'
    await aggiornaStatoPagamentoGara(gara.ID_Evento, nuovo)
    setStatoPag(nuovo)
  }

  const atletiAttivi = atleti.filter(a => isAttivo(a.Attivo))

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
      </div>

      {/* HEADER GARA */}
      <div className="card card-elevated" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' }}>{gara.Titolo}</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
              {formattaRange(gara.Data_Inizio, gara.Data_Fine)}
            </p>
            {(gara.Ora_Inizio || gara.Ora_Fine) && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                🕐 {gara.Ora_Inizio || '—'}{gara.Ora_Fine && ` – ${gara.Ora_Fine}`}
              </p>
            )}
            {gara.Luogo && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>📍 {gara.Luogo}</p>}
          </div>
          <span className={`badge ${gara.Tipo === 'Gara' ? 'badge-danger' : 'badge-warn'}`}>{gara.Tipo}</span>
        </div>
      </div>

      {/* SCADENZE */}
      {scadenze.length > 0 && (
        <>
          <div className="section-title">Scadenze</div>
          <div className="card" style={{ marginBottom: '16px' }}>
            {scadenze.map((s, i) => {
              const stato = statoScadenza(s.data)
              const giorni = giorniAllaScadenza(s.data)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < scadenze.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{s.icona}</span>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.label}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{formattaData(s.data)}</div>
                    </div>
                  </div>
                  <span className={`badge ${
                    stato === 'scaduto' ? 'badge-danger' :
                    stato === 'urgente' ? 'badge-urgente' :
                    stato === 'in_scadenza' ? 'badge-warn' : 'badge-ok'
                  }`}>
                    {stato === 'scaduto' ? 'Scaduta' :
                     stato === 'urgente' ? `${giorni}gg` :
                     stato === 'in_scadenza' ? `${giorni}gg` : 'OK'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* PAGAMENTO QUOTA */}
      <div className="section-title">Quota iscrizione</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '600' }}>Stato pagamento</div>
          <button
            className={`badge ${statoPag === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}
            style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '13px' }}
            onClick={togglePagamento}
          >
            {statoPag} (tocca per cambiare)
          </button>
        </div>
      </div>

      {/* DOCUMENTI RICHIESTI */}
      {gara.Documenti_Richiesti && (
        <>
          <div className="section-title">Documenti richiesti</div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{gara.Documenti_Richiesti}</p>
          </div>
        </>
      )}

      {/* ISCRITTI */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Atleti iscritti ({iscritti.length}/{atletiAttivi.length})</div>
        {iscritti.length > 0 && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
              const atletiIscrittiDati = atletiAttivi.filter(a => iscritti.includes(a.ID_Atleta))
              esportaIscrittGaraExcel(gara, atletiIscrittiDati)
            }}>📥 Excel</button>
            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
              const atletiIscrittiDati = atletiAttivi.filter(a => iscritti.includes(a.ID_Atleta))
              esportaIscrittGaraPDF(gara, atletiIscrittiDati)
            }}>📥 PDF</button>
          </div>
        )}
      </div>
      <div className="card">
        {atletiAttivi.map(a => {
          const isIscritto = iscritti.includes(a.ID_Atleta)
          return (
            <div
              key={a.ID_Atleta}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
              onClick={() => !saving && toggleIscritto(a.ID_Atleta)}
            >
              <div className="atleta-avatar" style={{
                background: isIscritto ? 'var(--accent)' : 'var(--bg-elevated)',
                color: isIscritto ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}>
                {isIscritto ? '✓' : `${a.Nome?.[0]}${a.Cognome?.[0]}`}
              </div>
              <div className="atleta-info">
                <div className="atleta-nome">{a.Nome} {a.Cognome}</div>
                <div className="atleta-sub">{a.Nome_Categoria || '—'}</div>
              </div>
              <span style={{ color: isIscritto ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px' }}>
                {isIscritto ? 'Iscritto' : 'Non iscritto'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// REGISTRO PRESENZE (allenamenti)
// ============================================================

function RegistroPresenze({ evento, atleti, onBack }) {
  const [presenze, setPresenze] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingAtleta, setSavingAtleta] = useState({})
  const [salvati, setSalvati] = useState({})
  const [loadingPresenze, setLoadingPresenze] = useState(true)

  const atletiAttivi = atleti.filter(a => isAttivo(a.Attivo))
  const titolo = evento.tipo === 'slot' ? `${evento.Nome_Categoria || evento.ID_Categoria || '—'} — ${evento.Giorno_Settimana}` : evento.Titolo
  const idRif = evento.ID_Slot || evento.ID_Evento
  const tipo = evento.tipo === 'slot' ? 'Allenamento' : 'Evento'
  const data = evento.Data || new Date().toISOString().split('T')[0]

  // Carica presenze salvate all'apertura
  useEffect(() => {
    async function caricaPresenze() {
      try {
        const presenzeSalvate = await getPresenze(idRif)
        const presenzeOggi = presenzeSalvate.filter(p => p.Data === data)
        const stato = {}
        const giaSalvati = {}
        presenzeOggi.forEach(p => {
          if (p.Presente === 'TRUE') {
            stato[p.ID_Atleta] = true
            giaSalvati[p.ID_Atleta] = true
          }
        })
        setPresenze(stato)
        setSalvati(giaSalvati)
      } catch (err) {
        console.error('Errore caricamento presenze:', err)
      } finally {
        setLoadingPresenze(false)
      }
    }
    caricaPresenze()
  }, [idRif, data])

  async function togglePresenza(idAtleta) {
    const nuovoStato = !presenze[idAtleta]
    setPresenze(prev => ({ ...prev, [idAtleta]: nuovoStato }))

    // Salva immediatamente la singola presenza
    setSavingAtleta(prev => ({ ...prev, [idAtleta]: true }))
    try {
      await salvaPresenzaSingola({
        tipoSessione: tipo,
        idRiferimento: idRif,
        data,
        idAtleta,
        presente: nuovoStato
      })
      setSalvati(prev => ({ ...prev, [idAtleta]: true }))
    } catch (err) {
      console.error('Errore salvataggio presenza:', err)
      // Ripristina stato in caso di errore
      setPresenze(prev => ({ ...prev, [idAtleta]: !nuovoStato }))
    } finally {
      setSavingAtleta(prev => ({ ...prev, [idAtleta]: false }))
    }
  }

  async function salva() {
    setSaving(true)
    try {
      await Promise.all(
        atletiAttivi.map(a =>
          salvaPresenzaSingola({ tipoSessione: tipo, idRiferimento: idRif, data, idAtleta: a.ID_Atleta, presente: !!presenze[a.ID_Atleta] })
        )
      )
      setSaved(true)
      const tuttiSalvati = {}
      atletiAttivi.forEach(a => { tuttiSalvati[a.ID_Atleta] = true })
      setSalvati(tuttiSalvati)
    } finally {
      setSaving(false)
    }
  }

  const presentiCount = Object.values(presenze).filter(Boolean).length

  if (loadingPresenze) return <div className="loading-center">Caricamento presenze...</div>

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
      </div>

      <div className="card card-elevated" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700' }}>{titolo}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
          {formattaData(evento.Data)} · {presentiCount}/{atletiAttivi.length} presenti
        </p>
      </div>

      <div className="card">
        {atletiAttivi.map(a => (
          <div
            key={a.ID_Atleta}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: savingAtleta[a.ID_Atleta] ? 'wait' : 'pointer', opacity: savingAtleta[a.ID_Atleta] ? 0.6 : 1 }}
            onClick={() => !savingAtleta[a.ID_Atleta] && togglePresenza(a.ID_Atleta)}
          >
            <div className="atleta-avatar" style={{
              background: presenze[a.ID_Atleta] ? 'var(--accent-ok)' : 'var(--bg-elevated)',
              color: presenze[a.ID_Atleta] ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}>
              {presenze[a.ID_Atleta] ? '✓' : `${a.Nome?.[0]}${a.Cognome?.[0]}`}
            </div>
            <div className="atleta-info" style={{ flex: 1 }}>
              <div className="atleta-nome">{a.Nome} {a.Cognome}</div>
              <div className="atleta-sub">{a.Nome_Categoria || '—'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {salvati[a.ID_Atleta] && (
                <span style={{ color: 'var(--accent-ok)', fontSize: '12px', whiteSpace: 'nowrap' }}>Salvato ✓</span>
              )}
              {savingAtleta[a.ID_Atleta] && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>...</span>
              )}
              <span style={{ color: presenze[a.ID_Atleta] ? 'var(--accent-ok)' : 'var(--text-secondary)', fontSize: '14px' }}>
                {presenze[a.ID_Atleta] ? 'Presente' : 'Assente'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {saved ? (
        <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)', textAlign: 'center', marginTop: '12px' }}>
          <span style={{ color: 'var(--accent-ok)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Presenze salvate</span>
        </div>
      ) : (
        <button className="btn btn-primary btn-full" onClick={salva} disabled={saving} style={{ marginTop: '12px' }}>
          {saving ? 'Salvataggio...' : `Salva tutte (${presentiCount} presenti)`}
        </button>
      )}
    </div>
  )
}
