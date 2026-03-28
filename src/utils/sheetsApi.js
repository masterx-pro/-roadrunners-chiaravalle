import { GOOGLE_CONFIG, SHEETS } from '../config/google'

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3'

function getToken() {
  return localStorage.getItem('gapi_token')
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  }
}

// ============================================================
// SHEETS — lettura e scrittura
// ============================================================

export async function leggiSheet(nomeSheet) {
  const url = `${BASE_URL}/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${nomeSheet}`
  const res = await fetch(url, { headers: authHeaders() })
  const data = await res.json()
  const [intestazioni, ...righe] = data.values || []
  // Pulisci nomi colonne da BOM e spazi invisibili
  const headers = intestazioni.map(h => h.replace(/^\uFEFF/, '').trim())
  return righe.map(riga =>
    Object.fromEntries(headers.map((col, i) => [col, (riga[i] ?? '').toString().trim()]))
  )
}

// ============================================================
// LOG
// ============================================================

export async function scriviLog(azione, entita, dettaglio) {
  const timestamp = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
  const utente = localStorage.getItem('user_nome') || localStorage.getItem('user_email') || 'sconosciuto'
  try {
    await aggiungiRiga(SHEETS.LOG, [timestamp, utente, azione, entita, dettaglio])
  } catch (err) {
    console.error('Errore log:', err)
  }
}

export async function aggiungiRiga(nomeSheet, valori) {
  const url = `${BASE_URL}/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${nomeSheet}!A1:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ values: [valori] })
  })
  return res.json()
}

export async function aggiornaRiga(nomeSheet, indiceRiga, valori) {
  // indiceRiga è 1-based, +2 per intestazione
  const riga = indiceRiga + 2
  const url = `${BASE_URL}/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${nomeSheet}!A${riga}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ values: [valori] })
  })
  return res.json()
}

// ============================================================
// ATLETI
// ============================================================

export async function getAtleti() {
  return leggiSheet(SHEETS.ATLETI)
}

export async function getCategorie() {
  return leggiSheet(SHEETS.CATEGORIE)
}

export async function aggiornaCategoria(idx, cat) {
  return aggiornaRiga(SHEETS.CATEGORIE, idx, [
    cat.ID_Categoria, cat.Nome, cat.Fascia_Eta, cat.Attiva === true || cat.Attiva === 'TRUE' ? 'TRUE' : 'FALSE',
    cat.Età_Min || cat.Eta_Min || '', cat.Età_Max || cat.Eta_Max || '', cat.Sesso || '',
    cat.Tipi_Gara || '', cat.Metodo_Calcolo || ''
  ])
}

export async function getAtleta(id) {
  const atleti = await getAtleti()
  return atleti.find(a => a.ID_Atleta === id)
}

// NOTA: l'ordine colonne del foglio Atleti è:
// ID_Atleta, Nome, Cognome, Sesso, Luogo_Nascita, Data_Nascita, Codice_Fiscale,
// ID_Categoria, Genitore_Nome, Nome_Categoria, Genitore_Telefono, Genitore_Email,
// Scad_Certificato, Scad_FISR, Numero_FISR, Drive_Folder_ID, Attivo, Data_Iscrizione, Note, Numero_Gara, Quota_Personalizzata

export function buildAtletaRow(a, overrides = {}) {
  return [
    a.ID_Atleta, a.Nome, a.Cognome, a.Sesso || '', a.Luogo_Nascita || '',
    a.Data_Nascita || '', a.Codice_Fiscale || '', a.ID_Categoria || '',
    a.Genitore_Nome || '', a.Nome_Categoria || '',
    a.Genitore_Telefono || '', a.Genitore_Email || '',
    a.Scad_Certificato || '', a.Scad_FISR || '', a.Numero_FISR || '',
    a.Drive_Folder_ID || '', a.Attivo || 'TRUE', a.Data_Iscrizione || '',
    a.Note || '', a.Numero_Gara || '', a.Quota_Personalizzata || ''
  ].map((v, i) => {
    const keys = ['ID_Atleta','Nome','Cognome','Sesso','Luogo_Nascita','Data_Nascita','Codice_Fiscale','ID_Categoria','Genitore_Nome','Nome_Categoria','Genitore_Telefono','Genitore_Email','Scad_Certificato','Scad_FISR','Numero_FISR','Drive_Folder_ID','Attivo','Data_Iscrizione','Note','Numero_Gara','Quota_Personalizzata']
    return overrides[keys[i]] !== undefined ? overrides[keys[i]] : v
  })
}

