import { useState, useEffect } from 'react'
import {
  getTrolley, getRuote, calcolaDisponibilitaRuote,
  aggiuntaTrolley, restituisciTrolleyVoce, restituisciTrolleyTutto
} from '../utils/sheetsApi'

const NOMI = { 'TRL-J': 'Trolley Junior', 'TRL-S': 'Trolley Senior' }

export default function TrolleyPanel({ onClose }) {
  const [trolleyAttivo, setTrolleyAttivo] = useState(null)
  const [vistaTrolley, setVistaTrolley] = useState('menu')
  const [voci, setVoci] = useState([])
  const [ruoteMagazzino, setRuoteMagazzino] = useState([])
  const [loading, setLoading] = useState(false)

  async function apriTrolley(idTrolley, vista) {
    setLoading(true)
    setTrolleyAttivo(idTrolley)
    setVistaTrolley(vista)
    try {
      const [v, r] = await Promise.all([getTrolley(idTrolley), getRuote()])
      setVoci(v)
      setRuoteMagazzino(r)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!trolleyAttivo) {
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
          🧳 Trolley
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => apriTrolley('TRL-J', 'menu')}>
            🧳 Trolley Junior
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => apriTrolley('TRL-S', 'menu')}>
            🧳 Trolley Senior
          </button>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', fontSize: '12px', color: 'var(--text-secondary)' }} onClick={onClose}>
          Chiudi
        </button>
      </div>
    )
  }

  if (loading) return <div className="loading-center">Caricamento...</div>

  if (vistaTrolley === 'menu') {
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
          🧳 {NOMI[trolleyAttivo]}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setVistaTrolley('seleziona')}>
            ➕ Aggiungi ruote
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setVistaTrolley('visualizza')}>
            👁 Visualizza
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: '12px' }} onClick={() => setTrolleyAttivo(null)}>
            ← Cambia trolley
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }} onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  if (vistaTrolley === 'seleziona') {
    return (
      <TrolleySeleziona
        idTrolley={trolleyAttivo}
        nomeTrolley={NOMI[trolleyAttivo]}
        ruoteMagazzino={ruoteMagazzino}
        onSalvato={async () => {
          const v = await getTrolley(trolleyAttivo)
          setVoci(v)
          setVistaTrolley('visualizza')
        }}
        onAnnulla={() => setVistaTrolley('menu')}
      />
    )
  }

  if (vistaTrolley === 'visualizza') {
    return (
      <TrolleyVisualizza
        idTrolley={trolleyAttivo}
        nomeTrolley={NOMI[trolleyAttivo]}
        voci={voci}
        ruoteMagazzino={ruoteMagazzino}
        onAggiornato={setVoci}
        onAnnulla={() => setVistaTrolley('menu')}
      />
    )
  }

  return null
}

