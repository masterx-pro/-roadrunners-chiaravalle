import { useState, useEffect } from 'react'
import { getUtentiAutorizzati, aggiungiRiga, aggiornaRiga, scriviLog, getConfigurazione, aggiornaParametro, getAtleti, getCategorie, getPattini, aggiornaCategorieBatch, creaCartelleMancanti, generaPagamentiNoleggioTrimestre, condividiConUtente, rimuoviCondivisione, inviaEmailBenvenuto } from '../utils/sheetsApi'
import { SHEETS } from '../config/google'

export default function Utenti() {
  const [sezione, setSezione] = useState(null)

  if (sezione === 'utenti') return <GestioneUtenti onBack={() => setSezione(null)} />
  if (sezione === 'documenti') return <DocumentiUtili onBack={() => setSezione(null)} />
  if (sezione === 'manutenzione') return <Manutenzione onBack={() => setSezione(null)} />
  if (sezione === 'parametri') return <Parametri onBack={() => setSezione(null)} />

  const cardStyle = { display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', width: '100%' }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Impostazioni</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button className="card" onClick={() => setSezione('utenti')} style={cardStyle}>
          <span style={{ fontSize: '32px' }}>👥</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Utenti</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Gestisci utenti autorizzati</div>
          </div>
        </button>

        <button className="card" onClick={() => setSezione('documenti')} style={cardStyle}>
          <span style={{ fontSize: '32px' }}>📋</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Documenti utili</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Regolamenti e moduli</div>
          </div>
        </button>

        <button className="card" onClick={() => setSezione('manutenzione')} style={cardStyle}>
          <span style={{ fontSize: '32px' }}>🔧</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Manutenzione</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Aggiorna categorie, cartelle, pagamenti</div>
          </div>
        </button>

        <button className="card" onClick={() => setSezione('parametri')} style={cardStyle}>
          <span style={{ fontSize: '32px' }}>⚙️</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Parametri società</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Quote, noleggio, scadenze</div>
          </div>
        </button>
      </div>

      {/* Card info app */}
      <div style={{ marginTop: '32px', textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Road Runners Gestionale
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '12px' }}>
          v1.1.0
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Sviluppato da <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Mattia Prosperi</span>
        </div>
        <a href="mailto:masterxpro@gmail.com" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-display)', letterSpacing: '0.3px' }}>
          masterxpro@gmail.com
        </a>
      </div>
    </div>
  )
}

// ============================================================
// DOCUMENTI UTILI
// ============================================================

const DOCUMENTI = [
  {
    nome: 'Regolamento Tecnico Corsa',
    descrizione: 'Stagione 2025/2026 — Skate Italia',
    href: 'https://drive.google.com/file/d/1L2bEyGIqyYWRGTBD3XV6HtRAPCkk9YzE/view',
  },
  {
    nome: 'Modello gara a squadre',
    descrizione: 'Modello ufficiale',
    href: 'https://drive.google.com/drive/folders/1eRHXgSUKDtWOkgzpOWDp1y_TERXp9kr9',
  },
  {
    nome: 'Depennamento tardivo',
    descrizione: 'Modulo depennamento',
    href: 'https://drive.google.com/file/d/14i8Sk_ngqTcBvCPTRL3OF89TKvKoiI2f/view',
  },
]

function DocumentiUtili({ onBack }) {
  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Documenti utili</h1>
      </div>

      <div className="card">
        {DOCUMENTI.map((doc, i) => (
          <a
            key={i}
            href={doc.href}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 0', textDecoration: 'none',
              borderBottom: i < DOCUMENTI.length - 1 ? '1px solid var(--border)' : 'none'
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-soft)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '22px', flexShrink: 0
            }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>
                {doc.nome}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                {doc.descrizione}
              </div>
            </div>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '13px', flexShrink: 0 }}>
              Apri →
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// GESTIONE UTENTI
// ============================================================