export async function creaAtleta(atleta) {
  const id = `ATL-${String(Date.now()).slice(-6)}`
  const valori = [
    id, atleta.nome, atleta.cognome, atleta.sesso || '', atleta.luogoNascita || '',
    atleta.dataNascita, atleta.codiceFiscale || '', atleta.idCategoria || '',
    atleta.genitoreNome || '', '', // Nome_Categoria — calcolato da formula CERCA.VERT
    atleta.genitoreTelefono || '', atleta.genitoreEmail || '',
    atleta.scadCertificato || '', atleta.scadFISR || '', atleta.numeroFISR || '',
    '', // Drive_Folder_ID
    'TRUE', atleta.dataIscrizione || new Date().toISOString().split('T')[0],
    atleta.note || '', atleta.numeroGara || '',
    atleta.quotaPersonalizzata || ''
  ]
  await aggiungiRiga(SHEETS.ATLETI, valori)
  await scriviLog('Nuovo', 'Atleta', `${atleta.nome} ${atleta.cognome}`)
  return id
}

export async function aggiornaCategorieBatch(atleti, categorie) {
  const oggi = new Date()
  let aggiornati = 0

  const categorieAttive = categorie.filter(c =>
    ['TRUE', 'true', 'True'].includes(c.Attiva?.trim())
  )

  for (let i = 0; i < atleti.length; i++) {
    const atleta = atleti[i]
    if (!atleta.Data_Nascita || !atleta.Sesso) continue
    if (!['TRUE', 'true', 'True'].includes(atleta.Attivo?.trim())) continue

    const nascita = new Date(atleta.Data_Nascita)
    let eta = oggi.getFullYear() - nascita.getFullYear()
    if (oggi.getMonth() < nascita.getMonth() || (oggi.getMonth() === nascita.getMonth() && oggi.getDate() < nascita.getDate())) {
      eta--
    }

    const sesso = atleta.Sesso?.trim().toUpperCase()
    const categoriaCorretta = categorieAttive.find(c => {
      const catSesso = c.Sesso?.trim().toUpperCase()
      const etaMin = parseInt(c.Età_Min || c.Eta_Min || '0')
      const etaMax = parseInt(c.Età_Max || c.Eta_Max || '99')
      return catSesso === sesso && eta >= etaMin && eta <= etaMax
    })

    if (!categoriaCorretta) continue

    const idCategoriaCorretta = categoriaCorretta.ID_Categoria
    if (!idCategoriaCorretta) continue
    if (atleta.ID_Categoria?.trim() === idCategoriaCorretta) continue

    const nomeCategoria = categoriaCorretta.Nome || ''
    await aggiornaRiga(SHEETS.ATLETI, i, buildAtletaRow(atleta, {
      ID_Categoria: idCategoriaCorretta,
      Nome_Categoria: nomeCategoria
    }))
    atleta.ID_Categoria = idCategoriaCorretta
    atleta.Nome_Categoria = nomeCategoria
    aggiornati++
  }

  if (aggiornati > 0) {
    await scriviLog('Auto', 'Categorie', `${aggiornati} atleti aggiornati per età`)
  }
  return aggiornati
}

export async function aggiornaNumeroGara(atleti, idAtleta, nuovoNumero) {
  const idx = atleti.findIndex(a => a.ID_Atleta === idAtleta)
  if (idx === -1) throw new Error('Atleta non trovato')
  const a = atleti[idx]
  return aggiornaRiga(SHEETS.ATLETI, idx, buildAtletaRow(a, { Numero_Gara: nuovoNumero }))
}

// ============================================================
// PATTINI
// ============================================================

export async function getPattini() {
  return leggiSheet(SHEETS.PATTINI)
}

export async function resetPagamentiNoleggio(pattini) {
  const promises = pattini
    .map((p, idx) => {
      if (!p.ID_Atleta) return null
      return aggiornaRiga(SHEETS.PATTINI, idx, [
        p.ID_Pattino, p.Marca, p.Taglia, p.Stato,
        p.ID_Atleta, p.Data_Inizio_Noleggio, 'Da pagare', p.Note
      ])
    })
    .filter(Boolean)
  await Promise.all(promises)
  await scriviLog('Reset', 'Pagamenti noleggio', 'Reset trimestrale')
}

