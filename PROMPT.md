# Documento di Specifica dei Requisiti (PRD)

## Progetto: **Auguriamoci** - Digital Signage PWA

### 1. Visione d'Insieme

**Auguriamoci** è un'applicazione web progressiva (PWA) progettata per il digital signage (es. schermi in oratori, scuole, uffici). L'app mostra una presentazione ciclica di eventi imminenti (compleanni, onomastici), appuntamenti da calendario e contenuti multimediali.
La caratteristica principale è l'architettura **100% Serverless e Offline-First**: è ospitata su GitHub Pages, non possiede un database di backend proprietario, utilizza le API di Google interamente lato client (OAuth) e salva sia la configurazione che i dati per la riproduzione offline nel browser locale (IndexedDB/Local Storage).

---

### 2. Architettura e Stack Tecnologico Richiesto

L'agente dovrà implementare la soluzione utilizzando il seguente stack (o equivalenti moderni):

* **Frontend Framework:** React.js (con Vite) o Vue 3.
* **PWA:** Service Worker configurato tramite Workbox (per caching asset statici e gestione richieste offline).
* **Gestione Dati Locali:** `localForage` o `Dexie.js` (wrapper per IndexedDB) per gestire mole di dati superiore al LocalStorage.
* **Autenticazione:** Google Identity Services (GIS) - Flusso *Implicit Grant* o *PKCE* per SPA (Single Page Application).
* **Integrazioni:** Google Sheets API v4, Google Drive API v3, Google Calendar API v3.
* **Hosting:** GitHub Pages.
* **UI/Styling:** Tailwind CSS (per rapidità e pulizia del codice) + editor WYSIWYG leggero (es. Quill.js o un custom parser basato su contenteditable) per i template.

---

### 3. Autenticazione e Gestione Dati (Constraint di Sicurezza)

Questo modulo è critico in quanto non esiste un backend.

* **OAuth 2.0:** L'app deve utilizzare un Client ID Google configurato per applicazioni Web. Gli URI di reindirizzamento consentiti devono includere `http://localhost:*` (per sviluppo) e l'URL di GitHub Pages (per produzione).
* **Token Management:** Il token di accesso (Access Token) rilasciato da Google deve essere salvato in `localStorage`. Poiché i token lato client scartano il *refresh token* per motivi di sicurezza, l'app deve gestire la scadenza del token avvisando l'utente (o forzando un silent login tramite prompt invisibile se la sessione Google del browser è ancora attiva).
* **Zero-Backend Policy:** Nessun dato (nomi, date, configurazioni) deve mai essere inviato a server terzi oltre alle API ufficiali di Google. Tutto risiede in IndexedDB.

---

### 4. Flusso Utente ed Esperienza (UX/UI)

#### 4.1. Primo Accesso (Onboarding)

* Se l'app rileva l'assenza di una configurazione valida nel LocalStorage, la visualizzazione è una pagina di benvenuto con due azioni:
1. **"Configura la tua Digital Signage"** (Avvia la creazione guidata / login Google).
2. **"Importa una configurazione"** (Permette l'upload di un file `.json` generato precedentemente dall'app).



#### 4.2. Modalità Presentazione (Runtime)

* Avvio automatico in fullscreen (sfruttando le Fullscreen API del browser).
* **Interfaccia pulita:** Solo i contenuti dei widget.
* **Menu Segreto:** Nessun bottone visibile. Se l'utente muove il mouse, appare un'icona a forma di ingranaggio in un angolo (es. in basso a destra) con opacità progressiva. Cliccandolo si apre un overlay modale con le Impostazioni.
* **Indicatore Offline:** In caso di `navigator.onLine === false` (o fallimento dei ping di rete), appare un'icona semitrasparente (es. un cloud sbarrato) in un angolo per indicare che i dati mostrati sono quelli della cache. La presentazione **non deve interrompersi**.

---

### 5. Configurazione e Impostazioni

Il pannello Impostazioni deve permettere di gestire:

1. **Login/Logout account Google.**
2. **Intervallo di aggiornamento dati:** (es. ogni 15, 30, 60 minuti). Il fetch dei dati in background aggiorna la cache locale.
3. **Esportazione Configurazione:** Genera un file `.json` contenente layout, mappature colonne e ID dei file Google (ATTENZIONE: non esportare il token di accesso OAuth per sicurezza).
4. **Gestione Pagine e Widget:** Interfaccia per aggiungere, configurare e ordinare i widget.

---

### 6. Specifiche dei Widget
* Il sistema di widget deve essere modulare e scalabile. Ogni widget deve avere un'interfaccia di configurazione e un motore di templating per personalizzare l'output.

#### 6.1. Widget Compleanni (Sorgente: Google Sheets)

* **Selezione Dati:** L'utente incolla l'URL o l'ID del Google Sheet.
* **Mappatura Intestazioni:** L'app scarica la prima riga del foglio e chiede all'utente di mappare i campi. L'app **deve auto-suggerire** la colonna della data di nascita analizzando i nomi delle intestazioni (es. tramite regex: `/birth|date|nascita|data/i`).
* **Motore di Templating:** Un editor di testo inline che accetta variabili tra parentesi graffe.
* *Esempio UI input:* `<h1>{nome} {cognome}</h1> <h3>studente di {classe}</h3>`
* L'agente deve implementare una funzione di interpolazione (es. `template.replace(/{(\w+)}/g, (_, key) => data[key])`).


