import { GOOGLE_CONFIG, SHEETS, getConfigDrive } from '../config/google'

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
// CACHE LETTURE SHEET
// ============================================================
const sheetCache = {}
const CACHE_DURATA = 30 * 1000 // 30 secondi

// Funzione per invalidare la cache di un foglio (dopo scritture)
export function invalidaCache(nomeSheet) {
  if (nomeSheet) {
    delete sheetCache[nomeSheet]
  } else {
    Object.keys(sheetCache).forEach(k => delete sheetCache[k])
  }
}

function parseSheetData(data) {
  const [intestazioni, ...righe] = data.values || []
  if (!intestazioni) return []
  const headers = intestazioni.map(h => h.replace(/^\uFEFF/, '').trim())
  return righe.map(riga =>
    Object.fromEntries(headers.map((col, i) => [col, (riga[i] ?? '').toString().trim()]))
  )
}

// ============================================================
// SHEETS — lettura e scrittura
// ============================================================

export async function leggiSheet(nomeSheet) {
  const ora = Date.now()

  // Usa cache se fresca
  if (sheetCache[nomeSheet] && (ora - sheetCache[nomeSheet].time) < CACHE_DURATA) {
    return sheetCache[nomeSheet].data
  }

  const url = `${BASE_URL}/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${nomeSheet}`
  const res = await fetch(url, { headers: authHeaders() })

  // Gestione errore 429
  if (res.status === 429) {
    console.warn(`Rate limit per ${nomeSheet}, uso cache se disponibile`)
    if (sheetCache[nomeSheet]) {
      return sheetCache[nomeSheet].data
    }
    // Aspetta 2 secondi e riprova UNA volta
    await new Promise(r => setTimeout(r, 2000))
    const retry = await fetch(url, { headers: authHeaders() })
    if (!retry.ok) {
      throw new Error(`Errore lettura ${nomeSheet}: ${retry.status}`)
    }
    const retryData = await retry.json()
    const risultato = parseSheetData(retryData)
    sheetCache[nomeSheet] = { data: risultato, time: Date.now() }
    return risultato
  }

  if (!res.ok) {
    console.error(`Errore lettura ${nomeSheet}: ${res.status}`)
    if (sheetCache[nomeSheet]) return sheetCache[nomeSheet].data
    return []
  }

  const data = await res.json()
  const risultato = parseSheetData(data)

  // Salva in cache
  sheetCache[nomeSheet] = { data: risultato, time: Date.now() }
  return risultato
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
  invalidaCache(nomeSheet)
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
  invalidaCache(nomeSheet)
  return res.json()
}

// ============================================================
// ATLETI
// ============================================================

// ============================================================
// CONFIGURAZIONE
// ============================================================

let configCache = null
let configCacheTime = 0
const CONFIG_CACHE_DURATA = 5 * 60 * 1000 // 5 minuti

export async function getConfigurazione() {
  const ora = Date.now()
  if (configCache && (ora - configCacheTime) < CONFIG_CACHE_DURATA) {
    return configCache
  }

  try {
    const righe = await leggiSheet(SHEETS.CONFIGURAZIONE)
    const config = {}
    righe.forEach(r => {
      if (r.Parametro) {
        config[r.Parametro] = r.Valore
      }
    })
    configCache = config
    configCacheTime = ora
    return config
  } catch (e) {
    console.error('Errore lettura configurazione:', e)
    return configCache || {}
  }
}

export async function aggiornaParametro(parametro, valore) {
  const righe = await leggiSheet(SHEETS.CONFIGURAZIONE)
  const idx = righe.findIndex(r => r.Parametro === parametro)
  if (idx === -1) throw new Error(`Parametro "${parametro}" non trovato`)

  await aggiornaRiga(SHEETS.CONFIGURAZIONE, idx, [
    righe[idx].Parametro, String(valore), righe[idx].Descrizione || ''
  ])

  // Invalida la cache
  configCache = null
  configCacheTime = 0

  await scriviLog('Modifica', 'Configurazione', `${parametro} = ${valore}`)
}