export async function creaPattino(pattino) {
  const id = `P-${String(Date.now()).slice(-4)}`
  await aggiungiRiga(SHEETS.PATTINI, [id, pattino.marca || '', pattino.taglia, pattino.stato || 'Buono', '', '', '', pattino.note || ''])
  await scriviLog('Nuovo', 'Pattino', `${pattino.marca || ''} taglia ${pattino.taglia}`)
  return id
}

export async function aggiornaPattino(idx, pattino) {
  return aggiornaRiga(SHEETS.PATTINI, idx, [
    pattino.ID_Pattino, pattino.Marca || '', pattino.Taglia, pattino.Stato,
    pattino.ID_Atleta || '', pattino.Data_Inizio_Noleggio || '',
    pattino.Stato_Pagamento || '', pattino.Note || ''
  ])
}

export async function assegnaPattino(idPattino, idAtleta, dataInizio) {
  const pattini = await getPattini()
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const p = pattini[idx]
  await aggiornaRiga(SHEETS.PATTINI, idx, [
    p.ID_Pattino, p.Marca, p.Taglia, p.Stato,
    idAtleta, dataInizio, 'Da pagare', p.Note
  ])
  await scriviLog('Assegnazione', 'Pattino', `${idPattino} a ${idAtleta}`)
}

export async function restituisciPattino(idPattino) {
  const pattini = await getPattini()
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const p = pattini[idx]

  // Salva storico se era assegnato
  if (p.ID_Atleta) {
    const atleti = await getAtleti()
    const atleta = atleti.find(a => a.ID_Atleta === p.ID_Atleta)
    const nomeAtleta = atleta ? `${atleta.Nome} ${atleta.Cognome}` : p.ID_Atleta
    await aggiungiRiga(SHEETS.STORICO_PATTINI, [
      p.ID_Pattino, p.Marca || '', p.Taglia, p.ID_Atleta, nomeAtleta,
      p.Data_Inizio_Noleggio, new Date().toISOString().split('T')[0]
    ])
    await scriviLog('Restituzione', 'Pattino', `${p.ID_Pattino} restituito da ${nomeAtleta}`)
  }

  // Libera il pattino
  return aggiornaRiga(SHEETS.PATTINI, idx, [
    p.ID_Pattino, p.Marca || '', p.Taglia, p.Stato, '', '', '', p.Note || ''
  ])
}

// ============================================================
// RUOTE
// ============================================================

export async function getRuote() {
  return leggiSheet(SHEETS.RUOTE)
}

export async function creaSetRuote(ruote) {
  const id = `R-${String(Date.now()).slice(-4)}`
  await aggiungiRiga(SHEETS.RUOTE, [id, ruote.diametro, ruote.durezza, ruote.quantita, ruote.stato || 'Buone', ruote.note || ''])
  return id
}

export async function aggiornaSetRuote(idx, ruote) {
  return aggiornaRiga(SHEETS.RUOTE, idx, [
    ruote.ID_Set, ruote.Diametro_mm, ruote.Durezza_A,
    ruote.Quantita, ruote.Stato, ruote.Note || ''
  ])
}

export async function eliminaSetRuote(idx, ruote) {
  return aggiornaRiga(SHEETS.RUOTE, idx, [
    ruote.ID_Set, ruote.Diametro_mm, ruote.Durezza_A, '0', 'Eliminato', ruote.Note || ''
  ])
}

// ============================================================
// EVENTI
// ============================================================

export async function getEventiSpeciali() {
  return leggiSheet(SHEETS.EVENTI_SPECIALI)
}

export async function getSlotFissi() {
  return leggiSheet(SHEETS.SLOT_FISSI)
}

// ============================================================
// PRESENZE
// ============================================================

export async function getPresenze(idRiferimento) {
  const presenze = await leggiSheet(SHEETS.PRESENZE)
  return presenze.filter(p => p.ID_Riferimento === idRiferimento)
}

export async function registraPresenza(presenza) {
  const id = `PR-${String(Date.now()).slice(-6)}`
  await aggiungiRiga(SHEETS.PRESENZE, [
    id, presenza.tipoSessione, presenza.idRiferimento,
    presenza.data, presenza.idAtleta, presenza.presente ? 'TRUE' : 'FALSE'
  ])
}

