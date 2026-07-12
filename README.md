# Auguriamoci 🎉

PWA di **digital signage** per oratori, scuole e uffici: mostra a rotazione
compleanni, onomastici, eventi da Google Calendar e contenuti multimediali da
Google Drive.

**100% serverless e offline-first**: gira su GitHub Pages, nessun backend,
API Google chiamate solo dal browser (OAuth), dati e media salvati in
IndexedDB per la riproduzione offline.

## Funzionalità

- **Compleanni** da Google Sheets: mappatura colonne guidata con
  auto-riconoscimento della colonna data, filtro "oggi + N giorni"
  (l'anno è ignorato).
- **Onomastici**: da foglio esterno oppure dal dizionario interno
  (~230 nomi italiani, match senza maiuscole/accenti).
- **Calendario**: eventi del giorno e dei prossimi N giorni, template con
  `{titolo}` `{data_inizio}` `{ora_inizio}` `{data_fine}` `{ora_fine}`
  `{descrizione}` `{luogo}` e `{periodo}` — un riassunto "intelligente"
  in italiano ("domenica 12 luglio dalle 10:00 alle 12:00",
  "da domenica 12 a martedì 14 luglio", …).
- **Editor template stile Word**: grassetto/corsivo/colore/dimensione,
  vista HTML, clic sul nome colonna per inserire il `{placeholder}` al
  cursore.
- **Layout intelligente**: margini per lato (o selezione visuale del
  rettangolo del contenuto trascinando su un'anteprima 16:9), contenuto
  scalato per stare nello spazio, sotto-pagine automatiche quando gli
  elementi sono troppi; sfondo pagina da Drive o immagine incorporata
  nella configurazione.
- **Media da Drive**: immagini e video (scaricati e riprodotti anche
  offline), Presentazioni/Documenti Google via iframe (solo online).
  Per ogni file: salta, audio video on/off, durata = lunghezza video,
  adattamento immagine (cover/contain). Selezione con Google Picker
  (richiede API key) o incollando URL/ID.
- **Smart routing** (motore di paginazione):
  - un widget può avere una **pagina fissa** (es. Compleanni = pagina 5);
  - i file Drive che iniziano con `5_`, `5-` o `5 ` sono **forzati** alla
    pagina 5;
  - i file senza prefisso **riempiono** le pagine vuote;
  - in caso di collisione il player **sceglie a caso** ad ogni ciclo.
- **Modalità presentazione**: fullscreen, menu segreto (ingranaggio su
  movimento mouse), indicatore offline, la riproduzione non si interrompe mai.
- **Configurazione portabile**: export/import `.json` (mai i token OAuth).

## Setup Google Cloud (una tantum)

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) e crea
   un progetto.
2. **API e servizi → Libreria**: abilita *Google Sheets API*, *Google Drive
   API*, *Google Calendar API*.
3. **Schermata consenso OAuth**: tipo *Esterno*, aggiungi gli utenti di test
   (gli account Google che useranno l'app).
4. **Credenziali → Crea credenziali → ID client OAuth**:
   - Tipo: **Applicazione web**
   - Origini JavaScript autorizzate:
     - `http://localhost:5173` (sviluppo)
     - `https://<utente>.github.io` (produzione)
5. Copia il **Client ID** e incollalo nelle impostazioni dell'app
   (⚙️ → Account Google).
6. *(Facoltativo, per il Google Picker)* **Credenziali → Crea credenziali →
   Chiave API**: copia la **API key** nelle impostazioni. Senza chiave i
   pulsanti "Da Drive" restano disabilitati e si usa l'URL/ID incollato.

## Sviluppo

```bash
npm install
npm run dev        # http://localhost:5173/Auguriamoci/
npm test           # unit test (vitest)
npm run build      # typecheck + bundle + service worker
```

Il base path è `/Auguriamoci/` (GitHub Pages); per servire dalla root:
`BASE_PATH=/ npm run build`.

## Deploy

Push su `main` → il workflow `.github/workflows/deploy.yml` esegue test,
build e pubblica su GitHub Pages (abilitare Pages → Source: GitHub Actions
nelle impostazioni del repo).

## Architettura

| Layer | Tecnologia |
| --- | --- |
| UI | React 19 + Tailwind CSS v4 |
| Build/PWA | Vite 6 + vite-plugin-pwa (Workbox) |
| Storage | Dexie (IndexedDB): `kv` config, `datasets` payload API, `media` blob |
| Auth | Google Identity Services, token flow implicit (token in localStorage) |
| Sync | Loop in-app: fetch API Google → IndexedDB, solo online |
| Player | Legge esclusivamente da IndexedDB: mai rete in riproduzione |

Lo stato di avanzamento e le note per lo sviluppo sono in
[PROGRESS.md](PROGRESS.md).
