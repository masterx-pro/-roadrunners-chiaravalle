import { useState, useEffect } from 'react'
import { getAtleti, getPattini, listaDocumentiAtleta, caricaDocumento } from '../utils/sheetsApi'
import { formattaData, statoScadenza, giorniAllaScadenza } from '../utils/dateUtils'

export default function Atleti() {
  const [atleti, setAtleti] = useState([])
  const [pattini, setPattini] = useState([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [atletaSelezionato, setAtletaSelezionato] = useState(null)

  useEffect(() => {
    async function carica() {
      const [a, p] = await Promise.all([getAtleti(), getPattini()])
      setAtleti(a)
      setPattini(p)
      setLoading(false)
    }
    carica()
  }, [])

  if (loading) return <div className="loading-center">Caricamento atleti...</div>

  if (atletaSelezionato) {
    return (
      <SchedaAtleta
        atleta={atletaSelezionato}
        pattini={pattini}
        onBack={() => setAtletaSelezionato(null)}
      />
    )
  }

  const atletiFiltrati = atleti
    .filter(a => a.Attivo === 'TRUE')
    .filter(a => {
      const nome = `${a.Nome} ${a.Cognome}`.toLowerCase()
      return nome.includes(cerca.toLowerCase())
    })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Atleti</h1>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
          {atletiFiltrati.length}
        </span>
      </div>

      <div className="search-bar">
        <SearchIcon />
        <input
          placeholder="Cerca atleta..."
          value={cerca}
          onChange={e => setCerca(e.target.value)}
        />
      </div>

      <div className="card">
        {atletiFiltrati.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-text">Nessun atleta trovato</div>
          </div>
        ) : (
          atletiFiltrati.map(a => (
            <AtletaRow key={a.ID_Atleta} atleta={a} onClick={() => setAtletaSelezionato(a)} />
          ))
        )}
      </div>
    </div>
  )
}

function AtletaRow({ atleta, onClick }) {
  const iniziali = `${atleta.Nome?.[0] ?? ''}${atleta.Cognome?.[0] ?? ''}`
  const statoCert = statoScadenza(atleta.Scad_Certificato)
  const haAlert = statoCert === 'scaduto' || statoCert === 'in_scadenza' || statoCert === 'mancante'

  return (
    <div className="atleta-row" onClick={onClick}>
      <div className="atleta-avatar">{iniziali}</div>
      <div className="atleta-info">
        <div className="atleta-nome">{atleta.Nome} {atleta.Cognome}</div>
        <div className="atleta-sub">{atleta.ID_Categoria || 'Categoria —'}</div>
      </div>
      {haAlert && (
        <span className={`badge ${statoCert === 'ok' ? 'badge-ok' : 'badge-danger'}`}>
          {statoCert === 'mancante' ? '!' : `${giorniAllaScadenza(atleta.Scad_Certificato)}gg`}
        </span>
      )}
      <ChevronIcon />
    </div>
  )
}

function SchedaAtleta({ atleta, pattini, onBack }) {
  const [documenti, setDocumenti] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pattiniAtleta = pattini.filter(p => p.ID_Atleta === atleta.ID_Atleta)
  const statoCert = statoScadenza(atleta.Scad_Certificato)
  const statoFISR = statoScadenza(atleta.Scad_FISR)

  useEffect(() => {
    if (atleta.Drive_Folder_ID) {
      setLoadingDocs(true)
      listaDocumentiAtleta(atleta.Drive_Folder_ID)
        .then(setDocumenti)
        .finally(() => setLoadingDocs(false))
    }
  }, [atleta.Drive_Folder_ID])

  async function handleCaricaDoc(e) {
    const file = e.target.files[0]
    if (!file || !atleta.Drive_Folder_ID) return
    setUploading(true)
    try {
      await caricaDocumento(file, file.name, atleta.Drive_Folder_ID)
      const docs = await listaDocumentiAtleta(atleta.Drive_Folder_ID)
      setDocumenti(docs)
    } finally {
      setUploading(false)
    }
  }

  const badgeStato = (stato) => {
    if (stato === 'ok') return <span className="badge badge-ok">OK</span>
    if (stato === 'in_scadenza') return <span className="badge badge-warn">In scadenza</span>
    if (stato === 'scaduto') return <span className="badge badge-danger">Scaduto</span>
    return <span className="badge badge-danger">Mancante</span>
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 12px' }}>
          ← Indietro
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
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{atleta.ID_Categoria}</p>
      </div>

      {/* DATI PERSONALI */}
      <div className="section-title">Dati personali</div>
      <div className="card">
        <InfoRow label="Data di nascita" value={formattaData(atleta.Data_Nascita)} />
        <InfoRow label="Codice fiscale"  value={atleta.Codice_Fiscale || '—'} />
        <InfoRow label="Iscritto dal"    value={formattaData(atleta.Data_Iscrizione)} />
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
                  <div style={{ fontWeight: '600' }}>{p.Numero_Identificativo} — Taglia {p.Taglia}</div>
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

      {/* DOCUMENTI */}
      <div className="section-title">Documenti</div>
      <div className="card">
        {!atleta.Drive_Folder_ID ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Cartella Drive non configurata
          </div>
        ) : loadingDocs ? (
          <div style={{ color: 'var(--text-secondary)' }}>Caricamento...</div>
        ) : (
          <>
            {documenti.map(doc => (
              <a
                key={doc.id}
                href={doc.webViewLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                  color: 'var(--text-primary)', textDecoration: 'none'
                }}
              >
                <span>📄</span>
                <span style={{ fontSize: '14px' }}>{doc.name}</span>
              </a>
            ))}
            <label style={{ display: 'block', marginTop: '12px' }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleCaricaDoc} />
              <span className="btn btn-ghost btn-full" style={{ display: 'flex' }}>
                {uploading ? 'Caricamento...' : '+ Carica documento'}
              </span>
            </label>
          </>
        )}
      </div>
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
