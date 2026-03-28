import { useState, useEffect } from 'react'
import { getAtleti, getPattini, getCategorie, creaAtleta, assegnaPattino, aggiungiRiga, aggiornaRiga, aggiornaCategoria, buildAtletaRow, listaDocumentiAtleta, caricaDocumento, eliminaDocumento, creaCartellaAtleta, scriviLog, getPagamentiAtleta, aggiornaPagamento, generaQuoteAtleta } from '../utils/sheetsApi'
import { SHEETS, PAGAMENTI_CONFIG } from '../config/google'
import { formattaData, statoScadenza, giorniAllaScadenza } from '../utils/dateUtils'
import { esportaAtletiExcel, esportaAtletiPDF } from '../utils/exportUtils'

export default function Atleti() {
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

  function ricarica() {
    setLoading(true)
    Promise.all([getAtleti(), getPattini(), getCategorie()]).then(([a, p, c]) => {
      setAtleti(a)
      setPattini(p)
      setCategorie(c)
      setLoading(false)
    })
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento atleti...</div>

  if (vista === 'nuovo') {
    return <NuovoAtleta onBack={() => setVista('lista')} onSaved={() => {
      setVista('lista')
      ricarica()
    }} />
  }

  if (vista === 'categorie') {
    return <GestioneCategorie onBack={() => setVista('lista')} />
  }

  if (vista === 'modifica' && atletaSelezionato) {
    return <ModificaAtleta
      atleta={atletaSelezionato}
      atleti={atleti}
      onBack={() => setVista('scheda')}
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
        onBack={() => { setAtletaSelezionato(null); setVista('lista') }}
        onModifica={() => setVista('modifica')}
        onDisattivato={() => { setAtletaSelezionato(null); setVista('lista'); ricarica() }}
      />
    )
  }

  const categorieAttive = categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim()))

  // Nomi categoria unici (senza sesso) per il filtro
  const nomiCategoriaUnici = [...new Set(categorieAttive.map(c => c.Nome?.replace(/ [MF]$/, '')))]

  const atletiFiltrati = atleti
    .filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
    .filter(a => filtroSesso === 'tutti' || a.Sesso === filtroSesso)
    .filter(a => filtroCategoria === 'tutte' || a.Nome_Categoria === filtroCategoria || a.Nome_Categoria?.replace(/ [MF]$/, '') === filtroCategoria)
    .filter(a => {
      const nome = `${a.Nome} ${a.Cognome}`.toLowerCase()
      return nome.includes(cerca.toLowerCase())
    })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Atleti</h1>
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
          <button className="btn btn-ghost" onClick={() => setVista('categorie')} style={{ padding: '6px 12px', fontSize: '13px' }}>
            Categorie
          </button>
          <button className="btn btn-primary" onClick={() => setVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>
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
            <AtletaRow key={a.ID_Atleta} atleta={a} onClick={() => { setAtletaSelezionato(a); setVista('scheda') }} />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// FORM ATLETA (condiviso tra Nuovo e Modifica)
// ============================================================

function calcolaCategoriaSuggerita(dataNascita, sesso, categorie) {
  if (!dataNascita || !sesso) return null
  const oggi = new Date()
  const nascita = new Date(dataNascita)
  const eta = oggi.getFullYear() - nascita.getFullYear()

  const cat = categorie.find(c =>
    c.Sesso === sesso &&
    parseInt(c.Età_Min) <= eta &&
    eta <= parseInt(c.Età_Max) &&
    ['TRUE', 'true', 'True'].includes(c.Attiva?.trim())
  )
  return cat || null
}

function FormAtleta({ form, update, categorie, titolo, onBack, onSalva, saving, errore, mostraNoleggio = true }) {
  const categoriaSuggerita = calcolaCategoriaSuggerita(form.dataNascita, form.sesso, categorie)

  // Auto-preseleziona categoria quando cambia suggerimento
  useEffect(() => {
    if (categoriaSuggerita && !form.idCategoria) {
      update('idCategoria', categoriaSuggerita.ID_Categoria)
    }
  }, [categoriaSuggerita?.ID_Categoria])

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>{titolo}</h1>
      </div>

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
            {categorie.filter(c => ['TRUE', 'true', 'True'].includes(c.Attiva?.trim())).map(c => (
              <option key={c.ID_Categoria} value={c.ID_Categoria}>{c.Nome}</option>
            ))}
          </select>
          {categoriaSuggerita && (
            <div style={{ color: 'var(--accent-ok)', fontSize: '12px', marginTop: '4px' }}>
              Categoria suggerita per eta: {categoriaSuggerita.Nome}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Numero di gara</label>
          <input className="form-input" value={form.numeroGara} onChange={e => update('numeroGara', e.target.value)} placeholder="es. 42" />
        </div>
        <div className="form-group">
          <label className="form-label">Quota personalizzata (€)</label>
          <input className="form-input" type="number" value={form.quotaPersonalizzata} onChange={e => update('quotaPersonalizzata', e.target.value)} placeholder={`Standard: ${PAGAMENTI_CONFIG.QUOTA_ANNUALE}€`} />
        </div>
        {titolo === 'Nuovo Atleta' && (
          <div className="form-group">
            <label className="form-label">Tipo rate</label>
            <select className="form-input" value={form.tipoRate || '1'} onChange={e => update('tipoRate', e.target.value)}>
              <option value="1">Annuale (unica soluzione)</option>
              <option value="2">2 rate (semestrale)</option>
            </select>
          </div>
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

function NuovoAtleta({ onBack, onSaved }) {
  const [categorie, setCategorie] = useState([])
  const [saving, setSaving] = useState(false)
  const [successo, setSuccesso] = useState(false)
  const [errore, setErrore] = useState(null)
  const [form, setForm] = useState({
    nome: '', cognome: '', sesso: '', luogoNascita: '', dataNascita: '', codiceFiscale: '',
    idCategoria: '', genitoreNome: '', genitoreTelefono: '',
    genitoreEmail: '', scadCertificato: '', numeroFISR: '',
    scadFISR: '', dataIscrizione: new Date().toISOString().split('T')[0],
    note: '', noleggio: false, taglia: '', numeroGara: '',
    quotaPersonalizzata: '', tipoRate: '1'
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
      const idAtleta = await creaAtleta(form)

      // Crea cartella Drive e aggiorna riga atleta
      try {
        const driveFolderId = await creaCartellaAtleta(`${form.nome}_${form.cognome}`, idAtleta)
        if (driveFolderId) {
          const tuttiAtleti = await getAtleti()
          const idx = tuttiAtleti.findIndex(a => a.ID_Atleta === idAtleta)
          if (idx !== -1) {
            await aggiornaRiga(SHEETS.ATLETI, idx, buildAtletaRow(tuttiAtleti[idx], { Drive_Folder_ID: driveFolderId }))
          }
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
        : PAGAMENTI_CONFIG.QUOTA_ANNUALE
      if (importoQuota > 0) {
        await generaQuoteAtleta(idAtleta, `${form.nome} ${form.cognome}`, importoQuota, form.tipoRate || '1')
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
      const idx = atleti.findIndex(a => a.ID_Atleta === atleta.ID_Atleta)
      if (idx === -1) throw new Error('Atleta non trovato')

      const valori = buildAtletaRow(atleta, {
        Nome: form.nome, Cognome: form.cognome, Sesso: form.sesso,
        Luogo_Nascita: form.luogoNascita, Data_Nascita: form.dataNascita,
        Codice_Fiscale: form.codiceFiscale, ID_Categoria: form.idCategoria,
        Genitore_Nome: form.genitoreNome, Nome_Categoria: '',
        Genitore_Telefono: form.genitoreTelefono, Genitore_Email: form.genitoreEmail,
        Scad_Certificato: form.scadCertificato, Scad_FISR: form.scadFISR,
        Numero_FISR: form.numeroFISR, Data_Iscrizione: form.dataIscrizione,
        Note: form.note, Numero_Gara: form.numeroGara,
        Quota_Personalizzata: form.quotaPersonalizzata
      })

      await aggiornaRiga(SHEETS.ATLETI, idx, valori)
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
  const statoCert = statoScadenza(atleta.Scad_Certificato)
  const haAlert = statoCert === 'scaduto' || statoCert === 'urgente' || statoCert === 'in_scadenza' || statoCert === 'mancante'

  return (
    <div className="atleta-row" onClick={onClick}>
      <div className="atleta-avatar">{iniziali}</div>
      <div className="atleta-info">
        <div className="atleta-nome">{atleta.Nome} {atleta.Cognome}</div>
        <div className="atleta-sub">{atleta.Nome_Categoria || '—'}</div>
      </div>
      {haAlert && (
        <span className={`badge ${statoCert === 'scaduto' ? 'badge-danger' : statoCert === 'urgente' ? 'badge-urgente' : statoCert === 'in_scadenza' ? 'badge-warn' : 'badge-danger'}`}>
          {statoCert === 'mancante' ? '!' : statoCert === 'scaduto' ? 'Scaduto' : `${giorniAllaScadenza(atleta.Scad_Certificato)}gg`}
        </span>
      )}
      <ChevronIcon />
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

function SchedaAtleta({ atleta, atleti, pattini, onBack, onModifica, onDisattivato }) {
  const [documenti, setDocumenti] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(null) // null o chiave identificativa
  const [confermaDisattiva, setConfermaDisattiva] = useState(false)
  const [disattivando, setDisattivando] = useState(false)
  const [folderId, setFolderId] = useState(atleta.Drive_Folder_ID || '')
  const [creandoCartella, setCreandoCartella] = useState(false)
  const [nuovoDocForm, setNuovoDocForm] = useState(false)
  const [nuovoDocNome, setNuovoDocNome] = useState('')
  const [nuovoDocFile, setNuovoDocFile] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  const CATEGORIE_DOC = [
    { key: 'certificato_medico', label: 'Certificato medico', icona: '🏥' },
    { key: 'tessera_fisr', label: 'Tessera FISR', icona: '🪪' },
    { key: 'liberatoria_privacy', label: 'Liberatoria privacy', icona: '📝' },
  ]

  const PREFISSI_CATEGORIA = ['certificato_medico', 'tessera_fisr', 'liberatoria_privacy']

  const pattiniAtleta = pattini.filter(p => p.ID_Atleta === atleta.ID_Atleta)
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
    }
  }, [folderId])

  function trovaDocPerCategoria(catKey) {
    return documenti.find(d => d.name?.toLowerCase().startsWith(catKey))
  }

  function documentiExtra() {
    return documenti.filter(d =>
      !PREFISSI_CATEGORIA.some(p => d.name?.toLowerCase().startsWith(p))
    )
  }

  async function handleCreaCartella() {
    setCreandoCartella(true)
    try {
      const newFolderId = await creaCartellaAtleta(`${atleta.Nome}_${atleta.Cognome}`, atleta.ID_Atleta)
      if (newFolderId) {
        const idx = atleti.findIndex(a => a.ID_Atleta === atleta.ID_Atleta)
        if (idx !== -1) {
          await aggiornaRiga(SHEETS.ATLETI, idx, buildAtletaRow(atleti[idx], { Drive_Folder_ID: newFolderId }))
        }
        setFolderId(newFolderId)
      }
    } catch (err) {
      console.error('Errore creazione cartella:', err)
    } finally {
      setCreandoCartella(false)
    }
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
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{atleta.Nome_Categoria || '—'}</p>
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
      <div className="section-title">Scadenze</div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Certificato medico</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{formattaData(atleta.Scad_Certificato)}</div>
          </div>
          {badgeStato(statoCert)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Tessera FISR</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {atleta.Numero_FISR || '—'} · {formattaData(atleta.Scad_FISR)}
            </div>
          </div>
          {badgeStato(statoFISR)}
        </div>
      </div>

      {/* PATTINI */}
      {pattiniAtleta.length > 0 && (
        <>
          <div className="section-title">Pattini in noleggio</div>
          <div className="card">
            {pattiniAtleta.map(p => (
              <div key={p.ID_Pattino} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{p.Marca || p.ID_Pattino} — Taglia {p.Taglia}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Dal {formattaData(p.Data_Inizio_Noleggio)}</div>
                </div>
                <span className={`badge ${p.Stato_Pagamento === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}>
                  {p.Stato_Pagamento}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PAGAMENTI */}
      <SezionePagamenti atleta={atleta} pattini={pattiniAtleta} />

      {/* DOCUMENTI */}
      <div className="section-title">Documenti</div>
      <div className="card">
        {!folderId ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
              Cartella Drive non configurata
            </div>
            <button className="btn btn-primary btn-full" onClick={handleCreaCartella} disabled={creandoCartella}>
              {creandoCartella ? 'Creazione...' : 'Crea cartella documenti'}
            </button>
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
                const idx = atleti.findIndex(a => a.ID_Atleta === atleta.ID_Atleta)
                if (idx === -1) throw new Error('Atleta non trovato')
                await aggiornaRiga(SHEETS.ATLETI, idx, buildAtletaRow(atleta, { Attivo: 'FALSE' }))
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
// SEZIONE PAGAMENTI
// ============================================================

function SezionePagamenti({ atleta, pattini }) {
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

  // Calcolo noleggio
  const noleggioInfo = pattini.map(p => {
    if (!p.Data_Inizio_Noleggio) return null
    const inizio = new Date(p.Data_Inizio_Noleggio)
    const oggi = new Date()
    const mesi = Math.max(1, Math.round((oggi - inizio) / (1000 * 60 * 60 * 24 * 30)))
    const importo = mesi * PAGAMENTI_CONFIG.COSTO_NOLEGGIO_MENSILE
    return { ...p, mesi, importo }
  }).filter(Boolean)

  return (
    <>
      <div className="section-title">Pagamenti</div>
      <div className="card">
        {loading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Caricamento...</div>
        ) : (
          <>
            {/* Quote associative */}
            {pagamenti.length === 0 && noleggioInfo.length === 0 && (
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

            {/* Riepilogo noleggio */}
            {noleggioInfo.map(n => (
              <div key={n.ID_Pattino} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>Noleggio {n.Marca || n.ID_Pattino} T.{n.Taglia}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {n.mesi} mesi · €{n.importo} (€{PAGAMENTI_CONFIG.COSTO_NOLEGGIO_MENSILE}/mese)
                  </div>
                </div>
                <span className={`badge ${n.Stato_Pagamento === 'Pagato' ? 'badge-ok' : 'badge-warn'}`}>
                  {n.Stato_Pagamento || 'Da pagare'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
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
