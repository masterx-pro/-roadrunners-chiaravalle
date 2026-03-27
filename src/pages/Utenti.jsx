import { useState, useEffect } from 'react'
import { getUtentiAutorizzati, aggiungiRiga, aggiornaRiga, scriviLog } from '../utils/sheetsApi'
import { SHEETS } from '../config/google'

export default function Utenti() {
  const [sezione, setSezione] = useState(null) // null | 'utenti' | 'documenti'

  if (sezione === 'utenti') {
    return <GestioneUtenti onBack={() => setSezione(null)} />
  }

  if (sezione === 'documenti') {
    return <DocumentiUtili onBack={() => setSezione(null)} />
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Impostazioni</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button className="card" onClick={() => setSezione('utenti')} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', width: '100%' }}>
          <span style={{ fontSize: '32px' }}>👥</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Utenti</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Gestisci utenti autorizzati</div>
          </div>
        </button>

        <button className="card" onClick={() => setSezione('documenti')} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', textAlign: 'left', width: '100%' }}>
          <span style={{ fontSize: '32px' }}>📋</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', textTransform: 'uppercase' }}>Documenti utili</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Regolamenti e moduli</div>
          </div>
        </button>
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
