import { TRIMESTRI, ALERT_GIORNI_ANTICIPO } from '../config/google'

export const ALERT_GIORNI_ANTICIPO_WARN = 90

// ============================================================
// SCADENZE
// ============================================================

export function giorniAllaScadenza(dataScadenza) {
  if (!dataScadenza) return null
  const scad = new Date(dataScadenza)
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const diff = Math.ceil((scad - oggi) / (1000 * 60 * 60 * 24))
  return diff
}

export function statoScadenza(dataScadenza) {
  const giorni = giorniAllaScadenza(dataScadenza)
  if (giorni === null) return 'mancante'
  if (giorni < 0) return 'scaduto'
  if (giorni <= ALERT_GIORNI_ANTICIPO) return 'urgente'
  if (giorni <= ALERT_GIORNI_ANTICIPO_WARN) return 'in_scadenza'
  return 'ok'
}

export function formattaData(dataStr) {
  if (!dataStr) return '—'
  const d = new Date(dataStr)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ============================================================
// TRIMESTRI NOLEGGIO
// ============================================================

export function trimestreCorrente() {
  const mese = new Date().getMonth() + 1 // 1-12
  return TRIMESTRI.find(t => t.mesi.includes(mese)) || null
}

export function scadenzaTrimestreCorrente() {
  const t = trimestreCorrente()
  if (!t) return null
  const ultimoMese = Math.max(...t.mesi)
  const anno = ultimoMese < new Date().getMonth() + 1
    ? new Date().getFullYear() + 1
    : new Date().getFullYear()
  // Ultimo giorno del mese finale del trimestre
  return new Date(anno, ultimoMese, 0) // giorno 0 = ultimo del mese precedente
}

// ============================================================
// CALCOLO PRIMO PAGAMENTO NUOVO ATLETA
// ============================================================

export function calcolaPrimoPagamento(dataIscrizione) {
  const d = new Date(dataIscrizione)
  const mese = d.getMonth() + 1
  const t = TRIMESTRI.find(tr => tr.mesi.includes(mese))
  if (!t) return null
  const ultimoMese = Math.max(...t.mesi)
  const anno = d.getFullYear()
  const fineTrimestr = new Date(anno, ultimoMese, 0)
  return {
    trimestre: t.label,
    scadenza: fineTrimestr,
    descrizione: `Paga da ${formattaData(dataIscrizione)} al ${formattaData(fineTrimestr)}`
  }
}

// ============================================================
// ALERT DASHBOARD
// ============================================================

export function calcolaAlert(atleti, pattini, eventi = []) {
  const alerts = []

  // Certificati medici in scadenza
  atleti
    .filter(a => a.Attivo === 'TRUE')
    .forEach(a => {
      const stato = statoScadenza(a.Scad_Certificato)
      if (stato === 'scaduto' || stato === 'urgente' || stato === 'in_scadenza' || stato === 'mancante') {
        alerts.push({
          tipo: 'certificato',
          atleta: `${a.Nome} ${a.Cognome}`,
          idAtleta: a.ID_Atleta,
          telefono: a.Genitore_Telefono || '',
          stato,
          data: a.Scad_Certificato,
          giorni: giorniAllaScadenza(a.Scad_Certificato)
        })
      }
    })

  // Tessere FISR in scadenza
  atleti
    .filter(a => a.Attivo === 'TRUE')
    .forEach(a => {
      const stato = statoScadenza(a.Scad_FISR)
      if (stato === 'scaduto' || stato === 'urgente' || stato === 'in_scadenza') {
        alerts.push({
          tipo: 'fisr',
          atleta: `${a.Nome} ${a.Cognome}`,
          idAtleta: a.ID_Atleta,
          telefono: a.Genitore_Telefono || '',
          stato,
          data: a.Scad_FISR,
          giorni: giorniAllaScadenza(a.Scad_FISR)
        })
      }
    })

  // Gare con scadenze imminenti
  const alertGare = eventi
    .filter(e => e.Tipo === "Gara")
    .flatMap(e => {
      const res = []
      if (e.Scad_Iscrizione) {
        const g = giorniAllaScadenza(e.Scad_Iscrizione)
        if (g !== null && g >= 0 && g <= 7) res.push({ tipo: "iscrizione_gara", gara: e.Titolo, giorni: g, data: e.Scad_Iscrizione })
      }
      if (e.Scad_Pagamento) {
        const g = giorniAllaScadenza(e.Scad_Pagamento)
        if (g !== null && g >= 0 && g <= 7) res.push({ tipo: "pagamento_gara", gara: e.Titolo, giorni: g, data: e.Scad_Pagamento })
      }
      return res
    })

  alerts.push(...alertGare)

  // Ordinati per urgenza
  return alerts.sort((a, b) => (a.giorni ?? -999) - (b.giorni ?? -999))
}