export async function salvaPresenzaSingola(presenza) {
  const presenze = await leggiSheet(SHEETS.PRESENZE)
  const existing = presenze.findIndex(p =>
    p.ID_Riferimento === presenza.idRiferimento &&
    p.ID_Atleta === presenza.idAtleta &&
    p.Data === presenza.data
  )
  if (existing >= 0) {
    return aggiornaRiga(SHEETS.PRESENZE, existing, [
      presenze[existing].ID_Presenza,
      presenza.tipoSessione,
      presenza.idRiferimento,
      presenza.data,
      presenza.idAtleta,
      presenza.presente ? 'TRUE' : 'FALSE'
    ])
  } else {
    const id = `PR-${String(Date.now()).slice(-6)}`
    return aggiungiRiga(SHEETS.PRESENZE, [
      id, presenza.tipoSessione, presenza.idRiferimento,
      presenza.data, presenza.idAtleta, presenza.presente ? 'TRUE' : 'FALSE'
    ])
  }
}

export async function getStoricoPattinoById(idPattino) {
  const storico = await leggiSheet(SHEETS.STORICO_PATTINI)
  return storico.filter(s => s.ID_Pattino === idPattino)
}

// ============================================================
// GOOGLE DRIVE — cartelle e file
// ============================================================

export async function creaCartellaAtleta(nomeAtleta, idAtleta) {
  const res = await fetch(`${DRIVE_URL}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: `${nomeAtleta}_${idAtleta}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID]
    })
  })
  const data = await res.json()
  return data.id
}

export async function caricaDocumento(file, nomefile, idCartella) {
  // Step 1: crea il file metadata
  const metadata = {
    name: nomefile,
    parents: [idCartella]
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body: form
  })
  return res.json()
}