* **Filtro:** Il widget deve calcolare la data odierna e filtrare le righe la cui data di nascita (ignorando l'anno) corrisponde a oggi o ai prossimi X giorni (configurabile).

#### 6.2. Widget Onomastici (Sorgente: Dati Locali o Google Sheets)

* Stesso funzionamento del widget compleanni, ma con una doppia opzione per la sorgente dati:
* **Opzione A (Consigliata):** Foglio Google esterno (mappatura colonne come nei Compleanni).
* **Opzione B (Database Interno):** L'app deve includere un dizionario JSON statico precompilato (`nomi_onomastici.json`) nel bundle del codice. L'utente mappa solo la colonna "Nome". L'algoritmo effettua un *best match* stringa (ignorando maiuscole/minuscole e accenti) sul dizionario per trovare la data.



#### 6.3. Widget Calendario (Sorgente: Google Calendar)

* **Selezione Dati:** L'app elenca i calendari disponibili sull'account Google autenticato. L'utente ne seleziona uno.
* **Formattazione Evento:** Motore di templating simile a quello dei compleanni, ma con campi predefiniti estratti dall'API di Calendar: `{titolo}`, `{data_inizio}`, `{ora_inizio}`, `{descrizione}`, `{luogo}`.
* **Filtro:** Recupera e mostra solo gli eventi della giornata odierna e/o dei prossimi N giorni (parametro configurabile).

#### 6.4. Widget Allegati Statici (Sorgente: Google Drive)

* **Selezione Dati:** L'utente seleziona una cartella di Google Drive o ne inserisce l'ID.
* **Importazione:** L'app esegue una query (es. `q: "'FOLDER_ID' in parents"`) per listare i file.
* **Supporto Media:**
* *Immagini:* Scaricate come Blob e salvate in IndexedDB per l'uso offline, mostrate con tag `<img>`.
* *Video:* Scaricati e riprodotti in loop (Mute di default) con tag `<video>`.
* *Google Slides / Docs:* Mostrati tramite `<iframe>` usando l'embed link generato da Google Drive. (Nota per l'agente: gli iframe non funzionano offline. Prevedere un fallback visivo o ignorarli se offline).



---

### 7. Motore di Paginazione e "Smart Routing"

Questa è la logica *core* della presentazione. L'agente deve sviluppare un "Timeline Manager" con le seguenti regole rigorose:

1. **Assegnazione Pagina:** Nelle impostazioni, ogni Widget configurato (es. Compleanni, Calendario) riceve un numero di pagina fisso opzionale (es. Compleanni = pagina 5; Calendario = pagina 10).
2. **Iniezione dei contenuti Drive (Fill & Pin):**
* Il sistema scansiona i nomi dei file scaricati da Google Drive.
* Se un file **inizia con un numero seguito da underscore/trattino/spazio** (es. `5_sfondo.jpg` o `15_promo.mp4`), quel file viene forzato ad apparire in quella specifica pagina.
* I file Drive *senza* prefisso numerico vengono usati "a riempimento" per i numeri di pagina vuoti (es. pagine 1, 2, 3, 4, 6...).


3. **Gestione Collisioni (Shuffle):** Se più elementi sono destinati alla stessa pagina (es. Widget Compleanni su pagina 5 + file Drive `5_festa.jpg` + file Drive `5_avviso.png`), il player effettua una scelta *randomica (shuffle)* ad ogni ciclo completo della presentazione, in modo da non mostrare sempre la stessa sequenza.
4. **Autoplay:** Ogni pagina dura a schermo N secondi (configurabile globalmente e sovrascrivibile per singola pagina).

---

### 8. Gestione Offline (Service Worker & Cache)

Il sistema degli agenti deve implementare un Service Worker robusto:

* **Cache Statica (App Shell):** HTML, JS, CSS, icone e dipendenze di base memorizzati nella cache all'installazione della PWA.
* **Sync Background:** Un loop interno all'app (es. `setInterval`) che ogni `X` minuti effettua chiamate alle API di Google (Sheets, Drive, Calendar) **solo se online**.
* **Storage Locale Dati:** Le risposte JSON delle API di Google e i Blob multimediali leggeri devono essere salvati in IndexedDB.
* **Playback in Assenza di Rete:** Se la rete cade, il player non deve mai richiedere dati alla rete, ma leggere esclusivamente dallo state management locale caricato all'avvio o aggiornato dall'ultimo sync. I contenuti Google Slides (iframe) andranno saltati con un try-catch sulla rete.

---

### Istruzioni Operative per l'Agente IA (Prompt Inception)

*Se sei l'IA incaricata dello sviluppo, procedi in questo modo:*

1. **Step 1:** Inizializza il progetto React/Vue PWA. Crea la struttura base e l'architettura IndexedDB (`localForage`).
2. **Step 2:** Implementa l'integrazione Google OAuth 2.0 (Identity Services) e il sistema di configurazione (JSON Export/Import).
3. **Step 3:** Sviluppa i connettori API isolati (Sheets per Compleanni/Onomastici, Calendar, Drive). Implementa il parsing e il salvataggio offline.
4. **Step 4:** Costruisci il motore di Templating e il pannello delle impostazioni.
5. **Step 5:** Implementa il *Timeline Manager* (la logica di impaginazione, numerazione prefissata e random shuffle).
6. **Step 6:** Costruisci il Player Fullscreen e finalizza CSS/UX.