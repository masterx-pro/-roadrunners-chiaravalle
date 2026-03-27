import { GOOGLE_CONFIG, SHEETS } from '../config/google'

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3'

function getToken() {
  return sessionStorage.getItem('gapi_token')
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
  return righe.map(riga =>
    Object.fromEntries(intestazioni.map((col, i) => [col, riga[i] ?? '']))
  )
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

export async function getAtleta(id) {
  const atleti = await getAtleti()
  return atleti.find(a => a.ID_Atleta === id)
}

export async function creaAtleta(atleta) {
  const id = `ATL-${String(Date.now()).slice(-6)}`
  const valori = [
    id, atleta.nome, atleta.cognome, atleta.dataNascita,
    atleta.codiceFiscale, atleta.idCategoria,
    atleta.genitoreNome, atleta.genitoreTelefono, atleta.genitoreEmail,
    atleta.scadCertificato, atleta.scadFISR, atleta.numeroFISR,
    '', // Drive_Folder_ID — creato separatamente
    'TRUE', atleta.dataIscrizione || new Date().toISOString().split('T')[0], ''
  ]
  await aggiungiRiga(SHEETS.ATLETI, valori)
  return id
}

// ============================================================
// PATTINI
// ============================================================

export async function getPattini() {
  return leggiSheet(SHEETS.PATTINI)
}

export async function assegnaPattino(idPattino, idAtleta, dataInizio) {
  const pattini = await getPattini()
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const p = pattini[idx]
  await aggiornaRiga(SHEETS.PATTINI, idx, [
    p.ID_Pattino, p.Numero_Identificativo, p.Taglia, p.Stato,
    idAtleta, dataInizio, 'Da pagare', p.Note
  ])
}

export async function restituisciPattino(idPattino) {
  const pattini = await getPattini()
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const p = pattini[idx]
  await aggiornaRiga(SHEETS.PATTINI, idx, [
    p.ID_Pattino, p.Numero_Identificativo, p.Taglia, p.Stato,
    '', '', '', p.Note
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

export async function verificaUtente(email) {
  const utenti = await getUtentiAutorizzati()
  return utenti.find(u => u.Email?.toLowerCase() === email?.toLowerCase() && u.Attivo === 'TRUE')
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
    ev.ID_Evento, ev.Titolo, ev.Data, ev.Ora_Inizio, ev.Tipo, ev.Luogo,
    ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    iscritti.join(','), ev.Stato_Pagamento_Gara, ev.Note
  ])
}

export async function aggiornaStatoPagamentoGara(idEvento, stato) {
  const eventi = await leggiSheet(SHEETS.EVENTI_SPECIALI)
  const idx = eventi.findIndex(e => e.ID_Evento === idEvento)
  if (idx === -1) throw new Error('Evento non trovato')
  const ev = eventi[idx]
  await aggiornaRiga(SHEETS.EVENTI_SPECIALI, idx, [
    ev.ID_Evento, ev.Titolo, ev.Data, ev.Ora_Inizio, ev.Tipo, ev.Luogo,
    ev.ID_Categoria, ev.Scad_Iscrizione, ev.Scad_Pagamento,
    ev.Data_Convocati, ev.Documenti_Richiesti,
    ev.Iscritti, stato, ev.Note
  ])
}