export async function eliminaDocumento(fileId) {
  const res = await fetch(`${DRIVE_URL}/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
  return res.ok
}

export async function listaDocumentiAtleta(idCartella) {
  const res = await fetch(
    `${DRIVE_URL}/files?q='${idCartella}'+in+parents&fields=files(id,name,mimeType,webViewLink)`,
    { headers: authHeaders() }
  )
  const data = await res.json()
  return data.files || []
}

export async function getModulistica() {
  return leggiSheet(SHEETS.MODULISTICA)
}

// ============================================================
// UTENTI — controllo accesso da Sheets
// ============================================================

export async function getUtentiAutorizzati() {
  return leggiSheet(SHEETS.UTENTI)
}

export async function aggiornaUtente(indice, valori) {
  return aggiornaRiga(SHEETS.UTENTI, indice, valori)
}

export async function verificaUtente(email) {
  try {
    console.log('Leggo foglio Utenti...')
    const utenti = await leggiSheet(SHEETS.UTENTI)
    console.log('Utenti trovati:', utenti)
    console.log('Cerco email:', email)
    const trovato = utenti.find(u => u.Email?.toLowerCase() === email?.toLowerCase() && u.Attivo === 'TRUE')
    console.log('Risultato:', trovato)
    return trovato
  } catch (err) {
    console.error('Errore leggiSheet Utenti:', err)
    throw err
  }
}

// ============================================================
// GARE — scadenze e iscritti
// ============================================================

export async function getGare() {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  return eventi.filter(e => e.Tipo === 'Gara')
}

export async function aggiornaIscrittGara(idEvento, idAtleta, iscritto) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === idEvento)
  if (idx === -1) throw new Error('Evento non trovato')
  const ev = eventi[idx]
  let iscritti = ev.Iscritti ? ev.Iscritti.split(',').filter(Boolean) : []
  if (iscritto) {
    if (!iscritti.includes(idAtleta)) iscritti.push(idAtleta)
  } else {
    iscritti = iscritti.filter(id => id !== idAtleta)
  }
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    ev.ID_Evento, ev.Titolo, ev.Data_Inizio, ev.Ora_Inizio, ev.Data_Fine, ev.Ora_Fine,
    ev.Tipo, ev.Luogo, ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    iscritti.join(','), ev.Stato_Pagamento_Gara, ev.Note,
    ev.Partecipazione || 'FALSE', ev.Iscrizione_Comunicata || 'FALSE',
    ev.Drive_Folder_Gara || ''
  ])
  await scriviLog('Iscrizione gara', 'Gara', `atleta ${idAtleta} evento ${idEvento}`)
}

export async function creaEvento(evento) {
  const id = `EV-${String(Date.now()).slice(-6)}`
  await aggiungiRiga(SHEETS.EVENTI_SPECIALI, [
    id, evento.titolo, evento.dataInizio, evento.oraInizio,
    evento.dataFine, evento.oraFine, evento.tipo, evento.luogo,
    evento.idCategoria || '', evento.scadIscrizione || '',
    evento.scadPagamento || '', evento.dataConvocati || '',
    evento.documentiRichiesti || '', '', 'Da pagare', evento.note || '',
    'FALSE', 'FALSE', ''
  ])
  await scriviLog('Nuovo', 'Evento', `${evento.titolo} — ${evento.dataInizio}`)
  return id
}

export async function aggiornaEvento(evento) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === evento.ID_Evento)
  if (idx === -1) throw new Error('Evento non trovato')
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    evento.ID_Evento, evento.Titolo, evento.Data_Inizio, evento.Ora_Inizio,
    evento.Data_Fine, evento.Ora_Fine, evento.Tipo, evento.Luogo,
    evento.ID_Categoria || '', evento.Scad_Iscrizione || '',
    evento.Scad_Pagamento || '', evento.Data_Convocati || '',
    evento.Documenti_Richiesti || '', evento.Iscritti || '',
    evento.Stato_Pagamento_Gara || 'Da pagare', evento.Note || '',
    evento.Partecipazione || 'FALSE', evento.Iscrizione_Comunicata || 'FALSE',
    evento.Drive_Folder_Gara || ''
  ])
  await scriviLog('Modifica', 'Evento', `${evento.Titolo} — ${evento.ID_Evento}`)
}

export async function aggiornaStatoPagamentoGara(idEvento, stato) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === idEvento)
  if (idx === -1) throw new Error('Evento non trovato')
  const ev = eventi[idx]
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    ev.ID_Evento, ev.Titolo, ev.Data_Inizio, ev.Ora_Inizio, ev.Data_Fine, ev.Ora_Fine,
    ev.Tipo, ev.Luogo, ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    ev.Iscritti, stato, ev.Note,
    ev.Partecipazione || 'FALSE', ev.Iscrizione_Comunicata || 'FALSE',
    ev.Drive_Folder_Gara || ''
  ])
}

// ============================================================
// TOGGLE PARTECIPAZIONE / ISCRIZIONE COMUNICATA
// ============================================================

export async function togglePartecipazione(idEvento) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === idEvento)
  if (idx === -1) throw new Error('Evento non trovato')
  const ev = eventi[idx]
  const nuovoStato = ev.Partecipazione === 'TRUE' ? 'FALSE' : 'TRUE'
  ev.Partecipazione = nuovoStato
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    ev.ID_Evento, ev.Titolo, ev.Data_Inizio, ev.Ora_Inizio, ev.Data_Fine, ev.Ora_Fine,
    ev.Tipo, ev.Luogo, ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    ev.Iscritti, ev.Stato_Pagamento_Gara || 'Da pagare', ev.Note,
    nuovoStato, ev.Iscrizione_Comunicata || 'FALSE',
    ev.Drive_Folder_Gara || ''
  ])
  await scriviLog(nuovoStato === 'TRUE' ? 'Partecipazione' : 'Ritiro', 'Evento', ev.Titolo)
  return nuovoStato
}

export async function toggleIscrizioneComunicata(idEvento) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === idEvento)
  if (idx === -1) throw new Error('Evento non trovato')
  const ev = eventi[idx]
  const nuovoStato = ev.Iscrizione_Comunicata === 'TRUE' ? 'FALSE' : 'TRUE'
  ev.Iscrizione_Comunicata = nuovoStato
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    ev.ID_Evento, ev.Titolo, ev.Data_Inizio, ev.Ora_Inizio, ev.Data_Fine, ev.Ora_Fine,
    ev.Tipo, ev.Luogo, ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    ev.Iscritti, ev.Stato_Pagamento_Gara || 'Da pagare', ev.Note,
    ev.Partecipazione || 'FALSE', nuovoStato,
    ev.Drive_Folder_Gara || ''
  ])
  await scriviLog(nuovoStato === 'TRUE' ? 'Iscrizione comunicata' : 'Iscrizione annullata', 'Evento', ev.Titolo)
  return nuovoStato
}

// ============================================================
// DRIVE — cartelle e documenti gara
// ============================================================

export async function creaCartellaGara(evento) {
  const token = getToken()

  // Cerca o crea cartella "Gare" nella root
  let gareFolderId
  const searchRes = await fetch(
    `${DRIVE_URL}/files?q=name='Gare' and '${GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()
  if (searchData.files && searchData.files.length > 0) {
    gareFolderId = searchData.files[0].id
  } else {
    const createRes = await fetch(`${DRIVE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gare', mimeType: 'application/vnd.google-apps.folder', parents: [GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID] })
    })
    const createData = await createRes.json()
    gareFolderId = createData.id
  }

  // Crea sottocartella per questa gara
  const nomeCartella = `${evento.Titolo}_${evento.Data_Inizio || ''}`.replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ _-]/g, '_')
  const garaRes = await fetch(`${DRIVE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nomeCartella, mimeType: 'application/vnd.google-apps.folder', parents: [gareFolderId] })
  })
  const garaData = await garaRes.json()
  return garaData.id
}

