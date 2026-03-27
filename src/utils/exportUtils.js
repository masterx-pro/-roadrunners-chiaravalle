import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function scaricaExcel(dati, colonne, nomeFile) {
  const ws = XLSX.utils.json_to_sheet(dati, { header: colonne })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dati')
  XLSX.writeFile(wb, nomeFile)
}

function creaPDF(titolo) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(titolo, 14, 20)
  doc.setFontSize(10)
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 14, 28)
  return doc
}

export function esportaAtletiExcel(atleti) {
  const attivi = atleti.filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
  const dati = attivi.map(a => ({
    'Nome': a.Nome,
    'Cognome': a.Cognome,
    'Data Nascita': a.Data_Nascita,
    'Categoria': a.Nome_Categoria || a.ID_Categoria || '',
    'Genitore': a.Genitore_Nome || '',
    'Telefono': a.Genitore_Telefono || '',
    'Email': a.Genitore_Email || '',
    'Scad Certificato': a.Scad_Certificato || '',
    'Tessera FISR': a.Numero_FISR || '',
    'Scad FISR': a.Scad_FISR || ''
  }))
  scaricaExcel(dati, Object.keys(dati[0] || {}), 'atleti_roadrunners.xlsx')
}

export function esportaAtletiPDF(atleti) {
  const attivi = atleti.filter(a => ['TRUE', 'true', 'True'].includes(a.Attivo?.trim()))
  const doc = creaPDF('A.S.D. Road Runners — Lista Atleti')
  autoTable(doc, {
    startY: 35,
    head: [['Nome', 'Cognome', 'Categoria', 'Scad. Cert.', 'FISR', 'Scad. FISR']],
    body: attivi.map(a => [
      a.Nome, a.Cognome,
      a.Nome_Categoria || a.ID_Categoria || '',
      a.Scad_Certificato || '—',
      a.Numero_FISR || '—',
      a.Scad_FISR || '—'
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [232, 51, 74] }
  })
  doc.save('atleti_roadrunners.pdf')
}

export function esportaIscrittGaraPDF(gara, atletiIscritti) {
  const doc = creaPDF(`A.S.D. Road Runners — ${gara.Titolo}`)
  doc.setFontSize(11)
  let y = 32
  if (gara.Data_Inizio) { doc.text(`Data: ${gara.Data_Inizio}${gara.Data_Fine ? ' – ' + gara.Data_Fine : ''}`, 14, y); y += 6 }
  if (gara.Luogo) { doc.text(`Luogo: ${gara.Luogo}`, 14, y); y += 6 }
  autoTable(doc, {
    startY: y + 4,
    head: [['Nome', 'Cognome', 'N° Gara', 'Categoria', 'Tessera FISR']],
    body: atletiIscritti.map(a => [
      a.Nome, a.Cognome,
      a.Numero_Gara || '—',
      a.Nome_Categoria || a.ID_Categoria || '',
      a.Numero_FISR || '—'
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [232, 51, 74] }
  })
  const nomeFile = `iscritti_${(gara.Titolo || 'gara').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
  doc.save(nomeFile)
}

export function esportaIscrittGaraExcel(gara, atletiIscritti) {
  const dati = atletiIscritti.map(a => ({
    'Nome': a.Nome,
    'Cognome': a.Cognome,
    'Categoria': a.Nome_Categoria || a.ID_Categoria || '',
    'Tessera FISR': a.Numero_FISR || ''
  }))
  const nomeFile = `iscritti_${(gara.Titolo || 'gara').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
  scaricaExcel(dati, Object.keys(dati[0] || {}), nomeFile)
}

export function esportaPattiniExcel(pattini, atleti) {
  const nomeAtleta = (id) => {
    if (!id) return ''
    const a = atleti.find(at => at.ID_Atleta === id)
    return a ? `${a.Nome} ${a.Cognome}` : id
  }
  const dati = pattini.map(p => ({
    'ID Pattino': p.ID_Pattino,
    'Marca': p.Marca || '',
    'Taglia': p.Taglia,
    'Stato': p.Stato,
    'Atleta Assegnato': nomeAtleta(p.ID_Atleta),
    'Dal': p.Data_Inizio_Noleggio || '',
    'Pagamento': p.Stato_Pagamento || ''
  }))
  scaricaExcel(dati, Object.keys(dati[0] || {}), 'pattini_roadrunners.xlsx')
}

export function esportaRuoteExcel(ruote) {
  const dati = ruote.filter(r => r.Stato !== 'Eliminato').map(r => ({
    'ID': r.ID_Set,
    'Diametro mm': r.Diametro_mm,
    'Durezza A': r.Durezza_A,
    'Quantità': r.Quantita,
    'Stato': r.Stato,
    'Note': r.Note || ''
  }))
  scaricaExcel(dati, Object.keys(dati[0] || {}), 'ruote_roadrunners.xlsx')
}
