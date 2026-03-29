import { useState, useEffect } from 'react'
import { getAtleti, getPattini, getCategorie, creaAtleta, assegnaPattino, aggiungiRiga, aggiornaRiga, aggiornaCategoria, listaDocumentiAtleta, caricaDocumento, eliminaDocumento, creaCartellaAtleta, scriviLog, getPagamentiAtleta, aggiornaPagamento, generaQuoteAtleta, restituisciPattino, aggiornaPattino, creaPagamento, aggiornaCategorieBatch, trovaCategoriaPerNascita, aggiornaAtletaSicuro, creaCartelleMancanti, getDataPrimoNoleggio, calcolaAnnoInizioStagione, leggiSheet, getConfigurazione, getStoricoScadenze, salvaStoricoScadenza } from '../utils/sheetsApi'
import { SHEETS } from '../config/google'
import { formattaData, statoScadenza, giorniAllaScadenza } from '../utils/dateUtils'
import { esportaAtletiExcel, esportaAtletiPDF } from '../utils/exportUtils'

export default function Atleti({ nav }) {
  const [atleti, setAtleti] = useState([])
  const [pattini, setPattini] = useState([])
  const [categorie, setCategorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('tutte')
  const [filtroSesso, setFiltroSesso] = useState('tutti')
  const [mostraExport, setMostraExport] = useState(false)
  const [atletaSelezionato, setAtletaSelezionato] = useState(null)
  const [vista, setVista] = useState('lista') // 'lista' | 'nuovo' | 'categorie' | 'modifica'
  const [tipoVista, setTipoVista] = useState(null) // null | 'Agonista' | 'Non agonista'

  function navigaVista(nuovaVista, atleta) {
    nav.avanti({ tab: 'atleti', vista: nuovaVista })
    if (atleta !== undefined) setAtletaSelezionato(atleta)
    setVista(nuovaVista)
  }

  // Reagisci al tasto indietro (stack pop)
  useEffect(() => {
    const stato = nav.stato
    if (stato.tab !== 'atleti') return
    if (!stato.vista) {
      setVista('lista')
      setTipoVista(null)
      setAtletaSelezionato(null)
    } else if (stato.vista === 'lista') {
      setVista('lista')
      setAtletaSelezionato(null)
    } else if (stato.vista === 'scheda') {
      setVista('scheda')
    }
  }, [nav.stato])

  // Navigazione da Dashboard (tipoVista o filtro nel nav.stato iniziale)
  useEffect(() => {
    const stato = nav.stato
    if (stato.tab === 'atleti' && stato.tipoVista) {
      setTipoVista(stato.tipoVista)
    }
    if (stato.tab === 'atleti' && stato.filtro === 'noleggio_da_pagare') {
      setVista('noleggio_da_pagare')
    }
  }, [])

  function ricarica() {
    setLoading(true)
    Promise.all([getAtleti(), getPattini(), getCategorie()]).then(([a, p, c]) => {
      setAtleti(a)
      setPattini(p)
      setCategorie(c)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento atleti...</div>

  if (vista === 'nuovo') {
    return <NuovoAtleta tipoVista={tipoVista} onBack={() => nav.indietro()} onSaved={() => {
      setVista('lista')
      ricarica()
    }} />
  }

  if (vista === 'categorie') {
    return <GestioneCategorie onBack={() => nav.indietro()} />
  }

  if (vista === 'modifica' && atletaSelezionato) {
    return <ModificaAtleta
      atleta={atletaSelezionato}
      atleti={atleti}
      onBack={() => nav.indietro()}
      onSaved={() => {
        setVista('lista')
        setAtletaSelezionato(null)
        ricarica()
      }}
    />
  }

  if ((vista === 'scheda' || atletaSelezionato) && atletaSelezionato) {
    return (
      <SchedaAtleta
        atleta={atletaSelezionato}
        atleti={atleti}
        pattini={pattini}
        nav={nav}
        onBack={() => nav.indietro()}
        onModifica={() => navigaVista('modifica')}
        onDisattivato={() => { setAtletaSelezionato(null); setVista('lista'); ricarica() }}
      />
    )
  }

  if (vista === 'noleggio_da_pagare') {
    return <NoleggioNonPagati nav={nav} />
  }

  // Landing page — scelta agonisti / non agonisti
  if (!tipoVista) {
    const atletiAttivi = atleti.filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
    const agonisti = atletiAttivi.filter(a => (a.Tipo_Atleta || 'Agonista') === 'Agonista')
    const nonAgonisti = atletiAttivi.filter(a => a.Tipo_Atleta === 'Non agonista')

    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Atleti</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => navigaVista('categorie')} style={{ padding: '6px 12px', fontSize: '13px' }}>Categorie</button>
            <button className="btn btn-primary" onClick={() => navigaVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="card"
            onClick={() => { setTipoVista('Agonista'); nav.avanti({ tab: 'atleti', vista: 'lista', tipoVista: 'Agonista' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', width: '100%' }}
          >
            <span style={{ fontSize: '36px' }}>🏅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase' }}>Agonisti</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Giovanissimi → Seniores</div>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700', color: 'var(--accent)' }}>{agonisti.length}</div>
          </button>
          <button
            className="card"
            onClick={() => { setTipoVista('Non agonista'); nav.avanti({ tab: 'atleti', vista: 'lista', tipoVista: 'Non agonista' }) }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', width: '100%' }}
          >
            <span style={{ fontSize: '36px' }}>🎿</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase' }}>Non agonisti</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Primi Passi / Amatori</div>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700', color: 'var(--accent)' }}>{nonAgonisti.length}</div>
          </button>
        </div>
      </div>
    )
  }

  const categorieAttive = categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim()))

  // Nomi categoria unici (senza sesso) per il filtro
  const nomiCategoriaUnici = [...new Set(categorieAttive.filter(c => (c.Tipo || '').trim() === tipoVista).map(c => c.Nome?.replace(/ [MF]$/, '')))]

  const atletiFiltrati = atleti
    .filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
    .filter(a => (a.Tipo_Atleta || 'Agonista') === tipoVista)
    .filter(a => filtroSesso === 'tutti' || a.Sesso === filtroSesso)
    .filter(a => filtroCategoria === 'tutte' || a.Nome_Categoria === filtroCategoria || a.Nome_Categoria?.replace(/ [MF]$/, '') === filtroCategoria)
    .filter(a => {
      const nome = `${a.Nome} ${a.Cognome}`.toLowerCase()
      return nome.includes(cerca.toLowerCase())
    })

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => nav.indietro()} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>{tipoVista === 'Agonista' ? 'Agonisti' : 'Non agonisti'}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost" onClick={() => setMostraExport(!mostraExport)} style={{ padding: '6px 12px', fontSize: '13px' }}>
              📥 Esporta
            </button>
            {mostraExport && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '100px' }}>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '13px', justifyContent: 'flex-start' }} onClick={() => { esportaAtletiExcel(atleti); setMostraExport(false) }}>Excel</button>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '13px', justifyContent: 'flex-start' }} onClick={() => { esportaAtletiPDF(atleti); setMostraExport(false) }}>PDF</button>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={() => navigaVista('categorie')} style={{ padding: '6px 12px', fontSize: '13px' }}>
            Categorie
          </button>
          <button className="btn btn-primary" onClick={() => navigaVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>
            +
          </button>
        </div>
      </div>

      <div className="search-bar">
        <SearchIcon />
        <input
          placeholder="Cerca atleta..."
          value={cerca}
          onChange={e => setCerca(e.target.value)}
        />
      </div>

      {/* Filtro sesso */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {['tutti', 'M', 'F'].map(s => (
          <button
            key={s}
            className={`btn ${filtroSesso === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltroSesso(filtroSesso === s ? 'tutti' : s)}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >{s === 'tutti' ? 'Tutti' : s === 'M' ? 'Maschi' : 'Femmine'}</button>
        ))}
      </div>

      {/* Filtro categorie */}
      {categorieAttive.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${filtroCategoria === 'tutte' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltroCategoria('tutte')}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >Tutte</button>
          {nomiCategoriaUnici.map(nome => (
            <button
              key={nome}
              className={`btn ${filtroCategoria === nome ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltroCategoria(filtroCategoria === nome ? 'tutte' : nome)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >{nome}</button>
          ))}
        </div>
      )}

      <div className="card">
        {atletiFiltrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-text">Nessun atleta trovato</div>
          </div>
        ) : (
          atletiFiltrati.map(a => (
            <AtletaRow key={a.ID_Atleta} atleta={a} onClick={() => navigaVista('scheda', a)} />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// FORM ATLETA (condiviso tra Nuovo e Modifica)
// ============================================================

function FormAtleta({ form, update, categorie, titolo, onBack, onSalva, saving, errore, mostraNoleggio = true }) {
  const [config, setConfig] = useState({})
  useEffect(() => { getConfigurazione().then(setConfig) }, [])
  const quotaAnnuale = parseFloat(config.Quota_Annuale) || 300

  // Auto-preseleziona categoria per anno nascita
  useEffect(() => {
    if (form.dataNascita && form.sesso && form.tipoAtleta && categorie.length > 0) {
      const annoNascita = new Date(form.dataNascita).getFullYear()
      const cat = trovaCategoriaPerNascita(annoNascita, form.sesso, form.tipoAtleta, categorie)
      if (cat) {
        update('idCategoria', cat.ID_Categoria)
      }
    }
  }, [form.dataNascita, form.sesso, form.tipoAtleta, categorie])

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>{titolo}</h1>
      </div>

      {titolo === 'Nuovo Atleta' && (
        <>
          <div className="section-title">Tipo atleta</div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`badge ${form.tipoAtleta === 'Agonista' ? 'badge-danger' : 'badge-muted'}`}
                style={{ cursor: 'pointer', padding: '10px 20px', fontSize: '15px', border: 'none', flex: 1, justifyContent: 'center' }}
                onClick={() => update('tipoAtleta', 'Agonista')}
              >
                🏅 Agonista
              </button>
              <button
                type="button"
                className={`badge ${form.tipoAtleta === 'Non agonista' ? 'badge-danger' : 'badge-muted'}`}
                style={{ cursor: 'pointer', padding: '10px 20px', fontSize: '15px', border: 'none', flex: 1, justifyContent: 'center' }}
                onClick={() => update('tipoAtleta', 'Non agonista')}
              >
                🎿 Non agonista
              </button>
            </div>
          </div>
        </>
      )}

      <div className="section-title">Dati personali</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Nome *</label>
          <input className="form-input" value={form.nome} onChange={e => update('nome', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Cognome *</label>
          <input className="form-input" value={form.cognome} onChange={e => update('cognome', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Sesso *</label>
          <select className="form-input" value={form.sesso} onChange={e => update('sesso', e.target.value)}>
            <option value="">— Seleziona —</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Luogo di nascita</label>
          <input className="form-input" value={form.luogoNascita} onChange={e => update('luogoNascita', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data di nascita</label>
          <input className="form-input" type="date" value={form.dataNascita} onChange={e => update('dataNascita', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Codice fiscale</label>
          <input className="form-input" value={form.codiceFiscale} onChange={e => update('codiceFiscale', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-input" value={form.idCategoria} onChange={e => update('idCategoria', e.target.value)}>
            <option value="">— Seleziona —</option>
            {categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim()) && (!form.tipoAtleta || (c.Tipo || '').trim() === form.tipoAtleta)).map(c => (
              <option key={c.ID_Categoria} value={c.ID_Categoria}>{c.Nome}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Numero di gara</label>
          <input className="form-input" value={form.numeroGara} onChange={e => update('numeroGara', e.target.value)} placeholder="es. 42" />
        </div>
      </div>

      <div className="section-title">Quota associativa</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Importo quota (vuoto = {form.tipoAtleta === 'Non agonista' ? '€0 (accordo comunale)' : `standard €${quotaAnnuale}`})</label>
          <input className="form-input" type="number" value={form.quotaPersonalizzata} onChange={e => update('quotaPersonalizzata', e.target.value)} placeholder={`${form.tipoAtleta === 'Non agonista' ? '0' : quotaAnnuale}`} />
        </div>
        {titolo === 'Nuovo Atleta' && (
          <>
            <div className="form-group">
              <label className="form-label">Modalità pagamento</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`badge ${form.tipoRate === '1' ? 'badge-danger' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '14px', border: 'none', flex: 1, justifyContent: 'center' }}
                  onClick={() => update('tipoRate', '1')}
                >
                  Annuale
                </button>
                <button
                  type="button"
                  className={`badge ${form.tipoRate === '2' ? 'badge-danger' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '14px', border: 'none', flex: 1, justifyContent: 'center' }}
                  onClick={() => update('tipoRate', '2')}
                >
                  2 rate
                </button>
              </div>
            </div>
            {form.tipoRate === '1' && (
              <div className="form-group">
                <label className="form-label">Scadenza rata unica</label>
                <input className="form-input" type="date" value={form.scadRata1} onChange={e => update('scadRata1', e.target.value)} />
              </div>
            )}
            {form.tipoRate === '2' && (
              <>
                <div className="form-group">
                  <label className="form-label">Scadenza rata 1</label>
                  <input className="form-input" type="date" value={form.scadRata1} onChange={e => update('scadRata1', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Scadenza rata 2</label>
                  <input className="form-input" type="date" value={form.scadRata2} onChange={e => update('scadRata2', e.target.value)} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="section-title">Contatti genitore</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Nome genitore</label>
          <input className="form-input" value={form.genitoreNome} onChange={e => update('genitoreNome', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Telefono</label>
          <input className="form-input" type="tel" value={form.genitoreTelefono} onChange={e => update('genitoreTelefono', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.genitoreEmail} onChange={e => update('genitoreEmail', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Scadenze</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Scadenza certificato medico</label>
          <input className="form-input" type="date" value={form.scadCertificato} onChange={e => update('scadCertificato', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Numero tessera FISR</label>
          <input className="form-input" value={form.numeroFISR} onChange={e => update('numeroFISR', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Scadenza FISR</label>
          <input className="form-input" type="date" value={form.scadFISR} onChange={e => update('scadFISR', e.target.value)} />
        </div>
      </div>

      <div className="section-title">Altro</div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Data iscrizione</label>
          <input className="form-input" type="date" value={form.dataIscrizione} onChange={e => update('dataIscrizione', e.target.value)} />
        </div>
      </div>

      {mostraNoleggio && (
        <>
          <div className="section-title">Noleggio pattini</div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.noleggio ? '12px' : 0 }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>Noleggio pattino</span>
              <button
                className={`badge ${form.noleggio ? 'badge-ok' : 'badge-muted'}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => update('noleggio', !form.noleggio)}
              >
                {form.noleggio ? 'SI' : 'NO'}
              </button>
            </div>
            {form.noleggio && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Taglia</label>
                <input className="form-input" type="number" placeholder="es. 38" value={form.taglia} onChange={e => update('taglia', e.target.value)} />
              </div>
            )}
          </div>
        </>
      )}

      <div className="section-title">Note</div>
      <div className="card">
        <textarea className="form-input" rows="3" value={form.note} onChange={e => update('note', e.target.value)} style={{ resize: 'vertical' }} />
      </div>

      {errore && (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '8px' }}>
          <div style={{ color: '#FF6B7A', fontSize: '14px', textAlign: 'center' }}>{errore}</div>
        </div>
      )}

      <button className="btn btn-primary btn-full" onClick={onSalva} disabled={saving} style={{ marginTop: '12px', marginBottom: '24px' }}>
        {saving ? 'Salvataggio...' : titolo === 'Nuovo Atleta' ? 'Salva atleta' : 'Salva modifiche'}
      </button>
    </div>
  )
}

// ============================================================
// NUOVO ATLETA
// ============================================================

function NuovoAtleta({ tipoVista, onBack, onSaved }) {
  const [categorie, setCategorie] = useState([])
  const [saving, setSaving] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [errore, setErrore] = useState(null)
  const [config, setConfig] = useState({})
  const quotaAnnuale = parseFloat(config.Quota_Annuale) || 300
  const [form, setForm] = useState({
    nome: '', cognome: '', sesso: '', luogoNascita: '', dataNascita: '', codiceFiscale: '',
    idCategoria: '', genitoreNome: '', genitoreTelefono: '',
    genitoreEmail: '', scadCertificato: '', numeroFISR: '',
    scadFISR: '', dataIscrizione: new Date().toISOString().split('T')[0],
    note: '', noleggio: false, taglia: '', numeroGara: '',
    quotaPersonalizzata: '', tipoRate: '1',
    scadRata1: `${new Date().getFullYear()}-10-15`,
    scadRata2: `${new Date().getFullYear() + 1}-01-15`,
    tipoAtleta: tipoVista || 'Agonista'
  })

  useEffect(() => {
    getCategorie().then(setCategorie)
    getConfigurazione().then(setConfig)
  }, [])

  const update = (campo, valore) => setForm(prev => ({ ...prev, [campo]: valore }))

  async function handleSalva() {
    if (!form.nome.trim() || !form.cognome.trim() || !form.sesso) {
      setErrore('Nome, Cognome e Sesso sono obbligatori')
      return
    }
    setSaving(true)
    setErrore(null)
    try {
      const nomeCategoria = categorie.find(c => c.ID_Categoria === form.idCategoria)?.Nome || ''
      const idAtleta = await creaAtleta({ ...form, nomeCategoria })

      // Crea cartella Drive e aggiorna riga atleta
      try {
        const driveFolderId = await creaCartellaAtleta({ Nome: form.nome, Cognome: form.cognome, ID_Atleta: idAtleta })
        if (driveFolderId) {
          await aggiornaAtletaSicuro(idAtleta, { Drive_Folder_ID: driveFolderId })
        }
      } catch (err) {
        console.error('Errore creazione cartella Drive:', err)
      }

      if (form.noleggio && form.taglia) {
        const pattini = await getPattini()
        const libero = pattini.find(p => !p.ID_Atleta && p.Taglia === form.taglia && p.Stato !== 'Rotto')
        if (libero) {
          await assegnaPattino(libero.ID_Pattino, idAtleta, form.dataIscrizione)
        }
      }

      // Genera quote associative
      const importoQuota = form.quotaPersonalizzata
        ? parseFloat(form.quotaPersonalizzata)
        : (form.tipoAtleta === 'Non agonista' ? 0 : quotaAnnuale)
      const anno = new Date().getFullYear()
      const stagione = `${anno}/${anno + 1}`
      if (importoQuota > 0) {
        if (form.tipoRate === '1') {
          await creaPagamento({
            idAtleta,
            nomeAtleta: `${form.nome} ${form.cognome}`,
            tipo: 'Quota',
            descrizione: `Quota associativa ${stagione}`,
            importo: importoQuota,
            stato: 'Da pagare',
            dataScadenza: form.scadRata1,
          })
        } else {
          const metaImporto = Math.ceil(importoQuota / 2)
          await creaPagamento({
            idAtleta,
            nomeAtleta: `${form.nome} ${form.cognome}`,
            tipo: 'Quota',
            descrizione: `Quota ${stagione} — Rata 1/2`,
            importo: metaImporto,
            stato: 'Da pagare',
            dataScadenza: form.scadRata1,
          })
          await creaPagamento({
            idAtleta,
            nomeAtleta: `${form.nome} ${form.cognome}`,
            tipo: 'Quota',
            descrizione: `Quota ${stagione} — Rata 2/2`,
            importo: importoQuota - metaImporto,
            stato: 'Da pagare',
            dataScadenza: form.scadRata2,
          })
        }
        await scriviLog('Quote generate', 'Atleta', `${form.nome} ${form.cognome}`)
      }

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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--accent-ok)' }}>Atleta creato</div>
      </div>
    )
  }

  return <FormAtleta form={form} update={update} categorie={categorie} titolo="Nuovo Atleta" onBack={onBack} onSalva={handleSalva} saving={saving} errore={errore} />
}

// ============================================================
// MODIFICA ATLETA
// ============================================================

function ModificaAtleta({ atleta, atleti, onBack, onSaved }) {
  const [categorie, setCategorie] = useState([])
  const [saving, setSaving] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    nome: atleta.Nome || '',
    cognome: atleta.Cognome || '',
    sesso: atleta.Sesso || '',
    luogoNascita: atleta.Luogo_Nascita || '',
    dataNascita: atleta.Data_Nascita || '',
    codiceFiscale: atleta.Codice_Fiscale || '',
    idCategoria: atleta.ID_Categoria || '',
    genitoreNome: atleta.Genitore_Nome || '',
    genitoreTelefono: atleta.Genitore_Telefono || '',
    genitoreEmail: atleta.Genitore_Email || '',
    scadCertificato: atleta.Scad_Certificato || '',
    numeroFISR: atleta.Numero_FISR || '',
    scadFISR: atleta.Scad_FISR || '',
    dataIscrizione: atleta.Data_Iscrizione || '',
    note: atleta.Note || '',
    noleggio: false, taglia: '',
    numeroGara: atleta.Numero_Gara || '',
    quotaPersonalizzata: atleta.Quota_Personalizzata || ''
  })

  useEffect(() => { getCategorie().then(setCategorie) }, [])

  const update = (campo, valore) => setForm(prev => ({ ...prev, [campo]: valore }))

  async function handleSalva() {
    if (!form.nome.trim() || !form.cognome.trim() || !form.sesso) {
      setErrore('Nome, Cognome e Sesso sono obbligatori')
      return
    }
    setSaving(true)
    setErrore(null)
    try {
      await aggiornaAtletaSicuro(atleta.ID_Atleta, {
        Nome: form.nome, Cognome: form.cognome, Sesso: form.sesso,
        Luogo_Nascita: form.luogoNascita, Data_Nascita: form.dataNascita,
        Codice_Fiscale: form.codiceFiscale, ID_Categoria: form.idCategoria,
        Genitore_Nome: form.genitoreNome, Nome_Categoria: atleta.Nome_Categoria || '',
        Genitore_Telefono: form.genitoreTelefono, Genitore_Email: form.genitoreEmail,
        Scad_Certificato: form.scadCertificato, Scad_FISR: form.scadFISR,
        Numero_FISR: form.numeroFISR, Data_Iscrizione: form.dataIscrizione,
        Note: form.note, Numero_Gara: form.numeroGara,
        Quota_Personalizzata: form.quotaPersonalizzata
      })
      await scriviLog('Modifica', 'Atleta', `${form.nome} ${form.cognome}`)
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--accent-ok)' }}>Modifiche salvate</div>
      </div>
    )
  }

  return <FormAtleta form={form} update={update} categorie={categorie} titolo="Modifica Atleta" onBack={onBack} onSalva={handleSalva} saving={saving} errore={errore} mostraNoleggio={false} />
}

// ============================================================
// GESTIONE CATEGORIE
// ============================================================

function FormCategoria({ form, setForm, onSalva, saving, labelBottone }) {
  const update = (campo, valore) => setForm(prev => ({ ...prev, [campo]: valore }))
  return (
    <>
      <div className="form-group">
        <label className="form-label">Nome *</label>
        <input className="form-input" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="es. Esordienti M" />
      </div>
      <div className="form-group">
        <label className="form-label">Fascia eta (descrizione)</label>
        <input className="form-input" value={form.fasciaEta} onChange={e => update('fasciaEta', e.target.value)} placeholder="es. 9-10 anni" />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Eta min</label>
          <input className="form-input" type="number" value={form.etaMin} onChange={e => update('etaMin', e.target.value)} placeholder="9" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Eta max</label>
          <input className="form-input" type="number" value={form.etaMax} onChange={e => update('etaMax', e.target.value)} placeholder="10" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Sesso</label>
        <select className="form-input" value={form.sesso} onChange={e => update('sesso', e.target.value)}>
          <option value="">— Nessuno —</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Tipi gara</label>
        <input className="form-input" value={form.tipiGara} onChange={e => update('tipiGara', e.target.value)} placeholder="es. Velocita, Fondo" />
      </div>
      <div className="form-group">
        <label className="form-label">Metodo calcolo</label>
        <input className="form-input" value={form.metodoCalcolo} onChange={e => update('metodoCalcolo', e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span className="form-label" style={{ marginBottom: 0 }}>Attiva</span>
        <button
          className={`badge ${form.attiva ? 'badge-ok' : 'badge-muted'}`}
          style={{ cursor: 'pointer', border: 'none' }}
          onClick={() => update('attiva', !form.attiva)}
        >
          {form.attiva ? 'SI' : 'NO'}
        </button>
      </div>
      <button className="btn btn-primary btn-full" onClick={onSalva} disabled={saving || !form.nome.trim()}>
        {saving ? 'Salvataggio...' : labelBottone}
      </button>
    </>
  )
}

function GestioneCategorie({ onBack }) {
  const [categorie, setCategorie] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editIdx, setEditIdx] = useState(null) // indice categoria in modifica
  const [editForm, setEditForm] = useState(null)
  const [nuovoForm, setNuovoForm] = useState({
    nome: '', fasciaEta: '', etaMin: '', etaMax: '', sesso: '', tipiGara: '', metodoCalcolo: '', attiva: true
  })

  function ricarica() {
    setLoading(true)
    getCategorie().then(c => { setCategorie(c); setLoading(false) })
  }

  useEffect(() => { ricarica() }, [])

  function apriModifica(c, idx) {
    setEditIdx(idx)
    setEditForm({
      idCategoria: c.ID_Categoria,
      nome: c.Nome || '',
      fasciaEta: c.Fascia_Eta || '',
      etaMin: c.Età_Min || '',
      etaMax: c.Età_Max || '',
      sesso: c.Sesso || '',
      tipiGara: c.Tipi_Gara || '',
      metodoCalcolo: c.Metodo_Calcolo || '',
      attiva: c.Attiva === 'TRUE'
    })
  }

  async function handleSalvaModifica() {
    if (!editForm.nome.trim()) return
    setSaving(true)
    try {
      await aggiornaCategoria(editIdx, {
        ID_Categoria: editForm.idCategoria,
        Nome: editForm.nome.trim(),
        Fascia_Eta: editForm.fasciaEta.trim(),
        Eta_Min: editForm.etaMin,
        Eta_Max: editForm.etaMax,
        Sesso: editForm.sesso,
        Tipi_Gara: editForm.tipiGara,
        Metodo_Calcolo: editForm.metodoCalcolo,
        Attiva: editForm.attiva
      })
      await scriviLog('Modifica', 'Categoria', editForm.nome.trim())
      setEditIdx(null)
      setEditForm(null)
      ricarica()
    } finally {
      setSaving(false)
    }
  }

  async function handleAggiungi() {
    if (!nuovoForm.nome.trim()) return
    setSaving(true)
    try {
      const numero = categorie.length + 1
      const id = `CAT-${String(numero).padStart(2, '0')}`
      // Ordine colonne foglio: ID_Categoria, Nome, Fascia_Eta, Attiva, Età_Min, Età_Max, Sesso, Tipi_Gara, Metodo_Calcolo
      await aggiungiRiga(SHEETS.CATEGORIE, [
        id, nuovoForm.nome.trim(), nuovoForm.fasciaEta.trim(),
        nuovoForm.attiva ? 'TRUE' : 'FALSE',
        nuovoForm.etaMin, nuovoForm.etaMax, nuovoForm.sesso,
        nuovoForm.tipiGara, nuovoForm.metodoCalcolo
      ])
      setNuovoForm({ nome: '', fasciaEta: '', etaMin: '', etaMax: '', sesso: '', tipiGara: '', metodoCalcolo: '', attiva: true })
      ricarica()
    } finally {
      setSaving(false)
    }
  }

  if (editIdx !== null && editForm) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-ghost" onClick={() => { setEditIdx(null); setEditForm(null) }} style={{ padding: '8px 12px' }}>← Indietro</button>
          <h1 className="page-title" style={{ fontSize: '22px' }}>Modifica Categoria</h1>
        </div>
        <div className="card">
          <FormCategoria form={editForm} setForm={setEditForm} onSalva={handleSalvaModifica} saving={saving} labelBottone="Salva modifiche" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Categorie</h1>
      </div>

      {loading ? (
        <div className="loading-center">Caricamento...</div>
      ) : (
        <>
          <div className="card">
            {categorie.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">Nessuna categoria</div>
              </div>
            ) : (
              categorie.map((c, i) => (
                <div key={c.ID_Categoria} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{c.Nome}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {c.Fascia_Eta || ''}
                      {c.Età_Min && c.Età_Max ? ` (${c.Età_Min}-${c.Età_Max} anni)` : ''}
                      {c.Sesso ? ` · ${c.Sesso}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span className={`badge ${['TRUE', 'true', 'True'].includes(c.Attiva?.trim()) ? 'badge-ok' : 'badge-danger'}`}>
                      {['TRUE', 'true', 'True'].includes(c.Attiva?.trim()) ? 'Attiva' : 'Non attiva'}
                    </span>
                    <button className="btn btn-ghost" onClick={() => apriModifica(c, i)} style={{ padding: '4px 6px', fontSize: '13px', lineHeight: 1 }}>✏️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="section-title">Aggiungi categoria</div>
          <div className="card">
            <FormCategoria form={nuovoForm} setForm={setNuovoForm} onSalva={handleAggiungi} saving={saving} labelBottone="Aggiungi" />
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// RIGA ATLETA
// ============================================================

function AtletaRow({ atleta, onClick }) {
  const iniziali = `${atleta.Nome?.[0] ?? ''}${atleta.Cognome?.[0] ?? ''}`

  return (
    <div className="atleta-row" onClick={onClick}>
      <div className="atleta-avatar" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>{iniziali}</div>
      <div className="atleta-info" style={{ flex: 1 }}>
        <div className="atleta-nome">{atleta.Nome} {atleta.Cognome}</div>
        {atleta.Nome_Categoria && <div className="atleta-sub">{atleta.Nome_Categoria}</div>}
        {(() => {
          const badges = []
          const statoCert = statoScadenza(atleta.Scad_Certificato)
          const statoFisr = statoScadenza(atleta.Scad_FISR)
          const giorniCert = giorniAllaScadenza(atleta.Scad_Certificato)
          const giorniFisr = giorniAllaScadenza(atleta.Scad_FISR)

          if (statoCert === 'scaduto') badges.push({ label: 'Scaduto Cert. medico', classe: 'badge-danger' })
          else if (statoCert === 'urgente') badges.push({ label: `${giorniCert}gg Cert. medico`, classe: 'badge-urgente' })
          else if (statoCert === 'in_scadenza') badges.push({ label: `${giorniCert}gg Cert. medico`, classe: 'badge-warn' })
          else if (statoCert === 'mancante') badges.push({ label: 'Cert. medico mancante', classe: 'badge-danger' })

          if (statoFisr === 'scaduto') badges.push({ label: 'Scaduto FISR', classe: 'badge-danger' })
          else if (statoFisr === 'urgente') badges.push({ label: `${giorniFisr}gg FISR`, classe: 'badge-urgente' })
          else if (statoFisr === 'in_scadenza') badges.push({ label: `${giorniFisr}gg FISR`, classe: 'badge-warn' })

          if (badges.length === 0) return null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {badges.map((b, i) => (
                <span key={i} className={`badge ${b.classe}`} style={{ fontSize: '11px', alignSelf: 'flex-start' }}>{b.label}</span>
              ))}
            </div>
          )
        })()}
      </div>
      <span style={{ color: 'var(--text-secondary)', fontSize: '18px', alignSelf: 'flex-start', marginTop: '8px' }}>›</span>
    </div>
  )
}

// ============================================================
// COMPRESSIONE IMMAGINI
// ============================================================

async function comprimiImmagine(file, maxWidth = 1200, qualita = 0.7) {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          const fileCompresso = new File([blob], file.name, { type: 'image/jpeg' })
          URL.revokeObjectURL(url)
          resolve(fileCompresso)
        },
        'image/jpeg',
        qualita
      )
    }
    img.src = url
  })
}

// ============================================================
// SCHEDA ATLETA
// ============================================================

function SchedaAtleta({ atleta, atleti, pattini, nav, onBack, onModifica, onDisattivato }) {
  const [documenti, setDocumenti] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(null) // null o chiave identificativa
  const [confermaDisattiva, setConfermaDisattiva] = useState(false)
  const [disattivando, setDisattivando] = useState(false)
  const [folderId, setFolderId] = useState(atleta.Drive_Folder_ID || '')
  const [nuovoDocForm, setNuovoDocForm] = useState(false)
  const [nuovoDocNome, setNuovoDocNome] = useState('')
  const [nuovoDocFile, setNuovoDocFile] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [sottoVista, setSottoVista] = useState(null) // 'scadenze' | 'noleggio' | 'pagamenti'

  function navigaSottoVista(nuova) {
    if (nuova) {
      nav.avanti({ tab: 'atleti', vista: 'sottoVista', tipo: nuova })
    }
    setSottoVista(nuova)
  }

  // Reagisci al tasto indietro
  useEffect(() => {
    const stato = nav.stato
    if (stato.tab === 'atleti' && stato.vista === 'scheda' && sottoVista) {
      setSottoVista(null)
    }
  }, [nav.stato])

  const CATEGORIE_DOC = [
    { key: 'certificato_medico', label: 'Certificato medico', icona: '🏥' },
    { key: 'tessera_fisr', label: 'Tessera FISR', icona: '🪪' },
    { key: 'liberatoria_privacy', label: 'Liberatoria privacy', icona: '📝' },
  ]

  const PREFISSI_CATEGORIA = ['certificato_medico', 'tessera_fisr', 'liberatoria_privacy']

  const pattiniAtleta = pattini.filter(p => p.ID_Atleta === atleta.ID_Atleta)
  const [pagamentiAtleta, setPagamentiAtleta] = useState([])
  const [storicoPattini, setStoricoPattini] = useState([])
  useEffect(() => {
    getPagamentiAtleta(atleta.ID_Atleta).then(p => setPagamentiAtleta(p))
    leggiSheet(SHEETS.STORICO_PATTINI).then(storico => {
      setStoricoPattini(
        storico
          .filter(s => s.ID_Atleta === atleta.ID_Atleta && s.Data_Fine)
          .sort((a, b) => new Date(b.Data_Fine) - new Date(a.Data_Fine))
      )
    }).catch(() => {})
  }, [atleta.ID_Atleta])
  const statoCert = statoScadenza(atleta.Scad_Certificato)
  const statoFISR = statoScadenza(atleta.Scad_FISR)

  async function ricaricaDocs() {
    const docs = await listaDocumentiAtleta(folderId)
    setDocumenti(docs)
  }

  useEffect(() => {
    if (folderId) {
      setLoadingDocs(true)
      listaDocumentiAtleta(folderId)
        .then(setDocumenti)
        .finally(() => setLoadingDocs(false))
    } else {
      // Crea automaticamente la cartella se manca
      creaCartellaAtleta(atleta).then(async (newFolderId) => {
        if (newFolderId) {
          atleta.Drive_Folder_ID = newFolderId
          await aggiornaAtletaSicuro(atleta.ID_Atleta, { Drive_Folder_ID: newFolderId })
          setFolderId(newFolderId)
        }
      }).catch(err => console.error('Errore creazione cartella:', err))
    }
  }, [folderId])

  function trovaDocPerCategoria(catKey) {
    return documenti.find(d => d.name?.toLowerCase().includes(catKey))
  }

  function documentiExtra() {
    return documenti.filter(d =>
      !PREFISSI_CATEGORIA.some(p => d.name?.toLowerCase().includes(p))
    )
  }

  async function handleCaricaDocCategoria(catKey, e) {
    const file = e.target.files[0]
    if (!file || !folderId) return
    setUploading(catKey)
    try {
      const fileFinale = await comprimiImmagine(file)
      const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'pdf')
      const nomeFile = `${catKey}.${ext}`
      await caricaDocumento(fileFinale, nomeFile, folderId)
      await ricaricaDocs()
    } finally {
      setUploading(null)
    }
  }

  async function handleSalvaDocExtra() {
    if (!nuovoDocNome.trim() || !nuovoDocFile || !folderId) return
    setUploading('nuovo_extra')
    try {
      const fileFinale = await comprimiImmagine(nuovoDocFile)
      const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (nuovoDocFile.name.includes('.') ? nuovoDocFile.name.split('.').pop() : 'pdf')
      const nomeFile = `${nuovoDocNome.trim()}.${ext}`
      await caricaDocumento(fileFinale, nomeFile, folderId)
      await ricaricaDocs()
      setNuovoDocForm(false)
      setNuovoDocNome('')
      setNuovoDocFile(null)
    } finally {
      setUploading(null)
    }
  }

  async function handleEliminaDoc(doc) {
    setEliminando(doc.id)
    try {
      await eliminaDocumento(doc.id)
      await ricaricaDocs()
    } finally {
      setEliminando(null)
    }
  }

  const badgeStato = (stato) => {
    if (stato === 'ok') return <span className="badge badge-ok">OK</span>
    if (stato === 'in_scadenza') return <span className="badge badge-warn">In scadenza</span>
    if (stato === 'urgente') return <span className="badge badge-urgente">Urgente</span>
    if (stato === 'scaduto') return <span className="badge badge-danger">Scaduto</span>
    return <span className="badge badge-danger">Mancante</span>
  }

  if (sottoVista === 'scadenze') {
    return <ModificaScadenze
      atleta={atleta}
      atleti={atleti}
      onBack={() => nav.indietro()}
      onSaved={() => { setSottoVista(null); onDisattivato() }}
    />
  }

  if (sottoVista === 'noleggio' && pattiniAtleta.length > 0) {
    return <GestioneNoleggio
      atleta={atleta}
      pattino={pattiniAtleta[0]}
      atleti={atleti}
      onBack={() => nav.indietro()}
      onSaved={() => { setSottoVista(null); onDisattivato() }}
    />
  }

  if (sottoVista === 'pagamenti') {
    return <GestionePagamenti
      atleta={atleta}
      atleti={atleti}
      onBack={() => nav.indietro()}
      onSaved={() => { setSottoVista(null); onDisattivato() }}
    />
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>
          ← Indietro
        </button>
        <button className="btn btn-secondary" onClick={onModifica} style={{ padding: '6px 14px', fontSize: '13px' }}>
          Modifica
        </button>
      </div>

      {/* HEADER ATLETA */}
      <div className="card card-elevated" style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div className="atleta-avatar" style={{ width: '64px', height: '64px', fontSize: '24px', margin: '0 auto 12px' }}>
          {atleta.Nome?.[0]}{atleta.Cognome?.[0]}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700' }}>
          {atleta.Nome} {atleta.Cognome}
        </h2>
        {atleta.Nome_Categoria && <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{atleta.Nome_Categoria}</p>}
      </div>

      {/* DATI PERSONALI */}
      <div className="section-title">Dati personali</div>
      <div className="card">
        <InfoRow label="Sesso"            value={atleta.Sesso || '—'} />
        <InfoRow label="Luogo di nascita" value={atleta.Luogo_Nascita || '—'} />
        <InfoRow label="Data di nascita"  value={formattaData(atleta.Data_Nascita)} />
        <InfoRow label="Codice fiscale"   value={atleta.Codice_Fiscale || '—'} />
        <InfoRow label="Numero di gara"   value={atleta.Numero_Gara || '—'} />
        <InfoRow label="Iscritto dal"     value={formattaData(atleta.Data_Iscrizione)} />
      </div>

      {/* CONTATTI */}
      <div className="section-title">Contatti</div>
      <div className="card">
        <InfoRow label="Genitore"  value={atleta.Genitore_Nome || '—'} />
        <InfoRow label="Telefono"  value={atleta.Genitore_Telefono || '—'} />
        <InfoRow label="Email"     value={atleta.Genitore_Email || '—'} />
      </div>

      {/* SCADENZE */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Scadenze</span>
        <span style={{ fontSize: '14px' }}>✏️</span>
      </div>
      <div className="card" onClick={() => navigaSottoVista('scadenze')} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Certificato medico</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {atleta.Emissione_Certificato && `Dal ${new Date(atleta.Emissione_Certificato).toLocaleDateString('it-IT')} · `}
              {atleta.Scad_Certificato ? formattaData(atleta.Scad_Certificato) : 'Non inserito'}
            </div>
          </div>
          {badgeStato(statoCert)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Tessera FISR</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {atleta.Numero_FISR || '—'} · {atleta.Emissione_FISR && `Dal ${new Date(atleta.Emissione_FISR).toLocaleDateString('it-IT')} · `}
              {atleta.Scad_FISR ? formattaData(atleta.Scad_FISR) : 'Non inserito'}
            </div>
          </div>
          {badgeStato(statoFISR)}
        </div>
      </div>

      {/* PATTINI */}
      {(pattiniAtleta.length > 0 || storicoPattini.length > 0) && (
        <>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Pattini in noleggio</span>
            {pattiniAtleta.length > 0 && <span style={{ fontSize: '14px' }}>✏️</span>}
          </div>
          <div className="card" onClick={() => pattiniAtleta.length > 0 ? navigaSottoVista('noleggio') : null} style={{ cursor: pattiniAtleta.length > 0 ? 'pointer' : 'default' }}>
            {/* Pattino attuale */}
            {pattiniAtleta.length > 0 ? pattiniAtleta.map(p => (
              <div key={p.ID_Pattino} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: storicoPattini.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{p.Marca || p.ID_Pattino} — Taglia {p.Taglia}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Dal {p.Data_Inizio_Noleggio ? new Date(p.Data_Inizio_Noleggio).toLocaleDateString('it-IT') : '—'} → in corso
                  </div>
                </div>
                {(() => {
                  const nonPagati = pagamentiAtleta.filter(pg => pg.Tipo === 'Noleggio' && pg.Stato !== 'Pagato')
                  const statoPag = nonPagati.length > 0 ? 'Da pagare' : 'Pagato'
                  return (
                    <span className={`badge ${statoPag === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}>
                      {statoPag}
                    </span>
                  )
                })()}
              </div>
            )) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '10px 0', borderBottom: storicoPattini.length > 0 ? '1px solid var(--border)' : 'none' }}>
                Nessun pattino assegnato
              </div>
            )}

            {/* Storico pattini restituiti */}
            {storicoPattini.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < storicoPattini.length - 1 ? '1px solid var(--border)' : 'none', opacity: 0.7 }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{s.Marca} — Taglia {s.Taglia}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Dal {new Date(s.Data_Inizio).toLocaleDateString('it-IT')} → {new Date(s.Data_Fine).toLocaleDateString('it-IT')}
                  </div>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '11px' }}>Restituito</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PAGAMENTI */}
      <SezionePagamenti atleta={atleta} pattini={pattiniAtleta} onTap={() => navigaSottoVista('pagamenti')} />

      {/* DOCUMENTI */}
      <div className="section-title">Documenti</div>
      <div className="card">
        {!folderId ? (
          <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Creazione cartella in corso...
          </div>
        ) : loadingDocs ? (
          <div style={{ color: 'var(--text-secondary)' }}>Caricamento...</div>
        ) : (
          <>
            {/* Categorie predefinite */}
            {CATEGORIE_DOC.map((cat, i) => {
              const doc = trovaDocPerCategoria(cat.key)
              return (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{cat.icona}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{cat.label}</div>
                    {doc ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Non caricato</div>
                    )}
                  </div>
                  {doc ? (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <a href={doc.webViewLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>Apri</a>
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" accept="*/*" style={{ display: 'none' }} onChange={e => handleCaricaDocCategoria(cat.key, e)} />
                        <span className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                          {uploading === cat.key ? '...' : 'Sostituisci'}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="*/*" style={{ display: 'none' }} onChange={e => handleCaricaDocCategoria(cat.key, e)} />
                      <span className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }}>
                        {uploading === cat.key ? '...' : 'Carica'}
                      </span>
                    </label>
                  )}
                </div>
              )
            })}

            {/* Altri documenti */}
            <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-secondary)' }}>Altri documenti</div>
              {!nuovoDocForm && (
                <button className="btn btn-ghost" onClick={() => setNuovoDocForm(true)} style={{ padding: '2px 8px', fontSize: '16px', lineHeight: 1 }}>+</button>
              )}
            </div>

            {documentiExtra().length === 0 && !nuovoDocForm && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', paddingBottom: '6px' }}>Nessun documento extra</div>
            )}

            {documentiExtra().map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <a href={doc.webViewLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>Apri</a>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: '#FF6B7A' }}
                    disabled={eliminando === doc.id}
                    onClick={() => handleEliminaDoc(doc)}>
                    {eliminando === doc.id ? '...' : 'Elimina'}
                  </button>
                </div>
              </div>
            ))}

            {/* Form nuovo documento extra */}
            {nuovoDocForm && (
              <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <input className="form-input" placeholder="Nome documento (es. Consenso foto)" value={nuovoDocNome} onChange={e => setNuovoDocNome(e.target.value)} style={{ fontSize: '13px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <label style={{ cursor: 'pointer', flex: 1 }}>
                    <input type="file" accept="*/*" style={{ display: 'none' }} onChange={e => setNuovoDocFile(e.target.files[0] || null)} />
                    <span className="btn btn-ghost btn-full" style={{ fontSize: '13px' }}>
                      {nuovoDocFile ? nuovoDocFile.name : 'Scegli file'}
                    </span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" onClick={() => { setNuovoDocForm(false); setNuovoDocNome(''); setNuovoDocFile(null) }} style={{ flex: 1, fontSize: '13px' }}>Annulla</button>
                  <button className="btn btn-primary" onClick={handleSalvaDocExtra} disabled={!nuovoDocNome.trim() || !nuovoDocFile || uploading === 'nuovo_extra'} style={{ flex: 1, fontSize: '13px' }}>
                    {uploading === 'nuovo_extra' ? 'Caricamento...' : 'Salva'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DISATTIVA ATLETA */}
      {confermaDisattiva ? (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '16px', textAlign: 'center' }}>
          <div style={{ color: '#FF6B7A', fontWeight: '600', marginBottom: '8px' }}>Disattivare {atleta.Nome} {atleta.Cognome}?</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>L'atleta non apparirà più nella lista ma rimarrà nel foglio.</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => setConfermaDisattiva(false)} style={{ flex: 1 }}>Annulla</button>
            <button className="btn btn-primary" disabled={disattivando} onClick={async () => {
              setDisattivando(true)
              try {
                await aggiornaAtletaSicuro(atleta.ID_Atleta, { Attivo: 'FALSE' })
                await scriviLog('Disattivazione', 'Atleta', `${atleta.Nome} ${atleta.Cognome}`)
                onDisattivato()
              } catch (err) {
                console.error(err)
              } finally {
                setDisattivando(false)
              }
            }} style={{ flex: 1, background: '#E8334A' }}>
              {disattivando ? 'Disattivazione...' : 'Disattiva'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-full" onClick={() => setConfermaDisattiva(true)} style={{ marginTop: '16px', marginBottom: '24px', color: '#FF6B7A' }}>
          Disattiva atleta
        </button>
      )}
    </div>
  )
}

// ============================================================
// MODIFICA SCADENZE
// ============================================================

function ModificaScadenze({ atleta, atleti, onBack, onSaved }) {
  const [emissioneCert, setEmissioneCert] = useState(atleta.Emissione_Certificato || '')
  const [scadCert, setScadCert] = useState(atleta.Scad_Certificato || '')
  const [emissioneFISR, setEmissioneFISR] = useState(atleta.Emissione_FISR || '')
  const [scadFISR, setScadFISR] = useState(atleta.Scad_FISR || '')
  const [numeroFISR, setNumeroFISR] = useState(atleta.Numero_FISR || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [storico, setStorico] = useState([])
  const [docCaricato, setDocCaricato] = useState({ certificato: false, fisr: false })
  const [refreshDocs, setRefreshDocs] = useState(0)

  useEffect(() => {
    getStoricoScadenze(atleta.ID_Atleta).then(setStorico)

    if (atleta.Drive_Folder_ID) {
      listaDocumentiAtleta(atleta.Drive_Folder_ID).then(files => {
        const nomi = files.map(f => f.name?.toLowerCase() || '')
        setDocCaricato({
          certificato: nomi.some(n => n.includes('certificato_medico')),
          fisr: nomi.some(n => n.includes('tessera_fisr'))
        })
      }).catch(() => {})
    }
  }, [atleta.ID_Atleta])

  const storicoCert = storico.filter(s => s.Tipo === 'Certificato')
  const storicoFISR = storico.filter(s => s.Tipo === 'Tessera_FISR')

  async function handleSalva() {
    setSaving(true)
    try {
      const nomeAtleta = `${atleta.Nome} ${atleta.Cognome}`

      // Se la scadenza certificato è cambiata → salva la vecchia nello storico
      if (atleta.Scad_Certificato && scadCert !== atleta.Scad_Certificato) {
        await salvaStoricoScadenza(
          atleta.ID_Atleta, nomeAtleta, 'Certificato',
          atleta.Emissione_Certificato || '', atleta.Scad_Certificato, ''
        )
      }

      // Se la scadenza FISR è cambiata → salva la vecchia nello storico
      if (atleta.Scad_FISR && scadFISR !== atleta.Scad_FISR) {
        await salvaStoricoScadenza(
          atleta.ID_Atleta, nomeAtleta, 'Tessera_FISR',
          atleta.Emissione_FISR || '', atleta.Scad_FISR, ''
        )
      }

      await aggiornaAtletaSicuro(atleta.ID_Atleta, {
        Scad_Certificato: scadCert,
        Scad_FISR: scadFISR,
        Numero_FISR: numeroFISR,
        Emissione_Certificato: emissioneCert,
        Emissione_FISR: emissioneFISR,
      })
      await scriviLog('Modifica', 'Scadenze', nomeAtleta)
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadDoc(tipo, file) {
    if (!file) return
    setUploading(tipo)
    try {
      let folderId = atleta.Drive_Folder_ID
      if (!folderId) {
        folderId = await creaCartellaAtleta(atleta)
        atleta.Drive_Folder_ID = folderId
        await aggiornaAtletaSicuro(atleta.ID_Atleta, { Drive_Folder_ID: folderId })
      }
      const fileFinale = await comprimiImmagine(file)
      const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'pdf')
      const anno = new Date().getFullYear()
      const nomeFile = tipo === 'certificato'
        ? `${atleta.Nome}_${atleta.Cognome}_certificato_medico_${anno}.${ext}`.replace(/\s+/g, '_')
        : `${atleta.Nome}_${atleta.Cognome}_tessera_FISR_${anno}.${ext}`.replace(/\s+/g, '_')
      await caricaDocumento(fileFinale, nomeFile, folderId)
      setRefreshDocs(prev => prev + 1)
      setDocCaricato(prev => ({ ...prev, [tipo]: true }))
    } catch (err) {
      console.error(err)
      alert('Errore durante il caricamento')
    } finally {
      setUploading(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Scadenze</h1>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>
          {atleta.Nome} {atleta.Cognome}
        </div>
      </div>

      {/* CERTIFICATO MEDICO */}
      <div className="section-title">Certificato medico</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Data emissione</label>
          <input className="form-input" type="date" value={emissioneCert} onChange={e => setEmissioneCert(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data scadenza</label>
          <input className="form-input" type="date" value={scadCert} onChange={e => setScadCert(e.target.value)} />
        </div>

        <input type="file" accept="image/*,application/pdf" capture="environment"
          onChange={(e) => handleUploadDoc('certificato', e.target.files[0])}
          style={{ display: 'none' }} id="upload-cert" />
        <label htmlFor="upload-cert" className="btn btn-ghost" style={{
          fontSize: '13px', cursor: 'pointer', width: '100%', justifyContent: 'center',
          color: docCaricato.certificato ? 'var(--accent-ok)' : 'var(--text-secondary)',
          borderColor: docCaricato.certificato ? 'rgba(16,185,129,0.3)' : 'var(--border)'
        }}>
          {uploading === 'certificato' ? 'Caricamento...' : docCaricato.certificato ? '✅ Certificato caricato (tap per sostituire)' : '📎 Carica certificato medico (foto o file)'}
        </label>

        {storicoCert.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', marginBottom: '6px' }}>Storico</div>
            {storicoCert.map((s, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {s.Data_Emissione ? new Date(s.Data_Emissione).toLocaleDateString('it-IT') : '—'}
                  {' → '}
                  {s.Data_Scadenza ? new Date(s.Data_Scadenza).toLocaleDateString('it-IT') : '—'}
                </span>
                {s.File_Nome && <span style={{ fontSize: '11px' }}>📄</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TESSERA FISR */}
      <div className="section-title">Tessera FISR</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Numero tessera</label>
          <input className="form-input" value={numeroFISR} onChange={e => setNumeroFISR(e.target.value)} placeholder="Numero FISR" />
        </div>
        <div className="form-group">
          <label className="form-label">Data emissione</label>
          <input className="form-input" type="date" value={emissioneFISR} onChange={e => setEmissioneFISR(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Data scadenza</label>
          <input className="form-input" type="date" value={scadFISR} onChange={e => setScadFISR(e.target.value)} />
        </div>

        <input type="file" accept="image/*,application/pdf" capture="environment"
          onChange={(e) => handleUploadDoc('fisr', e.target.files[0])}
          style={{ display: 'none' }} id="upload-fisr" />
        <label htmlFor="upload-fisr" className="btn btn-ghost" style={{
          fontSize: '13px', cursor: 'pointer', width: '100%', justifyContent: 'center',
          color: docCaricato.fisr ? 'var(--accent-ok)' : 'var(--text-secondary)',
          borderColor: docCaricato.fisr ? 'rgba(16,185,129,0.3)' : 'var(--border)'
        }}>
          {uploading === 'fisr' ? 'Caricamento...' : docCaricato.fisr ? '✅ Tessera caricata (tap per sostituire)' : '📎 Carica tessera FISR (foto o file)'}
        </label>

        {storicoFISR.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', marginBottom: '6px' }}>Storico</div>
            {storicoFISR.map((s, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {s.Data_Emissione ? new Date(s.Data_Emissione).toLocaleDateString('it-IT') : '—'}
                  {' → '}
                  {s.Data_Scadenza ? new Date(s.Data_Scadenza).toLocaleDateString('it-IT') : '—'}
                </span>
                {s.File_Nome && <span style={{ fontSize: '11px' }}>📄</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {atleta.Drive_Folder_ID && (
        <ListaDocumentiAtleta folderId={atleta.Drive_Folder_ID} key={refreshDocs} filterPrefix={['certificato_medico', 'tessera_fisr']} />
      )}

      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginBottom: '24px' }}>
        {saving ? 'Salvataggio...' : 'Salva scadenze'}
      </button>
    </div>
  )
}

// ============================================================
// GESTIONE NOLEGGIO
// ============================================================

function GestioneNoleggio({ atleta, pattino, atleti, onBack, onSaved }) {
  const [dataInizio, setDataInizio] = useState(pattino.Data_Inizio_Noleggio || '')
  const [saving, setSaving] = useState(false)
  const [storico, setStorico] = useState([])
  const [dataPrimoNoleggio, setDataPrimoNoleggio] = useState(null)
  const [loadingStorico, setLoadingStorico] = useState(true)
  const [mostraSostituzione, setMostraSostituzione] = useState(false)
  const [pagamentiNoleggio, setPagamentiNoleggio] = useState([])
  const [costoMensile, setCostoMensile] = useState(15)

  // Carica storico, primo noleggio, pagamenti e config
  useEffect(() => {
    async function caricaDati() {
      try {
        const config = await getConfigurazione()
        setCostoMensile(parseFloat(config.Costo_Noleggio_Mensile) || 15)

        const primaData = await getDataPrimoNoleggio(atleta.ID_Atleta)
        setDataPrimoNoleggio(primaData)

        const tuttoStorico = await leggiSheet(SHEETS.STORICO_PATTINI)
        const annoStagione = calcolaAnnoInizioStagione()
        const inizioStagione = new Date(`${annoStagione}-10-01`)

        const storicoStagione = tuttoStorico
          .filter(s => s.ID_Atleta === atleta.ID_Atleta)
          .filter(s => new Date(s.Data_Inizio) >= inizioStagione)
          .sort((a, b) => new Date(a.Data_Inizio) - new Date(b.Data_Inizio))
        setStorico(storicoStagione)

        // Pagamenti noleggio dal foglio Pagamenti
        const tuttiPagamenti = await getPagamentiAtleta(atleta.ID_Atleta)
        const soloNoleggio = tuttiPagamenti.filter(p => p.Tipo === 'Noleggio')
        setPagamentiNoleggio(soloNoleggio)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingStorico(false)
      }
    }
    caricaDati()
  }, [atleta.ID_Atleta])

  // Calcola mesi dalla data del primo noleggio (non dal pattino attuale)
  const dataRiferimento = dataPrimoNoleggio || dataInizio
  const mesiNoleggio = dataRiferimento ? (() => {
    const inizio = new Date(dataRiferimento)
    const oggi = new Date()
    const mesi = (oggi.getFullYear() - inizio.getFullYear()) * 12 + (oggi.getMonth() - inizio.getMonth())
    return Math.max(1, mesi)
  })() : 0

  const totale = mesiNoleggio * costoMensile

  async function handleSalvaData() {
    setSaving(true)
    try {
      const pattini = await getPattini()
      const idx = pattini.findIndex(p => p.ID_Pattino === pattino.ID_Pattino)
      if (idx === -1) throw new Error('Pattino non trovato')
      await aggiornaPattino(idx, { ...pattino, Data_Inizio_Noleggio: dataInizio })
      await scriviLog('Modifica', 'Noleggio', `Data inizio aggiornata per ${atleta.Nome} ${atleta.Cognome}`)
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestituzione() {
    if (!confirm('Confermi la restituzione del pattino?')) return
    setSaving(true)
    try {
      await restituisciPattino(pattino.ID_Pattino)
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Noleggio</h1>
      </div>

      {/* Pattino attuale */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>
          {pattino.Marca || pattino.ID_Pattino} — Taglia {pattino.Taglia}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Assegnato a {atleta.Nome} {atleta.Cognome}
        </div>
      </div>

      {/* Dettagli noleggio con calcolo da storico */}
      <div className="section-title">Dettagli noleggio</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Data inizio noleggio (pattino attuale)</label>
          <input className="form-input" type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
        </div>
        {dataPrimoNoleggio && dataPrimoNoleggio !== dataInizio && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Primo noleggio stagione</span>
            <span style={{ fontWeight: '600' }}>{new Date(dataPrimoNoleggio).toLocaleDateString('it-IT')}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Durata complessiva</span>
          <span style={{ fontWeight: '600' }}>{mesiNoleggio} mesi</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Importo dovuto</span>
          <span style={{ fontWeight: '600', color: 'var(--accent)' }}>€{totale} (€{costoMensile}/mese)</span>
        </div>
      </div>

      {/* Storico pattini stagione */}
      {storico.length > 0 && (
        <>
          <div className="section-title">Storico pattini stagione</div>
          <div className="card" style={{ marginBottom: '16px' }}>
            {storico.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < storico.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '14px' }}>
                <span>{s.Marca} T.{s.Taglia}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(s.Data_Inizio).toLocaleDateString('it-IT')} → {s.Data_Fine ? new Date(s.Data_Fine).toLocaleDateString('it-IT') : 'in corso'}
                </span>
              </div>
            ))}
            {/* Pattino attuale */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', color: 'var(--accent-ok)' }}>
              <span>{pattino.Marca} T.{pattino.Taglia}</span>
              <span>{dataInizio ? new Date(dataInizio).toLocaleDateString('it-IT') : '—'} → in corso</span>
            </div>
          </div>
        </>
      )}

      {/* Pagamenti noleggio */}
      <div className="section-title">Pagamenti noleggio</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        {pagamentiNoleggio.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '12px', fontSize: '14px' }}>
            Nessun pagamento noleggio generato
          </div>
        ) : (
          pagamentiNoleggio.map(p => (
            <PagamentoNoleggioRow
              key={p.ID_Pagamento}
              pagamento={p}
              atleta={atleta}
              onUpdate={(aggiornato) => {
                setPagamentiNoleggio(prev => prev.map(pg =>
                  pg.ID_Pagamento === aggiornato.ID_Pagamento ? aggiornato : pg
                ))
              }}
            />
          ))
        )}
      </div>

      {/* Bottoni azione */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={handleSalvaData} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>
        <button className="btn btn-ghost" onClick={() => setMostraSostituzione(true)} disabled={saving} style={{ flex: 1 }}>
          Sostituisci
        </button>
        <button className="btn btn-ghost" onClick={handleRestituzione} disabled={saving} style={{ color: 'var(--accent)' }}>
          Restituisci
        </button>
      </div>

      {/* Pannello sostituzione pattino */}
      {mostraSostituzione && (
        <SostituisciPattino
          atleta={atleta}
          pattinoAttuale={pattino}
          onDone={() => { setMostraSostituzione(false); onSaved() }}
          onAnnulla={() => setMostraSostituzione(false)}
        />
      )}
    </div>
  )
}

function SostituisciPattino({ atleta, pattinoAttuale, onDone, onAnnulla }) {
  const [pattiniLiberi, setPattiniLiberi] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filtroTaglia, setFiltroTaglia] = useState('')

  useEffect(() => {
    async function carica() {
      const pattini = await getPattini()
      const liberi = pattini.filter(p => !p.ID_Atleta && p.Stato !== 'Rotto')
      setPattiniLiberi(liberi)
      setLoading(false)
    }
    carica()
  }, [])

  async function handleSostituisci(nuovoPattino) {
    if (!confirm(`Sostituire ${pattinoAttuale.Marca} T.${pattinoAttuale.Taglia} con ${nuovoPattino.Marca} T.${nuovoPattino.Taglia}?`)) return
    setSaving(true)
    try {
      // 1. Restituisci il pattino attuale (va nello storico, torna libero)
      await restituisciPattino(pattinoAttuale.ID_Pattino)

      // 2. Assegna il nuovo pattino con data di oggi
      await assegnaPattino(nuovoPattino.ID_Pattino, atleta.ID_Atleta)

      await scriviLog('Sostituzione', 'Pattino',
        `${atleta.Nome} ${atleta.Cognome}: ${pattinoAttuale.Marca} T.${pattinoAttuale.Taglia} → ${nuovoPattino.Marca} T.${nuovoPattino.Taglia}`)

      onDone()
    } catch (err) {
      console.error(err)
      alert('Errore durante la sostituzione')
    } finally {
      setSaving(false)
    }
  }

  const pattiniFiltrati = filtroTaglia
    ? pattiniLiberi.filter(p => String(p.Taglia).includes(filtroTaglia))
    : pattiniLiberi

  if (loading) return <div className="loading-center">Caricamento pattini...</div>

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
        Scegli nuovo pattino
      </div>

      <div className="form-group">
        <label className="form-label">Filtra per taglia</label>
        <input className="form-input" type="number" value={filtroTaglia} onChange={e => setFiltroTaglia(e.target.value)} placeholder="Es. 41" />
      </div>

      {pattiniFiltrati.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
          Nessun pattino libero{filtroTaglia ? ` per taglia ${filtroTaglia}` : ''}
        </div>
      ) : (
        pattiniFiltrati.map(p => (
          <div
            key={p.ID_Pattino}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            onClick={() => !saving && handleSostituisci(p)}
          >
            <div>
              <div style={{ fontWeight: '600' }}>{p.Marca} — Taglia {p.Taglia}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{p.Stato} · {p.ID_Pattino}</div>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: '13px' }}>Seleziona →</span>
          </div>
        ))
      )}

      <button className="btn btn-ghost btn-full" onClick={onAnnulla} style={{ marginTop: '12px' }}>
        Annulla
      </button>
    </div>
  )
}

// ============================================================
// PAGAMENTO NOLEGGIO ROW (usata nel tab Noleggio)
// ============================================================

function PagamentoNoleggioRow({ pagamento, atleta, onUpdate }) {
  const [uploading, setUploading] = useState(false)

  async function togglePagato() {
    const nuovoStato = pagamento.Stato === 'Pagato' ? 'Da pagare' : 'Pagato'
    const dataPag = nuovoStato === 'Pagato' ? new Date().toISOString().split('T')[0] : ''
    await aggiornaPagamento(pagamento.ID_Pagamento, {
      Stato: nuovoStato,
      Data_Pagamento: dataPag
    })
    onUpdate({ ...pagamento, Stato: nuovoStato, Data_Pagamento: dataPag })
  }

  async function handleUploadRicevuta(file) {
    if (!file) return
    setUploading(true)
    try {
      let folderId = atleta.Drive_Folder_ID
      if (!folderId) {
        folderId = await creaCartellaAtleta(atleta)
        await aggiornaAtletaSicuro(atleta.ID_Atleta, { Drive_Folder_ID: folderId })
        atleta.Drive_Folder_ID = folderId
      }

      const fileFinale = await comprimiImmagine(file)
      const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'pdf')
      const descrizione = (pagamento.Descrizione || 'noleggio').replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ _-]/g, '_').replace(/\s+/g, '_')
      const nomeFile = `${atleta.Nome}_${atleta.Cognome}_${descrizione}.${ext}`.replace(/\s+/g, '_')

      await caricaDocumento(fileFinale, nomeFile, folderId)
      alert('Ricevuta caricata ✓')
    } catch (err) {
      console.error(err)
      alert('Errore durante il caricamento')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>{pagamento.Descrizione}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            €{pagamento.Importo} · Scad. {pagamento.Data_Scadenza ? new Date(pagamento.Data_Scadenza).toLocaleDateString('it-IT') : '—'}
            {pagamento.Data_Pagamento && ` · Pagato il ${new Date(pagamento.Data_Pagamento).toLocaleDateString('it-IT')}`}
          </div>
        </div>
        <button
          className={`badge ${pagamento.Stato === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}
          style={{ cursor: 'pointer', border: 'none', fontSize: '13px' }}
          onClick={togglePagato}
        >
          {pagamento.Stato === 'Pagato' ? 'Pagato ✓' : 'Da pagare'}
        </button>
      </div>

      <div style={{ marginTop: '8px' }}>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => handleUploadRicevuta(e.target.files[0])}
          style={{ display: 'none' }}
          id={`upload-nol-${pagamento.ID_Pagamento}`}
        />
        <label
          htmlFor={`upload-nol-${pagamento.ID_Pagamento}`}
          className="btn btn-ghost"
          style={{ fontSize: '12px', cursor: uploading ? 'wait' : 'pointer', padding: '4px 8px' }}
        >
          {uploading ? 'Caricamento...' : '📎 Carica ricevuta'}
        </label>
      </div>
    </div>
  )
}

// ============================================================
// GESTIONE PAGAMENTI (vista completa)
// ============================================================

function GestionePagamenti({ atleta, atleti, onBack, onSaved }) {
  const [pagamenti, setPagamenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshDocs, setRefreshDocs] = useState(0)

  useEffect(() => {
    getPagamentiAtleta(atleta.ID_Atleta).then(p => { setPagamenti(p); setLoading(false) })
  }, [atleta.ID_Atleta])

  async function togglePagato(pag) {
    const nuovoStato = pag.Stato === 'Pagato' ? 'Da pagare' : 'Pagato'
    const dataPag = nuovoStato === 'Pagato' ? new Date().toISOString().split('T')[0] : ''
    await aggiornaPagamento(pag.ID_Pagamento, { Stato: nuovoStato, Data_Pagamento: dataPag })
    setPagamenti(prev => prev.map(p =>
      p.ID_Pagamento === pag.ID_Pagamento
        ? { ...p, Stato: nuovoStato, Data_Pagamento: dataPag }
        : p
    ))
  }

  async function handleUploadRicevuta(pag, file) {
    if (!file) return
    let folderId = atleta.Drive_Folder_ID
    if (!folderId) {
      folderId = await creaCartellaAtleta(atleta)
      atleta.Drive_Folder_ID = folderId
      await aggiornaAtletaSicuro(atleta.ID_Atleta, { Drive_Folder_ID: folderId })
    }
    const fileFinale = await comprimiImmagine(file)
    const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'pdf')
    const stagione = pag.Descrizione?.match(/\d{4}\/\d{4}/)?.[0]?.replace('/', '_') || ''
    const rata = pag.Descrizione?.match(/Rata (\d\/\d)/)?.[1]?.replace('/', '_') || ''
    const nomeBase = rata
      ? `${atleta.Nome}_${atleta.Cognome}_quota_${stagione}_rata_${rata}`
      : `${atleta.Nome}_${atleta.Cognome}_${pag.Tipo}_${pag.ID_Pagamento}`
    await caricaDocumento(fileFinale, `${nomeBase.replace(/\s+/g, '_')}.${ext}`, folderId)
    setRefreshDocs(prev => prev + 1)
    alert('Ricevuta caricata ✓')
  }

  if (loading) return <div className="loading-center">Caricamento pagamenti...</div>

  const totDovuto = pagamenti.reduce((sum, p) => sum + (parseFloat(p.Importo) || 0), 0)
  const totPagato = pagamenti.filter(p => p.Stato === 'Pagato').reduce((sum, p) => sum + (parseFloat(p.Importo) || 0), 0)
  const saldo = totDovuto - totPagato

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Pagamenti</h1>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>
          {atleta.Nome} {atleta.Cognome}
        </div>
      </div>

      {/* Riepilogo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700' }}>€{totDovuto}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Totale dovuto</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: saldo > 0 ? '#FCD34D' : 'var(--accent-ok)' }}>€{saldo}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>{saldo > 0 ? 'Da saldare' : 'In pari'}</div>
        </div>
      </div>

      {/* Lista pagamenti */}
      <div className="section-title">Dettaglio</div>
      <div className="card">
        {pagamenti.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <div className="empty-state-text">Nessun pagamento registrato</div>
          </div>
        ) : (
          pagamenti.map(p => (
            <div key={p.ID_Pagamento} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{p.Descrizione}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                    €{p.Importo}{p.Data_Scadenza ? ` · Scad. ${p.Data_Scadenza}` : ''}
                    {p.Data_Pagamento && ` · Pagato il ${p.Data_Pagamento}`}
                  </div>
                </div>
                <button
                  className={`badge ${p.Stato === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}
                  style={{ cursor: 'pointer', border: 'none', fontSize: '13px' }}
                  onClick={(e) => { e.stopPropagation(); togglePagato(p) }}
                >
                  {p.Stato === 'Pagato' ? 'Pagato ✓' : 'Da pagare'}
                </button>
              </div>
              <div style={{ marginTop: '8px' }}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={(e) => handleUploadRicevuta(p, e.target.files[0])}
                  style={{ display: 'none' }}
                  id={`upload-ric-${p.ID_Pagamento}`}
                />
                <label htmlFor={`upload-ric-${p.ID_Pagamento}`} className="btn btn-ghost" style={{ fontSize: '12px', cursor: 'pointer', padding: '4px 8px' }}>
                  📎 Carica ricevuta
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {atleta.Drive_Folder_ID && (
        <ListaDocumentiAtleta folderId={atleta.Drive_Folder_ID} key={refreshDocs} filterPrefix={['ricevuta']} />
      )}
    </div>
  )
}

// ============================================================
// SEZIONE PAGAMENTI (riepilogo nella scheda)
// ============================================================

function SezionePagamenti({ atleta, pattini, onTap }) {
  const [pagamenti, setPagamenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    getPagamentiAtleta(atleta.ID_Atleta)
      .then(setPagamenti)
      .finally(() => setLoading(false))
  }, [atleta.ID_Atleta])

  async function togglePagato(pag) {
    const nuovoStato = pag.Stato === 'Pagato' ? 'Da pagare' : 'Pagato'
    const dataPag = nuovoStato === 'Pagato' ? new Date().toISOString().split('T')[0] : ''
    setSaving(pag.ID_Pagamento)
    try {
      await aggiornaPagamento(pag.ID_Pagamento, { Stato: nuovoStato, Data_Pagamento: dataPag })
      setPagamenti(prev => prev.map(p =>
        p.ID_Pagamento === pag.ID_Pagamento ? { ...p, Stato: nuovoStato, Data_Pagamento: dataPag } : p
      ))
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Pagamenti</span>
        <span style={{ fontSize: '14px' }}>✏️</span>
      </div>
      <div className="card" onClick={onTap} style={{ cursor: 'pointer' }}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Caricamento...</div>
        ) : (
          <>
            {pagamenti.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '8px 0' }}>Nessun pagamento registrato</div>
            )}
            {pagamenti.map(pag => (
              <div key={pag.ID_Pagamento} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{pag.Descrizione}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    €{pag.Importo}{pag.Data_Scadenza ? ` · Scad. ${pag.Data_Scadenza}` : ''}
                    {pag.Data_Pagamento ? ` · Pagato il ${pag.Data_Pagamento}` : ''}
                  </div>
                </div>
                <button
                  className={`badge ${pag.Stato === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}
                  style={{ cursor: saving === pag.ID_Pagamento ? 'wait' : 'pointer', border: 'none', flexShrink: 0 }}
                  disabled={saving === pag.ID_Pagamento}
                  onClick={() => togglePagato(pag)}
                >
                  {pag.Stato === 'Pagato' ? 'Pagato ✓' : 'Da pagare'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}

// ============================================================
// LISTA DOCUMENTI ATLETA (filtrata)
// ============================================================

function ListaDocumentiAtleta({ folderId, filterPrefix }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!folderId) return
    setLoading(true)
    listaDocumentiAtleta(folderId)
      .then(files => {
        const filtered = filterPrefix
          ? files.filter(d => filterPrefix.some(p => d.name?.toLowerCase().startsWith(p)))
          : files
        setDocs(filtered)
      })
      .finally(() => setLoading(false))
  }, [folderId])

  if (!folderId || loading) return null
  if (docs.length === 0) return null

  return (
    <div className="card" style={{ marginTop: '8px', marginBottom: '16px' }}>
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

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{label}</span>
      <span style={{ fontWeight: '500', fontSize: '14px' }}>{value}</span>
    </div>
  )
}

function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
}

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
}

// ============================================================
// NOLEGGIO NON PAGATI (da Dashboard)
// ============================================================

function NoleggioNonPagati({ nav }) {
  const [pagamentiList, setPagamentiList] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagamentoSelezionato, setPagamentoSelezionato] = useState(null)

  useEffect(() => {
    async function carica() {
      const tuttiPag = await leggiSheet(SHEETS.PAGAMENTI)
      const noleggiNonPagati = tuttiPag.filter(p => p.Tipo === 'Noleggio' && p.Stato !== 'Pagato')
      setPagamentiList(noleggiNonPagati)
      setLoading(false)
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (pagamentoSelezionato) {
    return <DettaglioPagamentoNoleggio
      pagamento={pagamentoSelezionato}
      onBack={() => setPagamentoSelezionato(null)}
      onSaved={(aggiornato) => {
        if (aggiornato.Stato === 'Pagato') {
          setPagamentiList(prev => prev.filter(p => p.ID_Pagamento !== aggiornato.ID_Pagamento))
        } else {
          setPagamentiList(prev => prev.map(p =>
            p.ID_Pagamento === aggiornato.ID_Pagamento ? aggiornato : p
          ))
        }
        setPagamentoSelezionato(null)
      }}
      nav={nav}
    />
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => nav.indietro()} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Noleggio da riscuotere</h1>
      </div>

      <div className="card">
        {pagamentiList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">Tutti i noleggi sono pagati</div>
          </div>
        ) : (
          pagamentiList.map(p => (
            <div
              key={p.ID_Pagamento}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer'
              }}
              onClick={() => {
                setPagamentoSelezionato(p)
                nav.avanti({ tab: 'atleti', vista: 'dettaglio_pagamento' })
              }}
            >
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{p.Nome_Atleta || p.ID_Atleta}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                  {p.Descrizione} · €{p.Importo}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Scad. {p.Data_Scadenza ? new Date(p.Data_Scadenza).toLocaleDateString('it-IT') : '—'}
                </div>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>›</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DettaglioPagamentoNoleggio({ pagamento, onBack, onSaved, nav }) {
  const [stato, setStato] = useState(pagamento.Stato || 'Da pagare')
  const [dataPagamento, setDataPagamento] = useState(
    pagamento.Data_Pagamento || new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docCaricato, setDocCaricato] = useState(false)
  const [atletaData, setAtletaData] = useState(null)

  useEffect(() => {
    async function caricaDati() {
      if (!pagamento.ID_Atleta) return
      const atleti = await leggiSheet(SHEETS.ATLETI)
      const atleta = atleti.find(a => a.ID_Atleta === pagamento.ID_Atleta)
      setAtletaData(atleta)
      if (!atleta?.Drive_Folder_ID) return

      try {
        const files = await listaDocumentiAtleta(atleta.Drive_Folder_ID)
        const nomi = files.map(f => f.name?.toLowerCase() || '')
        setDocCaricato(nomi.some(n => n.includes('ricevuta') && n.includes('noleggio')))
      } catch (e) {}
    }
    caricaDati()
  }, [pagamento.ID_Atleta])

  async function handleSalva() {
    setSaving(true)
    try {
      await aggiornaPagamento(pagamento.ID_Pagamento, {
        Stato: stato,
        Data_Pagamento: stato === 'Pagato' ? dataPagamento : ''
      })
      await scriviLog('Modifica', 'Pagamento', `${pagamento.Nome_Atleta || pagamento.ID_Atleta} - ${pagamento.Descrizione}`)
      onSaved({ ...pagamento, Stato: stato, Data_Pagamento: stato === 'Pagato' ? dataPagamento : '' })
    } catch (err) {
      console.error(err)
      alert('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadRicevuta(file) {
    if (!file) return
    setUploading(true)
    try {
      let folderId = atletaData?.Drive_Folder_ID
      if (!folderId && atletaData) {
        folderId = await creaCartellaAtleta(atletaData)
        await aggiornaAtletaSicuro(atletaData.ID_Atleta, { Drive_Folder_ID: folderId })
        setAtletaData(prev => ({ ...prev, Drive_Folder_ID: folderId }))
      }
      if (!folderId) throw new Error('Cartella Drive non trovata')

      const fileFinale = await comprimiImmagine(file)
      const ext = fileFinale.type === 'image/jpeg' ? 'jpg' : (file.name.includes('.') ? file.name.split('.').pop() : 'pdf')
      const nomeAtleta = (pagamento.Nome_Atleta || pagamento.ID_Atleta).replace(/\s+/g, '_')
      const descrizione = (pagamento.Descrizione || 'noleggio').replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ_-]/g, '_').replace(/\s+/g, '_')
      const nomeFile = `${nomeAtleta}_ricevuta_noleggio_${descrizione}.${ext}`

      await caricaDocumento(fileFinale, nomeFile, folderId)
      setDocCaricato(true)
    } catch (err) {
      console.error(err)
      alert('Errore durante il caricamento')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => { onBack(); nav.indietro() }} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Pagamento</h1>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>
          {pagamento.Nome_Atleta || pagamento.ID_Atleta}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          {pagamento.Descrizione}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', color: 'var(--accent)', marginTop: '8px' }}>
          €{pagamento.Importo}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Scadenza: {pagamento.Data_Scadenza ? new Date(pagamento.Data_Scadenza).toLocaleDateString('it-IT') : '—'}
        </div>
      </div>

      <div className="section-title">Stato</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            className={`badge ${stato === 'Da pagare' ? 'badge-warn' : 'badge-muted'}`}
            style={{ cursor: 'pointer', padding: '10px 20px', fontSize: '15px', border: 'none', flex: 1, justifyContent: 'center' }}
            onClick={() => setStato('Da pagare')}
          >
            Da pagare
          </button>
          <button
            type="button"
            className={`badge ${stato === 'Pagato' ? 'badge-ok' : 'badge-muted'}`}
            style={{ cursor: 'pointer', padding: '10px 20px', fontSize: '15px', border: 'none', flex: 1, justifyContent: 'center' }}
            onClick={() => setStato('Pagato')}
          >
            Pagato ✓
          </button>
        </div>

        {stato === 'Pagato' && (
          <div className="form-group">
            <label className="form-label">Data pagamento</label>
            <input
              className="form-input"
              type="date"
              value={dataPagamento}
              onChange={e => setDataPagamento(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="section-title">Ricevuta</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => handleUploadRicevuta(e.target.files[0])}
          style={{ display: 'none' }}
          id="upload-ricevuta-noleggio"
        />
        <label
          htmlFor="upload-ricevuta-noleggio"
          className="btn btn-ghost"
          style={{
            fontSize: '13px', cursor: 'pointer', width: '100%', justifyContent: 'center',
            color: docCaricato ? 'var(--accent-ok)' : 'var(--text-secondary)',
            borderColor: docCaricato ? 'rgba(16,185,129,0.3)' : 'var(--border)'
          }}
        >
          {uploading ? 'Caricamento...' : docCaricato ? '✅ Ricevuta caricata (tap per sostituire)' : '📎 Carica ricevuta (foto o file)'}
        </label>
      </div>

      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginBottom: '24px' }}>
        {saving ? 'Salvataggio...' : 'Salva'}
      </button>
    </div>
  )
}
