// ============================================================
// CONFIGURAZIONE GOOGLE API
// ============================================================

export const GOOGLE_CONFIG = {
  // Client ID — fisso, tuo progetto Google Cloud (uguale per tutti i clienti)
  CLIENT_ID: '1020122836329-089abpqv770akergerf3h2qj2pvkqsgt.apps.googleusercontent.com',

  // SPREADSHEET_ID — letto dall'URL (?sheet=XXX) o da localStorage
  get SPREADSHEET_ID() {
    const urlParams = new URLSearchParams(window.location.search)
    const sheetFromUrl = urlParams.get('sheet')
    if (sheetFromUrl) {
      localStorage.setItem('config_spreadsheet_id', sheetFromUrl)
      return sheetFromUrl
    }
    return localStorage.getItem('config_spreadsheet_id') || ''
  },

  // Questi vengono caricati dal foglio Configurazione dopo il login
  // Usare getConfigDrive() per ottenerli
  DRIVE_ROOT_FOLDER_ID: '',
  DRIVE_ATLETI_FOLDER_ID: '',

  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send'
  ].join(' ')
}

// Cache configurazione Drive (caricata dal foglio Configurazione)
let driveConfig = null

export async function getConfigDrive() {
  if (driveConfig) return driveConfig

  const token = localStorage.getItem('gapi_token')
  if (!token || !GOOGLE_CONFIG.SPREADSHEET_ID) return { root: '', atleti: '' }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/Configurazione`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    const [headers, ...righe] = data.values || []
    const config = {}
    righe.forEach(r => { if (r[0]) config[r[0]] = r[1] || '' })

    driveConfig = {
      root: config.Drive_Root_ID || '',
      atleti: config.Drive_Atleti_ID || ''
    }

    GOOGLE_CONFIG.DRIVE_ROOT_FOLDER_ID = driveConfig.root
    GOOGLE_CONFIG.DRIVE_ATLETI_FOLDER_ID = driveConfig.atleti

    return driveConfig
  } catch (e) {
    console.error('Errore caricamento config Drive:', e)
    return { root: '', atleti: '' }
  }
}

export function resetDriveConfig() {
  driveConfig = null
}

// ============================================================
// NOMI DEI FOGLI GOOGLE SHEETS
// ============================================================
export const SHEETS = {
  ATLETI:          'Atleti',
  ATLETI_EXTRA:    'Atleti_Extra',
  CATEGORIE:       'Categorie',
  PATTINI:         'Pattini',
  RUOTE:           'Ruote',
  SLOT_FISSI:      'Slot_Fissi',
  EVENTI_SPECIALI: 'Eventi_Speciali',
  PRESENZE:        'Presenze',
  MODULISTICA:     'Modulistica',
  UTENTI:          'Utenti',
  LOG:             'Log',
  STORICO_PATTINI: 'Storico_Pattini',
  PAGAMENTI:       'Pagamenti',
  CONFIGURAZIONE:  'Configurazione',
  STORICO_SCADENZE: 'Storico_Scadenze',
  ASSEGNAZIONE_RUOTE: 'Assegnazione_Ruote',
  TROLLEY_GARA:       'Trolley_Gara'
}

// ============================================================
// TRIMESTRI NOLEGGIO
// ============================================================
export const TRIMESTRI = [
  { id: 'T1', label: 'Settembre – Dicembre', mesi: [9, 10, 11, 12] },
  { id: 'T2', label: 'Gennaio – Marzo',      mesi: [1, 2, 3] },
  { id: 'T3', label: 'Aprile – Giugno',      mesi: [4, 5, 6] }
]

export const ALERT_GIORNI_ANTICIPO = 30