export async function caricaDocumentoGara(driveFolderId, file, nomeFile) {
  const token = getToken()
  const metadata = { name: nomeFile || file.name, parents: [driveFolderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)
  const res = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  return res.json()
}

// ============================================================
// PAGAMENTI
// ============================================================

export async function getPagamentiAtleta(idAtleta) {
  const pagamenti = await leggiSheet(SHEETS.PAGAMENTI)
  return pagamenti.filter(p => p.ID_Atleta === idAtleta)
}

export async function creaPagamento(pagamento) {
  const id = `PAG-${String(Date.now()).slice(-6)}`
  await aggiungiRiga(SHEETS.PAGAMENTI, [
    id, pagamento.idAtleta, pagamento.tipo, pagamento.descrizione,
    pagamento.importo, pagamento.stato || 'Da pagare',
    pagamento.dataScadenza || '', pagamento.dataPagamento || '',
    pagamento.note || ''
  ])
  await scriviLog('Nuovo', 'Pagamento', `${pagamento.tipo} — ${pagamento.descrizione}`)
  return id
}

export async function aggiornaPagamento(idPagamento, updates) {
  const pagamenti = await leggiSheet(SHEETS.PAGAMENTI)
  const idx = pagamenti.findIndex(p => p.ID_Pagamento === idPagamento)
  if (idx === -1) throw new Error('Pagamento non trovato')
  const p = pagamenti[idx]
  await aggiornaRiga(SHEETS.PAGAMENTI, idx, [
    p.ID_Pagamento, p.ID_Atleta,
    updates.Tipo || p.Tipo, updates.Descrizione || p.Descrizione,
    updates.Importo || p.Importo, updates.Stato || p.Stato,
    updates.Data_Scadenza || p.Data_Scadenza, updates.Data_Pagamento || p.Data_Pagamento,
    updates.Note || p.Note
  ])
  await scriviLog('Modifica', 'Pagamento', `${p.ID_Pagamento} — ${updates.Stato || p.Stato}`)
}

export async function generaQuoteAtleta(idAtleta, nomeAtleta, importo, tipoRate) {
  const { PAGAMENTI_CONFIG } = await import('../config/google.js')
  const anno = new Date().getFullYear()
  const stagione = `${anno}/${anno + 1}`

  if (tipoRate === '1') {
    await creaPagamento({
      idAtleta,
      tipo: 'Quota',
      descrizione: `Quota associativa ${stagione}`,
      importo: importo,
      stato: 'Da pagare',
      dataScadenza: `${anno}-${PAGAMENTI_CONFIG.SCADENZA_RATA_1}-15`,
    })
  } else {
    const metaImporto = Math.ceil(importo / 2)
    await creaPagamento({
      idAtleta,
      tipo: 'Quota',
      descrizione: `Quota ${stagione} — Rata 1/2`,
      importo: metaImporto,
      stato: 'Da pagare',
      dataScadenza: `${anno}-${PAGAMENTI_CONFIG.SCADENZA_RATA_1}-15`,
    })
    await creaPagamento({
      idAtleta,
      tipo: 'Quota',
      descrizione: `Quota ${stagione} — Rata 2/2`,
      importo: importo - metaImporto,
      stato: 'Da pagare',
      dataScadenza: `${anno + 1}-${PAGAMENTI_CONFIG.SCADENZA_RATA_2}-15`,
    })
  }
  await scriviLog('Quote generate', 'Atleta', nomeAtleta)
}