function TrolleySeleziona({ idTrolley, nomeTrolley, ruoteMagazzino, onSalvato, onAnnulla }) {
  const [ruoteConDisp, setRuoteConDisp] = useState([])
  const [selezioni, setSelezioni] = useState({})
  const [filtroDiametro, setFiltroDiametro] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function carica() {
      try {
        const conDisp = await calcolaDisponibilitaRuote(ruoteMagazzino)
        const disponibili = conDisp.filter(r => r.Quantita_Disponibile > 0)
        setRuoteConDisp(disponibili)
        const init = {}
        disponibili.forEach(r => { init[r.ID_Set] = 0 })
        setSelezioni(init)
      } finally {
        setLoading(false)
      }
    }
    carica()
  }, [])

  const diametri = [...new Set(ruoteConDisp.map(r => r.Diametro_mm).filter(Boolean))]
    .sort((a, b) => parseInt(a) - parseInt(b))
  const ruoteFiltrate = filtroDiametro
    ? ruoteConDisp.filter(r => r.Diametro_mm === filtroDiametro)
    : ruoteConDisp

  async function handleSalva() {
    const daAggiungere = Object.entries(selezioni).filter(([, q]) => parseInt(q) > 0)
    if (daAggiungere.length === 0) { alert('Seleziona almeno un set'); return }
    setSaving(true)
    try {
      for (const [idSet, quantita] of daAggiungere) {
        const set = ruoteMagazzino.find(r => r.ID_Set === idSet)
        if (!set) continue
        await aggiuntaTrolley(
          idTrolley, idSet, set.Nome || '',
          set.Diametro_mm || '', set.Durezza_A || '',
          parseInt(quantita), ''
        )
      }
      onSalvato()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-center">Caricamento...</div>

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '12px' }}>
        ➕ {nomeTrolley} — Aggiungi ruote
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          className={`badge ${!filtroDiametro ? 'badge-danger' : 'badge-muted'}`}
          style={{ cursor: 'pointer', border: 'none', padding: '6px 10px', fontSize: '12px' }}
          onClick={() => setFiltroDiametro(null)}
        >
          Tutti
        </button>
        {diametri.map(d => (
          <button
            key={d}
            className={`badge ${filtroDiametro === d ? 'badge-danger' : 'badge-muted'}`}
            style={{ cursor: 'pointer', border: 'none', padding: '6px 10px', fontSize: '12px' }}
            onClick={() => setFiltroDiametro(filtroDiametro === d ? null : d)}
          >
            {d}mm
          </button>
        ))}
      </div>

      {ruoteFiltrate.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>
          Nessuna ruota disponibile
        </div>
      ) : ruoteFiltrate.map(r => (
        <div key={r.ID_Set} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>{r.Nome || `${r.Diametro_mm}mm`}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {r.Diametro_mm}mm · {r.Durezza_A} · {r.Quantita_Disponibile} disp.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="0"
              max={r.Quantita_Disponibile}
              value={selezioni[r.ID_Set] || 0}
              onChange={e => setSelezioni(prev => ({ ...prev, [r.ID_Set]: e.target.value === '' ? 0 : e.target.value }))}
              style={{ width: '56px', padding: '6px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ruote</span>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button className="btn btn-primary" onClick={handleSalva} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Salvataggio...' : '🧳 Aggiungi al trolley'}
        </button>
        <button className="btn btn-ghost" onClick={onAnnulla} style={{ flex: 1 }}>Annulla</button>
      </div>
    </div>
  )
}

function TrolleyVisualizza({ idTrolley, nomeTrolley, voci, ruoteMagazzino, onAggiornato, onAnnulla }) {
  const [saving, setSaving] = useState(null)
  const [savingTutto, setSavingTutto] = useState(false)
  const totale = voci.reduce((s, v) => s + parseInt(v.Quantita || 0), 0)

  async function handleRestituisci(voce) {
    setSaving(voce.ID_Voce)
    try {
      await restituisciTrolleyVoce(voce.ID_Voce)
      onAggiornato(await getTrolley(idTrolley))
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  async function handleRestituisciTutto() {
    if (!confirm(`Svuotare tutto il ${nomeTrolley}?`)) return
    setSavingTutto(true)
    try {
      await restituisciTrolleyTutto(idTrolley)
      onAggiornato([])
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingTutto(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
        🧳 {nomeTrolley}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        {voci.length > 0 ? `${voci.length} set · ${totale} ruote totali` : 'Trolley vuoto'}
      </div>

      {voci.map(v => {
        const set = ruoteMagazzino.find(s => s.ID_Set === v.ID_Set)
        return (
          <div key={v.ID_Voce} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{v.Nome_Set || set?.Nome || `${v.Diametro}mm`}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {v.Diametro}mm · {v.Durezza} · {v.Quantita} ruote
              </div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent)' }}
              disabled={saving === v.ID_Voce}
              onClick={() => handleRestituisci(v)}
            >
              {saving === v.ID_Voce ? '...' : '↩ Restituisci'}
            </button>
          </div>
        )
      })}

      {voci.length > 0 && (
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: '12px', color: 'var(--accent)', borderColor: 'rgba(232,51,74,0.3)' }}
          onClick={handleRestituisciTutto}
          disabled={savingTutto}
        >
          {savingTutto ? 'Restituzione...' : '↩ Restituisci tutto'}
        </button>
      )}

      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}
        onClick={onAnnulla}
      >
        ← Indietro
      </button>
    </div>
  )
}