function GestioneUtenti({ onBack }) {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'nuovo' | 'modifica'
  const [utenteSelezionato, setUtenteSelezionato] = useState(null)
  const [indiceSelezionato, setIndiceSelezionato] = useState(null)

  function ricarica() {
    setLoading(true)
    getUtentiAutorizzati().then(u => { setUtenti(u); setLoading(false) })
  }

  useEffect(() => { ricarica() }, [])

  if (loading) return <div className="loading-center">Caricamento utenti...</div>

  if (vista === 'nuovo') {
    return <FormUtente
      titolo="Nuovo Utente"
      onBack={() => setVista('lista')}
      onSaved={() => { setVista('lista'); ricarica() }}
    />
  }

  if (vista === 'modifica' && utenteSelezionato) {
    return <FormUtente
      titolo="Modifica Utente"
      utente={utenteSelezionato}
      indice={indiceSelezionato}
      onBack={() => { setVista('lista'); setUtenteSelezionato(null) }}
      onSaved={() => { setVista('lista'); setUtenteSelezionato(null); ricarica() }}
    />
  }

  async function toggleAttivo(utente, idx) {
    const nuovoStato = utente.Attivo === 'TRUE' ? 'FALSE' : 'TRUE'
    await aggiornaRiga(SHEETS.UTENTI, idx, [
      utente.Email, utente.Nome, utente.Ruolo || 'Dirigente', nuovoStato
    ])

    // Gestisci condivisione Sheet/Drive
    try {
      if (nuovoStato === 'FALSE') {
        await rimuoviCondivisione(utente.Email)
      } else {
        await condividiConUtente(utente.Email)
      }
    } catch (e) {
      console.error('Errore gestione condivisione:', e)
    }

    ricarica()
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Utenti</h1>
        <button className="btn btn-primary" onClick={() => setVista('nuovo')} style={{ padding: '6px 14px', fontSize: '18px', lineHeight: 1 }}>
          +
        </button>
      </div>

      <div className="card">
        {utenti.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-text">Nessun utente configurato</div>
          </div>
        ) : (
          utenti.map((u, idx) => (
            <div key={u.Email || idx} className="atleta-row" style={{ cursor: 'default' }}>
              <div className="atleta-avatar" style={{ background: u.Attivo === 'TRUE' ? 'var(--accent-soft)' : 'var(--bg-elevated)', color: u.Attivo === 'TRUE' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {u.Nome ? u.Nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?'}
              </div>
              <div
                className="atleta-info"
                style={{ cursor: 'pointer' }}
                onClick={() => { setUtenteSelezionato(u); setIndiceSelezionato(idx); setVista('modifica') }}
              >
                <div className="atleta-nome">{u.Nome || '—'}</div>
                <div className="atleta-sub">{u.Email || '—'}</div>
              </div>
              <span className="badge badge-muted" style={{ marginRight: '6px', fontSize: '11px' }}>
                {u.Ruolo || 'Dirigente'}
              </span>
              <button
                className={`badge ${u.Attivo === 'TRUE' ? 'badge-ok' : 'badge-danger'}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => toggleAttivo(u, idx)}
              >
                {u.Attivo === 'TRUE' ? 'Attivo' : 'Non attivo'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function FormUtente({ titolo, utente, indice, onBack, onSaved }) {
  const [email, setEmail] = useState(utente?.Email || '')
  const [nome, setNome] = useState(utente?.Nome || '')
  const [ruolo, setRuolo] = useState(utente?.Ruolo || 'Dirigente')
  const [attivo, setAttivo] = useState(utente ? utente.Attivo === 'TRUE' : true)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [successo, setSuccesso] = useState(false)

  const isModifica = !!utente

  async function handleSalva() {
    if (!email.trim() || !nome.trim()) {
      setErrore('Email e Nome sono obbligatori')
      return
    }
    setSaving(true)
    setErrore(null)
    try {
      const valori = [email.trim(), nome.trim(), ruolo.trim() || 'Dirigente', attivo ? 'TRUE' : 'FALSE']
      if (isModifica) {
        await aggiornaRiga(SHEETS.UTENTI, indice, valori)
      } else {
        await aggiungiRiga(SHEETS.UTENTI, valori)
        await scriviLog('Nuovo', 'Utente', email.trim())

        // Auto-condivisione Sheet e Drive
        try {
          await condividiConUtente(email.trim())
        } catch (e) {
          console.error('Errore condivisione:', e)
        }

        // Invio email di benvenuto
        try {
          await inviaEmailBenvenuto(email.trim(), nome.trim())
        } catch (e) {
          console.error('Errore invio email:', e)
        }
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--accent-ok)' }}>
          {isModifica ? 'Utente aggiornato' : 'Utente creato'}
        </div>
        {!isModifica && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', maxWidth: '280px' }}>
            Email di accesso inviata a {email}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>{titolo}</h1>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="utente@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Nome *</label>
          <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome Cognome" />
        </div>
        <div className="form-group">
          <label className="form-label">Ruolo</label>
          <input className="form-input" value={ruolo} onChange={e => setRuolo(e.target.value)} placeholder="Dirigente" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="form-label" style={{ marginBottom: 0 }}>Attivo</span>
          <button
            className={`badge ${attivo ? 'badge-ok' : 'badge-danger'}`}
            style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => setAttivo(!attivo)}
          >
            {attivo ? 'SI' : 'NO'}
          </button>
        </div>
      </div>

      {errore && (
        <div className="card" style={{ borderColor: 'rgba(232,51,74,0.4)', marginTop: '8px' }}>
          <div style={{ color: '#FF6B7A', fontSize: '14px', textAlign: 'center' }}>{errore}</div>
        </div>
      )}

      <button className="btn btn-primary btn-full" onClick={handleSalva} disabled={saving} style={{ marginTop: '12px' }}>
        {saving ? 'Salvataggio...' : isModifica ? 'Salva modifiche' : 'Aggiungi utente'}
      </button>
    </div>
  )
}

// ============================================================
// MANUTENZIONE
// ============================================================

function Manutenzione({ onBack }) {
  const [esecuzione, setEsecuzione] = useState(null)
  const [risultato, setRisultato] = useState(null)
  const [ultimoCheck, setUltimoCheck] = useState(localStorage.getItem('ultimo_check_manutenzione') || null)

  async function eseguiBatch(tipo) {
    setEsecuzione(tipo)
    setRisultato(null)
    try {
      let messaggio = ''

      if (tipo === 'categorie') {
        const [atleti, categorie] = await Promise.all([getAtleti(), getCategorie()])
        const aggiornati = await aggiornaCategorieBatch(atleti, categorie)
        messaggio = aggiornati > 0
          ? `${aggiornati} atleti aggiornati`
          : 'Tutte le categorie sono corrette'
      }

      if (tipo === 'cartelle') {
        const atleti = await getAtleti()
        const creati = await creaCartelleMancanti(atleti)
        messaggio = creati > 0
          ? `${creati} cartelle create`
          : 'Tutti gli atleti hanno la cartella Drive'
      }

      if (tipo === 'pagamenti') {
        const generati = await generaPagamentiNoleggioTrimestre()
        messaggio = generati > 0
          ? `${generati} pagamenti generati`
          : 'Tutti i pagamenti noleggio sono presenti'
      }

      if (tipo === 'tutto') {
        const [atleti, categorie] = await Promise.all([getAtleti(), getCategorie()])
        const cat = await aggiornaCategorieBatch(atleti, categorie)
        const cart = await creaCartelleMancanti(atleti)
        const pag = await generaPagamentiNoleggioTrimestre()
        messaggio = `Completato — Categorie: ${cat}, Cartelle: ${cart}, Pagamenti: ${pag}`
      }

      const ora = new Date().toLocaleString('it-IT')
      localStorage.setItem('ultimo_check_manutenzione', ora)
      setUltimoCheck(ora)
      setRisultato({ ok: true, messaggio })
    } catch (err) {
      console.error(err)
      setRisultato({ ok: false, messaggio: 'Errore: ' + err.message })
    } finally {
      setEsecuzione(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Manutenzione</h1>
      </div>

      {ultimoCheck && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
          Ultimo check: {ultimoCheck}
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-primary btn-full"
          onClick={() => eseguiBatch('tutto')}
          disabled={esecuzione !== null}
          style={{ marginBottom: '8px' }}
        >
          {esecuzione === 'tutto' ? 'Esecuzione in corso...' : 'Esegui tutto'}
        </button>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
          Aggiorna categorie + cartelle Drive + pagamenti noleggio
        </div>
      </div>

      <div className="section-title">Operazioni singole</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Aggiorna categorie</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Ricalcola per anno nascita e stagione</div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => eseguiBatch('categorie')}
            disabled={esecuzione !== null}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            {esecuzione === 'categorie' ? '...' : 'Esegui'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Verifica cartelle Drive</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Crea cartelle mancanti per atleti</div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => eseguiBatch('cartelle')}
            disabled={esecuzione !== null}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            {esecuzione === 'cartelle' ? '...' : 'Esegui'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Genera pagamenti noleggio</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Pagamenti trimestrali mancanti</div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => eseguiBatch('pagamenti')}
            disabled={esecuzione !== null}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            {esecuzione === 'pagamenti' ? '...' : 'Esegui'}
          </button>
        </div>
      </div>

      {risultato && (
        <div className="card" style={{ marginTop: '16px', borderColor: risultato.ok ? 'rgba(16,185,129,0.3)' : 'rgba(232,51,74,0.4)' }}>
          <div style={{ textAlign: 'center', fontSize: '14px', color: risultato.ok ? 'var(--accent-ok)' : '#FF6B7A' }}>{risultato.messaggio}</div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PARAMETRI
// ============================================================

function Parametri({ onBack }) {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editando, setEditando] = useState(null)
  const [valoreEdit, setValoreEdit] = useState('')

  useEffect(() => {
    getConfigurazione().then(c => { setConfig(c); setLoading(false) })
  }, [])

  async function handleSalva(parametro) {
    setSaving(parametro)
    try {
      await aggiornaParametro(parametro, valoreEdit)
      setConfig(prev => ({ ...prev, [parametro]: valoreEdit }))
      setEditando(null)
    } catch (err) {
      console.error(err)
      alert('Errore durante il salvataggio')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="loading-center">Caricamento parametri...</div>

  const parametri = [
    { key: 'Quota_Annuale', label: 'Quota associativa annuale', prefisso: '€', tipo: 'number' },
    { key: 'Costo_Noleggio_Mensile', label: 'Costo noleggio mensile', prefisso: '€', tipo: 'number' },
    { key: 'Scadenza_Rata_1', label: 'Mese scadenza rata 1', suffisso: '(1-12)', tipo: 'number' },
    { key: 'Scadenza_Rata_2', label: 'Mese scadenza rata 2', suffisso: '(1-12)', tipo: 'number' },
    { key: 'Nome_Societa', label: 'Nome società', tipo: 'text' },
    { key: 'Citta_Societa', label: 'Città', tipo: 'text' },
    { key: 'Stagione', label: 'Stagione sportiva', tipo: 'text' },
    { key: 'Email_Societa', label: 'Email società', tipo: 'email' },
  ]

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>← Indietro</button>
        <h1 className="page-title" style={{ fontSize: '22px' }}>Parametri</h1>
      </div>

      <div className="card">
        {parametri.map((p, i) => (
          <div key={p.key} style={{ padding: '12px 0', borderBottom: i < parametri.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{p.label}</div>
                {editando !== p.key && (
                  <div style={{ fontSize: '16px', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: '700', marginTop: '4px' }}>
                    {p.prefisso || ''}{config[p.key] || '—'}{p.suffisso ? ` ${p.suffisso}` : ''}
                  </div>
                )}
              </div>
              {editando !== p.key && (
                <button
                  className="btn btn-ghost"
                  onClick={() => { setEditando(p.key); setValoreEdit(config[p.key] || '') }}
                  style={{ padding: '4px 10px', fontSize: '14px' }}
                >
                  Modifica
                </button>
              )}
            </div>

            {editando === p.key && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  type={p.tipo}
                  value={valoreEdit}
                  onChange={e => setValoreEdit(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSalva(p.key)}
                  disabled={saving === p.key}
                  style={{ padding: '8px 16px' }}
                >
                  {saving === p.key ? '...' : 'Salva'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditando(null)}
                  style={{ padding: '8px 12px' }}
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
