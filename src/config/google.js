// ============================================================
// CONFIGURAZIONE GOOGLE API
// Da compilare con i tuoi dati dal Google Cloud Console
// ============================================================

export const GOOGLE_CONFIG = {
  // Client ID dal Google Cloud Console
  // https://console.cloud.google.com → Credentials → OAuth 2.0 Client ID
  CLIENT_ID: '1020122836329-089abpqv770akergerf3h2qj2pvkqsgt.apps.googleusercontent.com',

  // ID del Google Spreadsheet principale
  // Lo trovi nell'URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  SPREADSHEET_ID: '17OxQo1s7be_Eg2SB83lAbkr3FgSW8qji0Ys-O2iTfXU',

  // ID della cartella Google Drive radice della società
  // La crei a mano su Drive, poi copi l'ID dall'URL
  DRIVE_ROOT_FOLDER_ID: '1pcjZWEch4CziVdkoltLXg0T9lgNMNljt',
  DRIVE_ATLETI_FOLDER_ID: '15f5KZ04x_egZCd0WIucXgralmF1LzVqq',

  // Scopes necessari
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ')
}

// ============================================================
// NOMI DEI FOGLI GOOGLE SHEETS
// Devono corrispondere esattamente ai nomi dei tab nel file
// ============================================================
export const SHEETS = {
  ATLETI:          'Atleti',
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
  STORICO_SCADENZE: 'Storico_Scadenze'
}

// ============================================================
// LOGICA TRIMESTRI NOLEGGIO
// Stagione settembre-giugno, pagamenti trimestrali
// ============================================================
export const TRIMESTRI = [
  { id: 'T1', label: 'Settembre – Dicembre', mesi: [9, 10, 11, 12] },
  { id: 'T2', label: 'Gennaio – Marzo',      mesi: [1, 2, 3] },
  { id: 'T3', label: 'Aprile – Giugno',      mesi: [4, 5, 6] }
]

// Giorni prima della scadenza per mostrare alert
export const ALERT_GIORNI_ANTICIPO = 30

// PAGAMENTI_CONFIG rimosso — i valori vengono dal foglio Configurazione
