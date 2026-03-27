# Gestionale Skating — PWA

Gestionale per società di pattinaggio a rotelle.  
Stack: React + Vite + Google Sheets API + Google Drive API

---

## SETUP — Segui questi passi in ordine

### 1. Google Cloud Console

1. Vai su https://console.cloud.google.com
2. Crea un nuovo progetto (es. "gestionale-skating")
3. Vai su **APIs & Services → Enable APIs**
4. Abilita:
   - **Google Sheets API**
   - **Google Drive API**
5. Vai su **APIs & Services → Credentials**
6. Crea **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173` (dev) e il tuo dominio Netlify (prod)
7. Copia il **Client ID**

### 2. Google Spreadsheet

1. Crea un nuovo Google Sheet
2. Crea questi fogli (tab) con esattamente questi nomi:
   - `Atleti`
   - `Categorie`
   - `Pattini`
   - `Ruote`
   - `Slot_Fissi`
   - `Eventi_Speciali`
   - `Presenze`
   - `Modulistica`
3. Aggiungi le intestazioni in riga 1 per ogni foglio (vedi struttura dati sotto)
4. Copia l'**ID dello spreadsheet** dall'URL

### 3. Google Drive

1. Crea una cartella su Drive: `SSD_NomeSocieta`
   - Sottocartella: `Atleti`
   - Sottocartella: `Modulistica`
2. Copia l'**ID della cartella radice** dall'URL

### 4. Configurazione app

Apri `src/config/google.js` e compila:

```js
CLIENT_ID: 'TUO_CLIENT_ID.apps.googleusercontent.com',
SPREADSHEET_ID: 'TUO_SPREADSHEET_ID',
DRIVE_ROOT_FOLDER_ID: 'TUO_DRIVE_FOLDER_ID',
```

### 5. Installazione e avvio

```bash
npm install
npm run dev
```

### 6. Deploy su Netlify

```bash
npm run build
# Carica la cartella dist/ su Netlify
# Oppure collega il repo GitHub per deploy automatico
```

---

## STRUTTURA DATI — Intestazioni Google Sheets

### Foglio: Atleti
```
ID_Atleta | Nome | Cognome | Data_Nascita | Codice_Fiscale | ID_Categoria |
Genitore_Nome | Genitore_Telefono | Genitore_Email |
Scad_Certificato | Scad_FISR | Numero_FISR | Drive_Folder_ID | Attivo |
Data_Iscrizione | Note
```

### Foglio: Categorie
```
ID_Categoria | Nome | Fascia_Eta | Attiva
```

### Foglio: Pattini
```
ID_Pattino | Numero_Identificativo | Taglia | Stato | ID_Atleta |
Data_Inizio_Noleggio | Stato_Pagamento | Note
```

### Foglio: Ruote
```
ID_Set | Diametro_mm | Durezza_A | Quantita | Stato | Note
```

### Foglio: Slot_Fissi
```
ID_Slot | ID_Categoria | Giorno_Settimana | Ora_Inizio | Ora_Fine | Allenatore | Attivo
```

### Foglio: Eventi_Speciali
```
ID_Evento | Titolo | Data | Ora_Inizio | Tipo | Luogo | ID_Categoria | Note
```

### Foglio: Presenze
```
ID_Presenza | Tipo_Sessione | ID_Riferimento | Data | ID_Atleta | Presente
```

### Foglio: Modulistica
```
ID_Modulo | Nome | Descrizione | Drive_File_ID | Stagione | Attivo
```

---

## STRUTTURA FILE

```
src/
  config/
    google.js          ← Configurazione API (compila questo)
  hooks/
    useGoogleAuth.js   ← Autenticazione Google
  utils/
    sheetsApi.js       ← Tutte le chiamate API
    dateUtils.js       ← Scadenze, trimestri, alert
  pages/
    LoginPage.jsx      ← Schermata login
    Dashboard.jsx      ← Home con stats e alert
    Atleti.jsx         ← Lista atleti + scheda
    Attrezzature.jsx   ← Pattini + ruote
    Calendario.jsx     ← Allenamenti + presenze
    Modulistica.jsx    ← Download moduli
  App.jsx              ← Routing e navigation
  index.css            ← Design system completo
```

---

## TODO — Da implementare nella fase 2

- [ ] Form aggiunta nuovo atleta
- [ ] Form aggiunta nuovo pattino
- [ ] Form creazione evento speciale
- [ ] Creazione automatica cartella Drive per nuovo atleta
- [ ] Storico presenze per atleta (% frequenza)
- [ ] Notifiche push per scadenze (Web Push API)
- [ ] Configurazione categorie con orari (i 4 slot da definire)
- [ ] Export lista atleti in CSV

---

## AGGIORNAMENTI v2

### Foglio: Utenti (NUOVO — obbligatorio)
```
Email | Nome | Ruolo | Attivo
```
- Aggiungi qui le email dei dirigenti autorizzati
- `Attivo` deve essere `TRUE` per consentire l'accesso
- Chi non è in lista viene bloccato anche se ha un account Google

### Foglio: Eventi_Speciali — colonne aggiornate
```
ID_Evento | Titolo | Data | Ora_Inizio | Tipo | Luogo | ID_Categoria |
Scad_Iscrizione | Scad_Pagamento | Data_Convocati | Documenti_Richiesti |
Iscritti | Stato_Pagamento_Gara | Note
```
- `Iscritti`: lista di ID atleti separati da virgola (es. `ATL-001,ATL-003`)
- `Stato_Pagamento_Gara`: `Pagato` / `Da pagare`
- Le colonne di scadenza valgono solo per eventi di tipo `Gara`
