import { useState, useEffect } from 'react'
import { getSlotFissi, getEventiSpeciali, getAtleti, getCategorie, registraPresenza, salvaPresenzaSingola, getPresenze, aggiornaIscrittGara, aggiornaStatoPagamentoGara, creaEvento, aggiornaEvento, togglePartecipazione, toggleIscrizioneComunicata, creaCartellaGara, caricaDocumentoGara, getRuote, calcolaDisponibilitaRuote, assegnaRuote } from '../utils/sheetsApi'
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

export default function Calendario({ nav }) {
  const [slotFissi, setSlotFissi] = useState([])
  const [eventi, setEventi] = useState([])
  const [atleti, setAtleti] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState(null) // { tipo: 'presenze'|'gara', dati }
  const [tab, setTab] = useState('allenamenti')

  function navigaVista(nuovaVista) {
    if (nuovaVista) {
      nav.avanti({ tab: 'calendario', vista: nuovaVista.tipo })
    }
    setVista(nuovaVista)
  }

  // Reagisci al tasto indietro
  useEffect(() => {
    const stato = nav.stato
    if (stato.tab === 'calendario' && !stato.vista) {
      setVista(null)
    }
  }, [nav.stato])

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

  // Navigazione da Dashboard → dettaglio evento
  useEffect(() => {
    if (loading || eventi.length === 0) return
    const stato = nav.stato
    if (stato.tab === 'calendario' && stato.evento) {
      const eventoTrovato = eventi.find(e => e.ID_Evento === stato.evento)
      if (eventoTrovato) {
        const isGara = eventoTrovato.Tipo === 'Gara' || eventoTrovato.Tipo === 'Trasferta'
        setVista({ tipo: isGara ? 'gara' : 'presenze', dati: eventoTrovato })
        setTab('eventi')
      }
    }
  }, [loading, eventi])

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (vista?.tipo === 'modificaEvento') {
    return <ModificaEvento
      evento={vista.dati}
      onBack={() => nav.indietro()}
      onSaved={() => {
        setVista(null)
        setLoading(true)
        Promise.all([getSlotFissi(), getEventiSpeciali(), getAtleti()]).then(([s, e, a]) => {
          setSlotFissi(s); setEventi(e); setAtleti(a); setLoading(false)
        })
      }}
    />
  }

  if (vista?.tipo === 'nuovoEvento') {
    return <NuovoEvento onBack={() => nav.indietro()} onSaved={() => {
      setVista(null)
      setLoading(true)
      Promise.all([getSlotFissi(), getEventiSpeciali(), getAtleti()]).then(([s, e, a]) => {
        setSlotFissi(s); setEventi(e); setAtleti(a); setLoading(false)
      })
    }} />
  }

  if (vista?.tipo === 'presenze') {
    return <RegistroPresenze evento={vista.dati} atleti={atleti} onBack={() => nav.indietro()} />
  }

  if (vista?.tipo === 'gara') {
    return <DettaglioGara
      gara={vista.dati}
      atleti={atleti}
      onBack={() => nav.indietro()}
      onUpdate={(garaAggiornata) => {
        setEventi(prev => prev.map(e => e.ID_Evento === garaAggiornata.ID_Evento ? garaAggiornata : e))
        setVista({ tipo: 'gara', dati: garaAggiornata })
      }}
      onEdit={(gara) => navigaVista({ tipo: 'modificaEvento', dati: gara })}
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
                      onClick={() => navigaVista({ tipo: 'presenze', dati: { tipo: 'slot', Giorno_Settimana: giorno, Ora_Inizio: primo.Ora_Inizio, Ora_Fine: primo.Ora_Fine, Nome_Categoria: nomiCategorie, ID_Slot: idRif, Data: oggi } })}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Prossimi eventi</div>
            <button className="btn btn-primary" onClick={() => navigaVista({ tipo: 'nuovoEvento' })} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>+</button>
          </div>
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
                    onClick={() => navigaVista({ tipo: isGara ? 'gara' : 'presenze', dati: e })}
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
                      {e.Partecipazione === 'TRUE' && (() => {
                        const alertEvento = []
                        if (!e.Scad_Iscrizione) alertEvento.push('Scadenza iscrizione')
                        if (!e.Scad_Pagamento) alertEvento.push('Scadenza pagamento')
                        if (!e.Iscritti || e.Iscritti.split(',').filter(Boolean).length === 0) alertEvento.push('Atleti da selezionare')
                        if (e.Iscrizione_Comunicata !== 'TRUE') alertEvento.push('Iscrizione da comunicare')
                        if (e.Stato_Pagamento_Gara !== 'Pagato') alertEvento.push('Pagamento da effettuare')
                        if (alertEvento.length === 0) return null
                        return (
                          <div style={{ color: '#FCD34D', fontSize: '12px', marginTop: '2px' }}>
                            ⚠️ {alertEvento.join(' · ')}
                          </div>
                        )
                      })()}
                    </div>
                    {isGara ? (
                      <button
                        className={`badge ${e.Partecipazione === 'TRUE' ? 'badge-ok' : 'badge-muted'}`}
                        style={{ cursor: 'pointer', border: 'none', padding: '6px 10px' }}
                        onClick={async (ev) => {
                          ev.stopPropagation()
                          const nuovoStato = await togglePartecipazione(e.ID_Evento)
                          setEventi(prev => prev.map(evt => evt.ID_Evento === e.ID_Evento ? { ...evt, Partecipazione: nuovoStato } : evt))
                        }}
                      >
                        {e.Partecipazione === 'TRUE' ? '✓ Partecipiamo' : '○ Partecipa?'}
                      </button>
                    ) : (
                      <span className={`badge ${e.Tipo === 'Trasferta' ? 'badge-warn' : 'badge-muted'}`}>{e.Tipo}</span>
                    )}
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

function DettaglioGara({ gara, atleti, onBack, onUpdate, onEdit }) {
  const [iscritti, setIscritti] = useState(
    gara.Iscritti ? gara.Iscritti.split(',').filter(Boolean) : []
  )
  const [saving, setSaving] = useState(false)
  const [statoPag, setStatoPag] = useState(gara.Stato_Pagamento_Gara || 'Da pagare')
  const [refreshDocs, setRefreshDocs] = useState(0)
  const [docCaricato, setDocCaricato] = useState({ ricevuta: false, iscrizione: false })
  const [ricercaAtleta, setRicercaAtleta] = useState('')
  const [mostraSoloIscritti, setMostraSoloIscritti] = useState(false)

  useEffect(() => {
    if (!gara.Drive_Folder_Gara) return
    const token = localStorage.getItem('gapi_token')
    fetch(`https://www.googleapis.com/drive/v3/files?q='${gara.Drive_Folder_Gara}'+in+parents+and+trashed=false&fields=files(name)`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      const nomi = (data.files || []).map(f => f.name?.toLowerCase() || '')
      setDocCaricato({
        ricevuta: nomi.some(n => n.includes('ricevuta_pagamento')),
        iscrizione: nomi.some(n => n.includes('iscrizione_'))
      })
    }).catch(() => {})
  }, [gara.Drive_Folder_Gara, refreshDocs])

  const scadenze = [
    { label: 'Iscrizione atleti', data: gara.Scad_Iscrizione, icona: '📋' },
    { label: 'Pagamento quota', data: gara.Scad_Pagamento, icona: '💰' },
    { label: 'Comunicazione convocati', data: gara.Data_Convocati, icona: '👥' },
  ].filter(s => s.data)

  async function toggleIscritto(idAtleta, nomeAtleta) {
    const eraIscritto = iscritti.includes(idAtleta)
    if (eraIscritto) {
      if (!confirm(`Rimuovere ${nomeAtleta} dalla gara?`)) return
    }
    const nuoviIscritti = eraIscritto
      ? iscritti.filter(id => id !== idAtleta)
      : [...iscritti, idAtleta]
    setSaving(true)
    try {
      await aggiornaIscrittGara(gara.ID_Evento, idAtleta, !eraIscritto)
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => onEdit(gara)} style={{ padding: '6px 10px', fontSize: '13px' }}>✏️ Modifica</button>
            <span className={`badge ${gara.Tipo === 'Gara' ? 'badge-danger' : 'badge-warn'}`}>{gara.Tipo}</span>
          </div>
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
        {statoPag === 'Pagato' && (
          <div style={{ marginTop: '12px' }}>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={async (e) => {
                const file = e.target.files[0]
                if (!file) return
                let folderId = gara.Drive_Folder_Gara
                if (!folderId) {
                  folderId = await creaCartellaGara(gara)
                  await aggiornaEvento({ ...gara, Drive_Folder_Gara: folderId })
                  onUpdate({ ...gara, Drive_Folder_Gara: folderId })
                }
                const titoloGara = gara.Titolo.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ ]/g, '').replace(/\s+/g, '_')
                const annoGara = gara.Data_Inizio?.split('-')[0] || ''
                const ext = file.name.split('.').pop() || 'pdf'
                await caricaDocumentoGara(folderId, file, `ricevuta_pagamento_${titoloGara}_${annoGara}.${ext}`)
                setRefreshDocs(prev => prev + 1)
                setDocCaricato(prev => ({ ...prev, ricevuta: true }))
              }}
              style={{ display: 'none' }}
              id="upload-ricevuta"
            />
            <label htmlFor="upload-ricevuta" className="btn btn-ghost" style={{ fontSize: '13px', cursor: 'pointer', color: docCaricato.ricevuta ? 'var(--accent-ok)' : undefined }}>
              {docCaricato.ricevuta ? '✅ Ricevuta caricata (tap per sostituire)' : '📎 Archivia ricevuta pagamento'}
            </label>
          </div>
        )}
      </div>

      {/* ISCRIZIONE COMUNICATA */}
      <div className="section-title">Iscrizione federazione</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '600' }}>Iscrizione comunicata</div>
          <button
            className={`badge ${gara.Iscrizione_Comunicata === 'TRUE' ? 'badge-ok' : 'badge-warn'}`}
            style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '13px' }}
            onClick={async () => {
              const nuovoStato = await toggleIscrizioneComunicata(gara.ID_Evento)
              onUpdate({ ...gara, Iscrizione_Comunicata: nuovoStato })
            }}
          >
            {gara.Iscrizione_Comunicata === 'TRUE' ? 'Comunicata ✓' : 'Da comunicare (tocca)'}
          </button>
        </div>
        <div style={{ marginTop: '12px' }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              let folderId = gara.Drive_Folder_Gara
              if (!folderId) {
                folderId = await creaCartellaGara(gara)
                await aggiornaEvento({ ...gara, Drive_Folder_Gara: folderId })
                onUpdate({ ...gara, Drive_Folder_Gara: folderId })
              }
              const titoloGara = gara.Titolo.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ ]/g, '').replace(/\s+/g, '_')
              const annoGara = gara.Data_Inizio?.split('-')[0] || ''
              const ext = file.name.split('.').pop() || 'pdf'
              await caricaDocumentoGara(folderId, file, `iscrizione_${titoloGara}_${annoGara}.${ext}`)
              setRefreshDocs(prev => prev + 1)
              setDocCaricato(prev => ({ ...prev, iscrizione: true }))
            }}
            style={{ display: 'none' }}
            id="upload-iscrizione"
          />
          <label htmlFor="upload-iscrizione" className="btn btn-ghost" style={{ fontSize: '13px', cursor: 'pointer', color: docCaricato.iscrizione ? 'var(--accent-ok)' : undefined }}>
            {docCaricato.iscrizione ? '✅ Iscrizione caricata (tap per sostituire)' : '📎 Archivia documento iscrizione'}
          </label>
        </div>
        <ListaDocumentiGara driveFolderId={gara.Drive_Folder_Gara} key={refreshDocs} />
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
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`btn ${mostraSoloIscritti ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => setMostraSoloIscritti(!mostraSoloIscritti)}
          >
            {mostraSoloIscritti ? 'Tutti' : 'Solo iscritti'}
          </button>
          {iscritti.length > 0 && (
            <>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                const atletiIscrittiDati = atletiAttivi.filter(a => iscritti.includes(a.ID_Atleta))
                esportaIscrittGaraExcel(gara, atletiIscrittiDati)
              }}>Excel</button>
              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                const atletiIscrittiDati = atletiAttivi.filter(a => iscritti.includes(a.ID_Atleta))
                esportaIscrittGaraPDF(gara, atletiIscrittiDati)
              }}>PDF</button>
            </>
          )}
        </div>
      </div>
      <div className="card">
        <div className="form-group" style={{ marginBottom: '8px' }}>
          <input
            className="form-input"
            placeholder="Cerca atleta..."
            value={ricercaAtleta}
            onChange={e => setRicercaAtleta(e.target.value)}
            style={{ fontSize: '14px' }}
          />
        </div>
        {(() => {
          let lista = ricercaAtleta
            ? atletiAttivi.filter(a => `${a.Nome} ${a.Cognome}`.toLowerCase().includes(ricercaAtleta.toLowerCase()))
            : atletiAttivi
          if (mostraSoloIscritti) {
            lista = lista.filter(a => iscritti.includes(a.ID_Atleta))
          }
          return lista.map(a => {
            const isIscritto = iscritti.includes(a.ID_Atleta)
            return (
              <div
                key={a.ID_Atleta}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
                onClick={() => !saving && toggleIscritto(a.ID_Atleta, `${a.Nome} ${a.Cognome}`)}
              >
                <div className="atleta-avatar" style={{
                  background: isIscritto ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isIscritto ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}>
                  {isIscritto ? '✓' : `${a.Nome?.[0]}${a.Cognome?.[0]}`}
                </div>
                <div className="atleta-info">
                  <div className="atleta-nome">{a.Nome} {a.Cognome}{a.Numero_Gara ? ` — #${a.Numero_Gara}` : ''}</div>
                  <div className="atleta-sub">{a.Nome_Categoria || '—'}</div>
                </div>
                <span style={{ color: isIscritto ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px' }}>
                  {isIscritto ? 'Iscritto' : 'Non iscritto'}
                </span>
              </div>
            )
          })
        })()}
      </div>

      {/* RUOTE PER GARA */}
      {iscritti.length > 0 && (
        <AssegnaRuoteGara
          gara={gara}
          atletiIscritti={atletiAttivi.filter(a => iscritti.includes(a.ID_Atleta))}
        />
      )}
    </div>
  )
}