export async function getParametro(parametro, defaultValue) {
  const config = await getConfigurazione()
  return config[parametro] !== undefined ? config[parametro] : defaultValue
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
// Scad_Certificato, Scad_FISR, Numero_FISR, Drive_Folder_ID, Attivo, Data_Iscrizione,
// Note, Numero_Gara, Quota_Personalizzata, Tipo_Atleta, Emissione_Certificato, Emissione_FISR

export function buildAtletaRow(a, overrides = {}) {
  const keys = ['ID_Atleta','Nome','Cognome','Sesso','Luogo_Nascita','Data_Nascita','Codice_Fiscale','ID_Categoria','Genitore_Nome','Nome_Categoria','Genitore_Telefono','Genitore_Email','Scad_Certificato','Scad_FISR','Numero_FISR','Drive_Folder_ID','Attivo','Data_Iscrizione','Note','Numero_Gara','Quota_Personalizzata','Tipo_Atleta','Emissione_Certificato','Emissione_FISR']

  const base = [
    a.ID_Atleta, a.Nome, a.Cognome, a.Sesso || '', a.Luogo_Nascita || '',
    a.Data_Nascita || '', a.Codice_Fiscale || '', a.ID_Categoria || '',
    a.Genitore_Nome || '', a.Nome_Categoria || '',
    a.Genitore_Telefono || '', a.Genitore_Email || '',
    a.Scad_Certificato || '', a.Scad_FISR || '', a.Numero_FISR || '',
    a.Drive_Folder_ID || '', a.Attivo || 'TRUE', a.Data_Iscrizione || '',
    a.Note || '', a.Numero_Gara || '', a.Quota_Personalizzata || '',
    a.Tipo_Atleta || 'Agonista', a.Emissione_Certificato || '', a.Emissione_FISR || ''
  ]

  return base.map((v, i) => {
    if (overrides[keys[i]] !== undefined) return overrides[keys[i]]
    return v
  })
}

export async function creaAtleta(atleta) {
  const id = `ATL-${String(Date.now()).slice(-6)}`
  const valori = [
    id, atleta.nome, atleta.cognome, atleta.sesso || '', atleta.luogoNascita || '',
    atleta.dataNascita, atleta.codiceFiscale || '', atleta.idCategoria || '',
    atleta.genitoreNome || '', atleta.nomeCategoria || '',
    atleta.genitoreTelefono || '', atleta.genitoreEmail || '',
    atleta.scadCertificato || '', atleta.scadFISR || '', atleta.numeroFISR || '',
    '', // Drive_Folder_ID
    'TRUE', atleta.dataIscrizione || new Date().toISOString().split('T')[0],
    atleta.note || '', atleta.numeroGara || '',
    atleta.quotaPersonalizzata || '', atleta.tipoAtleta || 'Agonista',
    atleta.emissioneCertificato || '', atleta.emissioneFISR || ''
  ]
  await aggiungiRiga(SHEETS.ATLETI, valori)
  await scriviLog('Nuovo', 'Atleta', `${atleta.nome} ${atleta.cognome}`)
  return id
}

export function calcolaAnnoInizioStagione() {
  const oggi = new Date()
  const mese = oggi.getMonth() + 1
  return mese >= 10 ? oggi.getFullYear() : oggi.getFullYear() - 1
}

export function trovaCategoriaPerNascita(annoNascita, sesso, tipoAtleta, categorie) {
  const annoStagione = calcolaAnnoInizioStagione()

  const categorieAttive = categorie.filter(c =>
    ['TRUE', 'true', 'True'].includes(c.Attiva?.trim())
  )

  return categorieAttive.find(c => {
    const catTipo = (c.Tipo || '').trim()
    const catSesso = (c.Sesso || '').trim().toUpperCase()
    const offsetDa = parseInt(c.Offset_Da) || 0
    const offsetA = parseInt(c.Offset_A) || 99

    if (catTipo !== tipoAtleta) return false
    if (catSesso !== sesso.toUpperCase()) return false

    const annoNascitaDa = annoStagione - offsetA
    const annoNascitaA = annoStagione - offsetDa

    return annoNascita >= annoNascitaDa && annoNascita <= annoNascitaA
  })
}

export async function aggiornaCategorieBatch(atleti, categorie) {
  let aggiornati = 0

  for (let i = 0; i < atleti.length; i++) {
    const atleta = atleti[i]
    if (!atleta.Data_Nascita || !atleta.Sesso) continue
    if (!['TRUE', 'true', 'True'].includes(atleta.Attivo?.trim())) continue

    const nascita = new Date(atleta.Data_Nascita)
    if (isNaN(nascita.getTime())) continue
    const annoNascita = nascita.getFullYear()
    const sesso = atleta.Sesso?.trim().toUpperCase()
    const tipoAtleta = atleta.Tipo_Atleta || 'Agonista'

    const categoriaCorretta = trovaCategoriaPerNascita(annoNascita, sesso, tipoAtleta, categorie)
    if (!categoriaCorretta) continue

    const idCategoriaCorretta = categoriaCorretta.ID_Categoria || ''
    const nomeCategoriaCorretto = categoriaCorretta.Nome || ''
    if (!idCategoriaCorretta) continue

    const idCategoriaAttuale = (atleta.ID_Categoria || '').trim()
    const nomeCategoriaAttuale = (atleta.Nome_Categoria || '').trim()

    if (idCategoriaAttuale !== idCategoriaCorretta || !nomeCategoriaAttuale) {
      try {
        await aggiornaAtletaBatch(atleti, atleta.ID_Atleta, {
          ID_Categoria: idCategoriaCorretta,
          Nome_Categoria: nomeCategoriaCorretto
        })
        atleta.ID_Categoria = idCategoriaCorretta
        atleta.Nome_Categoria = nomeCategoriaCorretto
        aggiornati++
      } catch (err) {
        console.error('Errore aggiornamento categoria per', atleta.Nome, atleta.Cognome, err)
      }
    }
  }

  if (aggiornati > 0) {
    const as = calcolaAnnoInizioStagione()
    await scriviLog('Auto', 'Categorie', `${aggiornati} atleti aggiornati per stagione ${as}/${as + 1}`)
  }
  return aggiornati
}

export async function aggiornaAtletaSicuro(idAtleta, overrides) {
  const atletiSheet = await leggiSheet(SHEETS.ATLETI)
  const idx = atletiSheet.findIndex(a => a.ID_Atleta === idAtleta)
  if (idx === -1) throw new Error('Atleta non trovato')
  const atletaFresco = atletiSheet[idx]
  await aggiornaRiga(SHEETS.ATLETI, idx, buildAtletaRow(atletaFresco, overrides))
  return atletaFresco
}

// Versione per batch — riceve gli atleti già letti, evita letture extra
export async function aggiornaAtletaBatch(atleti, idAtleta, overrides) {
  const idx = atleti.findIndex(a => a.ID_Atleta === idAtleta)
  if (idx === -1) throw new Error('Atleta non trovato')
  const valori = buildAtletaRow(atleti[idx], overrides)
  await aggiornaRiga(SHEETS.ATLETI, idx, valori)
}

export async function aggiornaNumeroGara(atleti, idAtleta, nuovoNumero) {
  return aggiornaAtletaSicuro(idAtleta, { Numero_Gara: nuovoNumero })
}

// ============================================================
// PATTINI
// ============================================================

export async function getPattini() {
  return leggiSheet(SHEETS.PATTINI)
}

export async function creaPattino(pattino) {
  const id = `P-${String(Date.now()).slice(-4)}`
  await aggiungiRiga(SHEETS.PATTINI, [id, pattino.marca || '', pattino.taglia, pattino.stato || 'Buono', '', '', pattino.note || ''])
  await scriviLog('Nuovo', 'Pattino', `${pattino.marca || ''} taglia ${pattino.taglia}`)
  return id
}

export async function aggiornaPattino(idx, pattino) {
  return aggiornaRiga(SHEETS.PATTINI, idx, [
    pattino.ID_Pattino, pattino.Marca || '', pattino.Taglia, pattino.Stato,
    pattino.ID_Atleta || '', pattino.Data_Inizio_Noleggio || '',
    pattino.Note || ''
  ])
}

export async function assegnaPattino(idPattino, idAtleta, dataInizio) {
  const pattini = await leggiSheet(SHEETS.PATTINI)
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const pattino = pattini[idx]
  const oggi = dataInizio || new Date().toISOString().split('T')[0]

  const atleti = await leggiSheet(SHEETS.ATLETI)
  const atleta = atleti.find(a => a.ID_Atleta === idAtleta)
  const nomeAtleta = atleta ? `${atleta.Nome} ${atleta.Cognome}` : idAtleta

  await aggiornaRiga(SHEETS.PATTINI, idx, [
    pattino.ID_Pattino, pattino.Marca, pattino.Taglia,
    'Buono', idAtleta, oggi, pattino.Note || ''
  ])

  // Crea riga storico aperta (senza Data_Fine)
  await aggiungiRiga(SHEETS.STORICO_PATTINI, [
    pattino.ID_Pattino, pattino.Marca, pattino.Taglia,
    idAtleta, nomeAtleta,
    oggi, ''
  ])

  await scriviLog('Assegnazione', 'Pattino', `${idPattino} a ${nomeAtleta}`)
}

export async function restituisciPattino(idPattino) {
  const pattini = await leggiSheet(SHEETS.PATTINI)
  const idx = pattini.findIndex(p => p.ID_Pattino === idPattino)
  if (idx === -1) throw new Error('Pattino non trovato')
  const pattino = pattini[idx]
  const oggi = new Date().toISOString().split('T')[0]

  if (pattino.ID_Atleta) {
    // Cerca nello storico la riga aperta per questo pattino + atleta
    const storico = await leggiSheet(SHEETS.STORICO_PATTINI)
    const rigaAperta = storico.findIndex(s =>
      s.ID_Pattino === idPattino &&
      s.ID_Atleta === pattino.ID_Atleta &&
      (!s.Data_Fine || s.Data_Fine.trim() === '')
    )

    if (rigaAperta !== -1) {
      // Chiudi la riga storico esistente
      const s = storico[rigaAperta]
      await aggiornaRiga(SHEETS.STORICO_PATTINI, rigaAperta, [
        s.ID_Pattino, s.Marca, s.Taglia, s.ID_Atleta, s.Nome_Atleta,
        s.Data_Inizio, oggi
      ])
    } else {
      // Fallback: crea riga con Data_Fine
      const atleti = await leggiSheet(SHEETS.ATLETI)
      const atleta = atleti.find(a => a.ID_Atleta === pattino.ID_Atleta)
      const nomeAtleta = atleta ? `${atleta.Nome} ${atleta.Cognome}` : pattino.ID_Atleta
      await aggiungiRiga(SHEETS.STORICO_PATTINI, [
        pattino.ID_Pattino, pattino.Marca, pattino.Taglia,
        pattino.ID_Atleta, nomeAtleta,
        pattino.Data_Inizio_Noleggio || oggi, oggi
      ])
    }

    const atleti = await leggiSheet(SHEETS.ATLETI)
    const atleta = atleti.find(a => a.ID_Atleta === pattino.ID_Atleta)
    const nomeAtleta = atleta ? `${atleta.Nome} ${atleta.Cognome}` : pattino.ID_Atleta
    await scriviLog('Restituzione', 'Pattino', `${pattino.ID_Pattino} restituito da ${nomeAtleta}`)
  }

  // Libera il pattino
  await aggiornaRiga(SHEETS.PATTINI, idx, [
    pattino.ID_Pattino, pattino.Marca || '', pattino.Taglia,
    'Buono', '', '', pattino.Note || ''
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

export async function creaCartellaAtleta(atleta) {
  if (!GOOGLE_CONFIG.DRIVE_ATLETI_FOLDER_ID) await getConfigDrive()
  const token = getToken()
  const nomeCartella = `${atleta.Nome}_${atleta.Cognome}_${atleta.ID_Atleta}`.replace(/\s+/g, '_')
  const parentId = GOOGLE_CONFIG.DRIVE_ATLETI_FOLDER_ID
  if (!parentId) throw new Error('Drive Atleti non configurato')

  // Cerca se la cartella esiste già (per nome esatto o per ID atleta nel nome)
  try {
    const searchRes = await fetch(
      `${DRIVE_URL}/files?q='${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const searchData = await searchRes.json()
    const cartellaTrovata = (searchData.files || []).find(f =>
      f.name === nomeCartella || f.name.includes(atleta.ID_Atleta)
    )
    if (cartellaTrovata) {
      return cartellaTrovata.id
    }
  } catch (e) {
    console.error('Errore ricerca cartella atleta:', e)
  }

  // Non esiste, creala
  const res = await fetch(`${DRIVE_URL}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: nomeCartella,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  })
  const data = await res.json()
  return data.id
}

export async function creaCartelleMancanti(atleti) {
  let creati = 0
  for (const atleta of atleti) {
    if (!['TRUE', 'true', 'True'].includes(atleta.Attivo?.trim())) continue
    if (atleta.Drive_Folder_ID) continue
    try {
      const folderId = await creaCartellaAtleta(atleta)
      await aggiornaAtletaBatch(atleti, atleta.ID_Atleta, { Drive_Folder_ID: folderId })
      atleta.Drive_Folder_ID = folderId
      creati++
    } catch (err) {
      console.error('Errore creazione cartella per', atleta.Nome, atleta.Cognome, err)
    }
  }
  if (creati > 0) {
    await scriviLog('Auto', 'Cartelle Drive', `${creati} cartelle create`)
  }
  return creati
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
  if (!GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID) await getConfigDrive()
  if (!GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID) throw new Error('Drive Root non configurato')
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
    id, pagamento.idAtleta, pagamento.nomeAtleta || '',
    pagamento.tipo, pagamento.descrizione,
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
    p.ID_Pagamento, p.ID_Atleta, p.Nome_Atleta || '',
    updates.Tipo || p.Tipo, updates.Descrizione || p.Descrizione,
    updates.Importo || p.Importo, updates.Stato || p.Stato,
    updates.Data_Scadenza || p.Data_Scadenza, updates.Data_Pagamento || p.Data_Pagamento,
    updates.Note || p.Note
  ])
  await scriviLog('Modifica', 'Pagamento', `${p.ID_Pagamento} — ${updates.Stato || p.Stato}`)
}

export async function generaQuoteAtleta(idAtleta, nomeAtleta, importo, tipoRate) {
  const config = await getConfigurazione()
  const scadRata1 = config.Scadenza_Rata_1 || '10'
  const scadRata2 = config.Scadenza_Rata_2 || '01'
  const anno = new Date().getFullYear()
  const stagione = `${anno}/${anno + 1}`

  if (tipoRate === '1') {
    await creaPagamento({
      idAtleta,
      nomeAtleta,
      tipo: 'Quota',
      descrizione: `Quota associativa ${stagione}`,
      importo: importo,
      stato: 'Da pagare',
      dataScadenza: `${anno}-${scadRata1}-15`,
    })
  } else {
    const metaImporto = Math.ceil(importo / 2)
    await creaPagamento({
      idAtleta,
      nomeAtleta,
      tipo: 'Quota',
      descrizione: `Quota ${stagione} — Rata 1/2`,
      importo: metaImporto,
      stato: 'Da pagare',
      dataScadenza: `${anno}-${scadRata1}-15`,
    })
    await creaPagamento({
      idAtleta,
      nomeAtleta,
      tipo: 'Quota',
      descrizione: `Quota ${stagione} — Rata 2/2`,
      importo: importo - metaImporto,
      stato: 'Da pagare',
      dataScadenza: `${anno + 1}-${scadRata2}-15`,
    })
  }
  await scriviLog('Quote generate', 'Atleta', nomeAtleta)
}

// ============================================================
// NOLEGGIO — primo noleggio stagione + pagamenti trimestrali
// ============================================================

export async function getDataPrimoNoleggio(idAtleta) {
  const storico = await leggiSheet(SHEETS.STORICO_PATTINI)
  const annoStagione = calcolaAnnoInizioStagione()
  const inizioStagione = new Date(`${annoStagione}-10-01`)
  const fineStagione = new Date(`${annoStagione + 1}-09-30`)

  // Cerca tutte le assegnazioni dell'atleta in questa stagione
  const assegnazioni = storico
    .filter(s => s.ID_Atleta === idAtleta)
    .filter(s => {
      const dataInizio = new Date(s.Data_Inizio)
      return dataInizio >= inizioStagione && dataInizio <= fineStagione
    })
    .sort((a, b) => new Date(a.Data_Inizio) - new Date(b.Data_Inizio))

  if (assegnazioni.length > 0) {
    return assegnazioni[0].Data_Inizio
  }

  // Se non c'è storico, usa la data del pattino attualmente assegnato
  const pattini = await leggiSheet(SHEETS.PATTINI)
  const pattinoAttuale = pattini.find(p => p.ID_Atleta === idAtleta)
  return pattinoAttuale?.Data_Inizio_Noleggio || null
}

export async function generaPagamentoNoleggio(idAtleta, nomeAtleta, pattino) {
  const { trimestreCorrente } = await import('../utils/dateUtils.js')
  const trimestre = trimestreCorrente()
  if (!trimestre) return

  const annoStagione = calcolaAnnoInizioStagione()
  const chiaveTrimestre = `${trimestre.id}-${annoStagione}`

  // Controlla se esiste già un pagamento noleggio per questo trimestre
  const pagamenti = await leggiSheet(SHEETS.PAGAMENTI)
  const esistente = pagamenti.find(p =>
    p.ID_Atleta === idAtleta &&
    p.Tipo === 'Noleggio' &&
    p.Descrizione?.includes(chiaveTrimestre)
  )

  if (esistente) return // già generato

  // Calcola importo: mesi del trimestre × costo mensile
  const config = await getConfigurazione()
  const costoMensile = parseFloat(config.Costo_Noleggio_Mensile) || 15
  const mesiTrimestre = trimestre.mesi.length
  const importo = mesiTrimestre * costoMensile

  // Scadenza: ultimo giorno del trimestre
  const ultimoMese = Math.max(...trimestre.mesi)
  const annoScadenza = ultimoMese < 10 ? annoStagione + 1 : annoStagione
  const scadenza = new Date(annoScadenza, ultimoMese, 0).toISOString().split('T')[0]

  const descPattino = `${pattino.Marca || ''} T.${pattino.Taglia || ''}`

  await creaPagamento({
    idAtleta,
    nomeAtleta,
    tipo: 'Noleggio',
    descrizione: `Noleggio ${descPattino} — ${trimestre.label} (${chiaveTrimestre})`,
    importo,
    stato: 'Da pagare',
    dataScadenza: scadenza,
  })
}

export async function generaPagamentiNoleggioTrimestre() {
  const pattini = await leggiSheet(SHEETS.PATTINI)
  const atleti = await leggiSheet(SHEETS.ATLETI)
  const pattiniNoleggiati = pattini.filter(p => p.ID_Atleta)

  let generati = 0
  for (const pattino of pattiniNoleggiati) {
    const atleta = atleti.find(a => a.ID_Atleta === pattino.ID_Atleta)
    if (!atleta) continue
    try {
      await generaPagamentoNoleggio(
        pattino.ID_Atleta,
        `${atleta.Nome} ${atleta.Cognome}`,
        pattino
      )
      generati++
    } catch (e) {
      console.error('Errore generazione pagamento noleggio:', e)
    }
  }
  return generati
}

// ============================================================
// STORICO SCADENZE (Certificati e Tessere FISR)
// ============================================================

export async function getStoricoScadenze(idAtleta) {
  const storico = await leggiSheet(SHEETS.STORICO_SCADENZE)
  return storico
    .filter(s => s.ID_Atleta === idAtleta)
    .sort((a, b) => new Date(b.Data_Scadenza || 0) - new Date(a.Data_Scadenza || 0))
}

export async function salvaStoricoScadenza(idAtleta, nomeAtleta, tipo, dataEmissione, dataScadenza, nomeFile) {
  const id = `STO-${String(Date.now()).slice(-6)}`
  await aggiungiRiga(SHEETS.STORICO_SCADENZE, [
    id, idAtleta, nomeAtleta, tipo,
    dataEmissione || '', dataScadenza || '', nomeFile || ''
  ])
}

// ============================================================
// CONDIVISIONE E NOTIFICHE
// ============================================================

export async function condividiConUtente(email) {
  const token = getToken()
  if (!token) throw new Error('Token non disponibile')

  const sheetId = GOOGLE_CONFIG.SPREADSHEET_ID
  if (!GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID) await getConfigDrive()
  const driveRootId = GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID

  // Condividi lo Sheet
  try {
    await fetch(`${DRIVE_URL}/files/${sheetId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email, sendNotificationEmail: false })
    })
  } catch (e) {
    console.error('Errore condivisione Sheet:', e)
  }

  // Condividi la cartella Drive root
  if (driveRootId) {
    try {
      await fetch(`${DRIVE_URL}/files/${driveRootId}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email, sendNotificationEmail: false })
      })
    } catch (e) {
      console.error('Errore condivisione Drive:', e)
    }
  }
}