// ============================================================
// ASSEGNA RUOTE PER GARA
// ============================================================

function AssegnaRuoteGara({ gara, atletiIscritti }) {
  const [aperto, setAperto] = useState(false)
  const [ruote, setRuote] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assegnazioni, setAssegnazioni] = useState({})

  async function apriPannello() {
    if (!aperto) {
      setLoading(true)
      const r = await getRuote()
      const conDisp = await calcolaDisponibilitaRuote(r.filter(s => s.Stato !== 'Eliminato'))
      setRuote(conDisp.filter(s => s.Quantita_Disponibile > 0))

      const init = {}
      atletiIscritti.forEach(a => {
        const cf = a.Codice_Fiscale || a.ID_Atleta
        init[cf] = { setId: '', quantita: '0' }
      })
      setAssegnazioni(init)
      setLoading(false)
    }
    setAperto(!aperto)
  }

  function aggiornaAssegnazione(cf, campo, valore) {
    setAssegnazioni(prev => ({
      ...prev,
      [cf]: { ...prev[cf], [campo]: valore }
    }))
  }

  async function handleSalvaTutte() {
    const daAssegnare = Object.entries(assegnazioni)
      .filter(([, dati]) => dati.setId && parseInt(dati.quantita) > 0)

    if (daAssegnare.length === 0) {
      alert('Nessuna assegnazione selezionata')
      return
    }

    // Verifica disponibilità per set
    const totalePerSet = {}
    daAssegnare.forEach(([, dati]) => {
      if (!totalePerSet[dati.setId]) totalePerSet[dati.setId] = 0
      totalePerSet[dati.setId] += parseInt(dati.quantita) || 0
    })

    for (const [setId, totale] of Object.entries(totalePerSet)) {
      const set = ruote.find(r => r.ID_Set === setId)
      if (set && totale > set.Quantita_Disponibile) {
        alert(`Ruote insufficienti per ${set.Nome || set.Diametro_mm + 'mm ' + set.Durezza_A}: richieste ${totale}, disponibili ${set.Quantita_Disponibile}`)
        return
      }
    }

    setSaving(true)
    try {
      let assegnati = 0
      for (const [cf, dati] of daAssegnare) {
        const atleta = atletiIscritti.find(a => (a.Codice_Fiscale || a.ID_Atleta) === cf)
        if (!atleta) continue

        await assegnaRuote(
          dati.setId,
          cf,
          `${atleta.Nome} ${atleta.Cognome}`,
          parseInt(dati.quantita),
          gara.Titolo || '',
          ''
        )
        assegnati++
      }

      alert(`Ruote assegnate a ${assegnati} atleti`)

      setAssegnazioni(prev => {
        const nuovo = { ...prev }
        daAssegnare.forEach(([cf]) => {
          nuovo[cf] = { setId: '', quantita: '0' }
        })
        return nuovo
      })

      const r = await getRuote()
      const conDisp = await calcolaDisponibilitaRuote(r.filter(s => s.Stato !== 'Eliminato'))
      setRuote(conDisp.filter(s => s.Quantita_Disponibile > 0))
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const atletiConRuote = Object.values(assegnazioni).filter(d => d.setId && parseInt(d.quantita) > 0).length

  return (
    <>
      <div className="section-title">Ruote per gara</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-ghost btn-full"
          onClick={apriPannello}
          style={{ fontSize: '13px' }}
        >
          {aperto ? 'Chiudi' : 'Assegna ruote agli iscritti'}
        </button>

        {aperto && (
          loading ? (
            <div style={{ padding: '12px', color: 'var(--text-secondary)' }}>Caricamento ruote...</div>
          ) : (
            <div style={{ marginTop: '12px' }}>
              {atletiIscritti.map(a => {
                const cf = a.Codice_Fiscale || a.ID_Atleta
                const dati = assegnazioni[cf] || { setId: '', quantita: '0' }

                return (
                  <div key={cf} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '6px' }}>
                      {a.Nome} {a.Cognome}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '12px', marginLeft: '8px' }}>
                        {a.Nome_Categoria || ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="form-input"
                        style={{ flex: 2, fontSize: '13px', padding: '6px 8px' }}
                        value={dati.setId}
                        onChange={e => aggiornaAssegnazione(cf, 'setId', e.target.value)}
                      >
                        <option value="">— Nessuna —</option>
                        {ruote.map(r => {
                          const prenotateAltri = Object.entries(assegnazioni).reduce((sum, [altroCf, altriDati]) => {
                            if (altroCf !== cf && altriDati.setId === r.ID_Set && altriDati.quantita) {
                              return sum + (parseInt(altriDati.quantita) || 0)
                            }
                            return sum
                          }, 0)
                          const dispReale = Math.max(0, r.Quantita_Disponibile - prenotateAltri)

                          return (
                            <option key={r.ID_Set} value={r.ID_Set} disabled={dispReale <= 0 && dati.setId !== r.ID_Set}>
                              {r.Nome ? `${r.Nome} (${dispReale} disp.)` : `${r.Diametro_mm}mm ${r.Durezza_A} (${dispReale} disp.)`}
                            </option>
                          )
                        })}
                      </select>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        max="20"
                        value={dati.quantita}
                        onChange={e => aggiornaAssegnazione(cf, 'quantita', e.target.value === '' ? '' : e.target.value)}
                        onBlur={e => {
                          if (e.target.value === '' || parseInt(e.target.value) < 0) {
                            aggiornaAssegnazione(cf, 'quantita', '0')
                          }
                        }}
                        style={{ width: '60px', fontSize: '13px', padding: '6px 8px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>ruote</span>
                    </div>
                  </div>
                )
              })}

              <button
                className="btn btn-primary btn-full"
                onClick={handleSalvaTutte}
                disabled={saving || atletiConRuote === 0}
                style={{ marginTop: '12px' }}
              >
                {saving ? 'Assegnazione...' : `Assegna ruote (${atletiConRuote} atleti)`}
              </button>
            </div>
          )
        )}
      </div>
    </>
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

// ============================================================
// NUOVO EVENTO
// ============================================================

function NuovoEvento({ onBack, onSaved }) {
  const [categorie, setCategorie] = useState([])
  const [saving, setSaving] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    titolo: '', dataInizio: '', oraInizio: '', dataFine: '', oraFine: '',
    tipo: 'Gara', luogo: '', idCategoria: [], scadIscrizione: '',
    scadPagamento: '', dataConvocati: '', documentiRichiesti: '', note: ''
  })

  useEffect(() => { getCategorie().then(setCategorie) }, [])

  const update = (campo, valore) => setForm(prev => ({ ...prev, [campo]: valore }))

  async function handleSalva() {
    if (!form.titolo.trim()) {
      setErrore('Il titolo è obbligatorio')
      return
    }
    setSaving(true)
    setErrore(null)
    try {
      await creaEvento({ ...form, idCategoria: form.idCategoria.join(',') })
      setSuccesso(true)
      setTimeout(() => onSaved(), 1500)
    } catch (err) {
      console.error(err)
      setErrore('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (successo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
        <div style={{ fontSize: '48px' }}>✅</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--accent-ok)' }}>Evento creato</div>
      </div>
    )
  }

  const categorieAttive = categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim()))

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Nuovo Evento</h1>
      </div>

      <div className="section-title">Informazioni</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Titolo *</label>
          <input className="form-input" value={form.titolo} onChange={e => update('titolo', e.target.value)} placeholder="Nome evento" />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={form.tipo} onChange={e => update('tipo', e.target.value)}>
            <option>Gara</option><option>Trasferta</option><option>Altro</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Luogo</label>
          <input className="form-input" value={form.luogo} onChange={e => update('luogo', e.target.value)} placeholder="es. Palaghiaccio Milano" />
        </div>
        <div className="form-group">
          <label className="form-label">Categorie (vuoto = tutte)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {categorieAttive.map(c => {
              const isSelected = form.idCategoria.includes(c.ID_Categoria)
              return (
                <button
                  key={c.ID_Categoria}
                  type="button"
                  className={`badge ${isSelected ? 'badge-danger' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '13px', border: 'none', transition: 'all 0.2s' }}
                  onClick={() => {
                    const catId = c.ID_Categoria
                    setForm(prev => {
                      const sel = prev.idCategoria.includes(catId)
                      return {
                        ...prev,
                        idCategoria: sel
                          ? prev.idCategoria.filter(id => id !== catId)
                          : [...prev.idCategoria, catId]
                      }
                    })
                  }}
                >
                  {isSelected ? '✓ ' : ''}{c.Nome}
                </button>
              )
            })}
          </div>
          {form.idCategoria.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '6px', fontSize: '12px', padding: '4px 8px' }}
              onClick={() => setForm(prev => ({ ...prev, idCategoria: [] }))}
            >
              Deseleziona tutte
            </button>
          )}
        </div>
      </div>

      <div className="section-title">Date e orari</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Data inizio</label>
          <input className="form-input" type="date" value={form.dataInizio} onChange={e => update('dataInizio', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ora inizio</label>
          <input className="form-input" type="time" value={form.oraInizio} onChange={e => update('oraInizio', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data fine</label>
          <input className="form-input" type="date" value={form.dataFine} onChange={e => update('dataFine', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ora fine</label>
          <input className="form-input" type="time" value={form.oraFine} onChange={e => update('oraFine', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Scadenze</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Scadenza iscrizione</label>
          <input className="form-input" type="date" value={form.scadIscrizione} onChange={e => update('scadIscrizione', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Scadenza pagamento</label>
          <input className="form-input" type="date" value={form.scadPagamento} onChange={e => update('scadPagamento', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data convocati</label>
          <input className="form-input" type="date" value={form.dataConvocati} onChange={e => update('dataConvocati', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Extra</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Documenti richiesti</label>
          <input className="form-input" value={form.documentiRichiesti} onChange={e => update('documentiRichiesti', e.target.value)} placeholder="es. Certificato medico, tessera FISR" />
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows="3" value={form.note} onChange={e => update('note', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>

      {errore && (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '8px' }}>
          <div style={{ color: '#FF6B7A', fontSize: '14px', textAlign: 'center' }}>{errore}</div>
        </div>
      )}

      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginTop: '12px', marginBottom: '24px' }}>
        {saving ? 'Salvataggio...' : 'Crea evento'}
      </button>
    </div>
  )
}

// ============================================================
// MODIFICA EVENTO
// ============================================================

function ModificaEvento({ evento, onBack, onSaved }) {
  const [categorie, setCategorie] = useState([])
  const [saving, setSaving] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    titolo: evento.Titolo || '',
    dataInizio: evento.Data_Inizio || '',
    oraInizio: evento.Ora_Inizio || '',
    dataFine: evento.Data_Fine || '',
    oraFine: evento.Ora_Fine || '',
    tipo: evento.Tipo || 'Gara',
    luogo: evento.Luogo || '',
    idCategoria: evento.ID_Categoria ? evento.ID_Categoria.split(',').filter(Boolean) : [],
    scadIscrizione: evento.Scad_Iscrizione || '',
    scadPagamento: evento.Scad_Pagamento || '',
    dataConvocati: evento.Data_Convocati || '',
    documentiRichiesti: evento.Documenti_Richiesti || '',
    note: evento.Note || ''
  })

  useEffect(() => { getCategorie().then(setCategorie) }, [])

  const update = (campo, valore) => setForm(prev => ({ ...prev, [campo]: valore }))

  async function handleSalva() {
    if (!form.titolo.trim()) {
      setErrore('Il titolo è obbligatorio')
      return
    }
    setSaving(true)
    setErrore(null)
    try {
      await aggiornaEvento({
        ID_Evento: evento.ID_Evento,
        Titolo: form.titolo,
        Data_Inizio: form.dataInizio,
        Ora_Inizio: form.oraInizio,
        Data_Fine: form.dataFine,
        Ora_Fine: form.oraFine,
        Tipo: form.tipo,
        Luogo: form.luogo,
        ID_Categoria: form.idCategoria.join(','),
        Scad_Iscrizione: form.scadIscrizione,
        Scad_Pagamento: form.scadPagamento,
        Data_Convocati: form.dataConvocati,
        Documenti_Richiesti: form.documentiRichiesti,
        Iscritti: evento.Iscritti || '',
        Stato_Pagamento_Gara: evento.Stato_Pagamento_Gara || 'Da pagare',
        Note: form.note,
        Partecipazione: evento.Partecipazione || 'FALSE',
        Iscrizione_Comunicata: evento.Iscrizione_Comunicata || 'FALSE',
        Drive_Folder_Gara: evento.Drive_Folder_Gara || ''
      })
      setSuccesso(true)
      setTimeout(() => onSaved(), 1500)
    } catch (err) {
      console.error(err)
      setErrore('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (successo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
        <div style={{ fontSize: '48px' }}>✅</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--accent-ok)' }}>Evento modificato</div>
      </div>
    )
  }

  const categorieAttive = categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim()))

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Modifica Evento</h1>
      </div>

      <div className="card card-elevated" style={{ marginBottom: '16px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{evento.ID_Evento}</div>
      </div>

      <div className="section-title">Informazioni</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Titolo *</label>
          <input className="form-input" value={form.titolo} onChange={e => update('titolo', e.target.value)} placeholder="Nome evento" />
        </div>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={form.tipo} onChange={e => update('tipo', e.target.value)}>
            <option>Gara</option><option>Trasferta</option><option>Altro</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Luogo</label>
          <input className="form-input" value={form.luogo} onChange={e => update('luogo', e.target.value)} placeholder="es. Palaghiaccio Milano" />
        </div>
        <div className="form-group">
          <label className="form-label">Categorie (vuoto = tutte)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {categorieAttive.map(c => {
              const isSelected = form.idCategoria.includes(c.ID_Categoria)
              return (
                <button
                  key={c.ID_Categoria}
                  type="button"
                  className={`badge ${isSelected ? 'badge-danger' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '13px', border: 'none', transition: 'all 0.2s' }}
                  onClick={() => {
                    const catId = c.ID_Categoria
                    setForm(prev => {
                      const sel = prev.idCategoria.includes(catId)
                      return {
                        ...prev,
                        idCategoria: sel
                          ? prev.idCategoria.filter(id => id !== catId)
                          : [...prev.idCategoria, catId]
                      }
                    })
                  }}
                >
                  {isSelected ? '✓ ' : ''}{c.Nome}
                </button>
              )
            })}
          </div>
          {form.idCategoria.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '6px', fontSize: '12px', padding: '4px 8px' }}
              onClick={() => setForm(prev => ({ ...prev, idCategoria: [] }))}
            >
              Deseleziona tutte
            </button>
          )}
        </div>
      </div>

      <div className="section-title">Date e orari</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Data inizio</label>
          <input className="form-input" type="date" value={form.dataInizio} onChange={e => update('dataInizio', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ora inizio</label>
          <input className="form-input" type="time" value={form.oraInizio} onChange={e => update('oraInizio', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data fine</label>
          <input className="form-input" type="date" value={form.dataFine} onChange={e => update('dataFine', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Ora fine</label>
          <input className="form-input" type="time" value={form.oraFine} onChange={e => update('oraFine', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Scadenze</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Scadenza iscrizione</label>
          <input className="form-input" type="date" value={form.scadIscrizione} onChange={e => update('scadIscrizione', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Scadenza pagamento</label>
          <input className="form-input" type="date" value={form.scadPagamento} onChange={e => update('scadPagamento', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data convocati</label>
          <input className="form-input" type="date" value={form.dataConvocati} onChange={e => update('dataConvocati', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Extra</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Documenti richiesti</label>
          <input className="form-input" value={form.documentiRichiesti} onChange={e => update('documentiRichiesti', e.target.value)} placeholder="es. Certificato medico, tessera FISR" />
        </div>
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows="3" value={form.note} onChange={e => update('note', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>

      {errore && (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '8px' }}>
          <div style={{ color: '#FF6B7A', fontSize: '14px', textAlign: 'center' }}>{errore}</div>
        </div>
      )}

      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginTop: '12px', marginBottom: '24px' }}>
        {saving ? 'Salvataggio...' : 'Salva modifiche'}
      </button>
    </div>
  )
}

// ============================================================
// LISTA DOCUMENTI GARA (Drive)
// ============================================================

function ListaDocumentiGara({ driveFolderId }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!driveFolderId) return
    setLoading(true)
    const token = localStorage.getItem('gapi_token')
    fetch(`https://www.googleapis.com/drive/v3/files?q='${driveFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { setDocs(data.files || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [driveFolderId])

  if (!driveFolderId || loading) return null
  if (docs.length === 0) return null

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
        Documenti caricati
      </div>
      {docs.map(d => (
        <a
          key={d.id}
          href={d.webViewLink}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 0', textDecoration: 'none',
            borderBottom: '1px solid var(--border)', fontSize: '13px'
          }}
        >
          <span>📄</span>
          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{d.name}</span>
          <span style={{ color: 'var(--accent)', fontSize: '12px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Apri →</span>
        </a>
      ))}
    </div>
  )
}