export async function rimuoviCondivisione(email) {
  const token = getToken()
  if (!token) return

  const sheetId = GOOGLE_CONFIG.SPREADSHEET_ID
  if (!GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID) await getConfigDrive()
  const driveRootId = GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID

  // Rimuovi permesso dallo Sheet
  try {
    const res = await fetch(`${DRIVE_URL}/files/${sheetId}/permissions?fields=permissions(id,emailAddress)`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    const permesso = (data.permissions || []).find(p => p.emailAddress?.toLowerCase() === email.toLowerCase())
    if (permesso) {
      await fetch(`${DRIVE_URL}/files/${sheetId}/permissions/${permesso.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
    }
  } catch (e) {
    console.error('Errore rimozione condivisione Sheet:', e)
  }

  // Rimuovi permesso dal Drive
  if (driveRootId) {
    try {
      const res = await fetch(`${DRIVE_URL}/files/${driveRootId}/permissions?fields=permissions(id,emailAddress)`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      const permesso = (data.permissions || []).find(p => p.emailAddress?.toLowerCase() === email.toLowerCase())
      if (permesso) {
        await fetch(`${DRIVE_URL}/files/${driveRootId}/permissions/${permesso.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (e) {
      console.error('Errore rimozione condivisione Drive:', e)
    }
  }
}

export async function inviaEmailBenvenuto(emailDestinatario, nomeDestinatario) {
  const token = getToken()
  if (!token) throw new Error('Token non disponibile')

  const config = await getConfigurazione()
  const nomeSocieta = config.Nome_Societa || 'La tua società sportiva'
  const cittaSocieta = config.Citta_Societa || ''
  const emailSocieta = config.Email_Societa || ''

  const link = `${window.location.origin}?sheet=${GOOGLE_CONFIG.SPREADSHEET_ID}`

  const oggetto = `Accesso Gestionale ${nomeSocieta}`
  const corpo = [
    `Ciao ${nomeDestinatario || ''},`,
    '',
    `sei stato abilitato al Gestionale di ${nomeSocieta}${cittaSocieta ? ' - ' + cittaSocieta : ''}.`,
    '',
    'Clicca il link per accedere:',
    link,
    '',
    `Accedi con il tuo account Google (${emailDestinatario}).`,
    '',
    `Per qualsiasi problema contatta: ${emailSocieta || "l'amministratore della società"}.`,
    '',
    `${nomeSocieta}${cittaSocieta ? ' - ' + cittaSocieta : ''}`,
    '',
    '---',
    'Questa email è stata inviata automaticamente dal Gestionale Skating.',
    'Sviluppato da Mattia Prosperi — masterxpro@gmail.com'
  ].join('\n')

  const messaggio = [
    `To: ${emailDestinatario}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(oggetto)))}?=`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    corpo
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(messaggio)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded })
  })

  if (!res.ok) {
    const errData = await res.json()
    throw new Error('Errore invio email: ' + (errData.error?.message || res.status))
  }

  return true
}
