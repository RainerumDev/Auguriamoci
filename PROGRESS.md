# Auguriamoci — Stato Avanzamento (Ralph Loop)

File letto/aggiornato ad ogni iterazione del loop. Fonte di verità: PROMPT.md (PRD).

## Roadmap (PRD "Istruzioni Operative", step 1-6)

- [x] **Step 1 — Scaffold + IndexedDB** (iterazione 1)
  - Vite + React 19 + TypeScript + Tailwind v4 + vite-plugin-pwa (Workbox)
  - Dexie: tabelle `kv` (config), `datasets` (payload API), `media` (blob Drive)
  - Schema config completo (`src/lib/config.ts`) con export/import JSON validato
  - Onboarding (nuova config / import file), Player shell (menu segreto ⚙️,
    indicatore offline, fullscreen su click), SettingsOverlay (intervallo sync,
    durata pagina, export/import/reset)
- [x] **Step 2 — Google OAuth (GIS)** (iterazione 2)
  - `src/lib/google/auth.ts`: loader script GIS, token client implicit flow,
    scopes sheets/drive/calendar readonly + openid email
  - Token in localStorage chiave `auguriamoci:oauth-token` (mai nell'export)
  - Silent refresh (`prompt: ''`) all'avvio se token scaduto; icona 🔑 nel
    Player quando sessione scaduta
  - `googleClientId` in AppConfig (esportabile, è un identificatore pubblico)
  - `useAuth` hook + sezione Account in SettingsOverlay (input Client ID con
    persistenza su blur, login/logout, stato connesso con email)
  - NON testato con OAuth reale (serve Client ID vero): popup, revoke,
    userinfo fetch da verificare alla prima prova con account reale
- [x] **Step 3 — Connettori API** (iterazione 3)
  - `google/api.ts` — googleGet/googleGetBlob + GoogleApiError (isAuthError)
  - `google/sheets.ts` — fetchSheet (header+rows), extractSheetId, rowsToObjects
  - `google/calendar.ts` — listCalendars, fetchEvents (oggi→+N gg, singleEvents)
  - `google/drive.ts` — listFolderFiles, downloadFileBlob, extractFolderId,
    cap 150MB/file, isEmbeddable (Slides/Docs via iframe)
  - `sync.ts` — syncAll: per-widget try/catch → SyncReport in kv, blob media
    incrementali (confronto modifiedTime), pruneMedia
  - `useSync` — run all'avvio + intervallo config + evento online; bottone
    "Sincronizza ora" + report errori in SettingsOverlay
  - Vitest: 13 test (parsing ID, rowsToObjects, size cap, round-trip config)
  - NON testato contro API reali (serve login vero)
- [x] **Step 4a — Logica templating/filtri** (iterazione 4)
  - `template.ts` — interpolate (valori HTML-escaped, template fidato),
    extractPlaceholders; chiavi con accenti/spazi ok
  - `dates.ts` — parseDayMonth (dd/mm[/yyyy], ISO), daysUntilNext con wrap
    anno, occursInWindow, suggestDateColumn (regex PRD), formatDayMonth it-IT
  - `data/nomi_onomastici.json` — ~230 nomi normalizzati → [giorno, mese]
  - `namedays.ts` — normalizeName (NFD, no accenti), findNameday con
    fallback primo token per nomi composti
  - `widgetData.ts` — buildBirthdayItems / buildNamedayItems /
    buildCalendarItems → RenderItem[] ordinati; placeholder extra
    {data_festa}; calendario: {titolo} {data_inizio} {ora_inizio}
    {descrizione} {luogo}, scarta eventi finiti
  - 37 test vitest verdi
- [x] **Step 4b — Editor widget (UI)** (iterazione 5)
  - `WidgetEditor.tsx`: form per i 4 tipi. Compleanni/onomastici: URL sheet →
    "Carica colonne" (fetch header, auto-suggest colonna data), select colonne,
    lookAhead. Onomastici: radio builtin/sheet. Calendario: "Carica calendari"
    → dropdown. Drive: URL/ID con estrazione automatica. Template textarea +
    chip placeholder cliccabili. Campi comuni: titolo/pagina/durata/enabled.
  - SettingsOverlay: lista widget con toggle/modifica/elimina + 4 bottoni "+"
  - Verificato in browser: add Drive → salva → persiste → elimina; editor
    compleanni renderizza; estrazione folder ID da URL ok
- [x] **Step 5 — Timeline Manager + Player runtime** (iterazione 6)
  - `timeline.ts`: parsePagePrefix (`^\d+[_\- ]`), buildTimeline (pin widget
    con pagina fissa + file prefissati, fill & pin dei buchi, widget senza
    pagina = filler), resolveCycle (shuffle collisioni per ciclo, durata
    override widget ?? default, scarta pagine senza contenuto disponibile)
  - `usePresentation`: monta tutto SOLO da IndexedDB (datasets + media blob →
    object URL), ricalcolo dopo ogni sync e ogni ora (rollover data)
  - `Stage.tsx`: widget HTML (dangerouslySetInnerHTML, valori escapati),
    img/video object-contain (video loop muted), iframe /preview per
    Slides/Docs (solo online), fade-in tra pagine
  - Player: ciclo autoplay con setTimeout per durata pagina, reshuffle a
    fine ciclo; iframe saltati offline via isAvailable
  - 49 test verdi; verificato in browser end-to-end con dataset iniettato
    (pagina compleanno renderizzata, filtro data ok)
- [x] **Step 6 — Polish + deploy** (iterazione 7)
  - Icone PNG 192/512 (canvas browser → base64; 512 upscalata con sips) +
    manifest aggiornato (maskable)
  - `.github/workflows/deploy.yml`: test + build + Pages (abilitare
    Pages→Source: GitHub Actions nel repo)
  - README completo (setup Google Cloud Console, comandi, architettura)
  - Stage: griglia 2 colonne se >3 item nella pagina widget

## Richieste UTENTE (2026-07-11, priorità alta)

- [ ] Editor HTML stile Word (WYSIWYG) in personalizzazione widget ← iter 7
- [ ] Click su nome colonna inserisce placeholder alla posizione cursore ← iter 7
- [ ] Sfondo schermata compleanni: file Drive O upload salvato base64 anche
      nell'export config ← iter 7
- [ ] Google Picker per scegliere file/fogli/cartelle (se possibile; richiede
      API key oltre a client ID)
- [ ] Editor widget Drive: elenco file della cartella + skip per-file
      (memorizza id file da saltare)
- [ ] Opzioni per-file media: video → audio on/off; foto → cover/crop/…;
      per cartella: elenco con opzioni per ogni file

## Backlog / migliorie possibili

- Icona 512 nativa (ora upscalata da 192)
- Anteprima live template nell'editor widget
- Riordino widget (drag/up-down) in impostazioni
- Paginazione Drive listing >1000 file
- Test con dati reali utente (client ID + login già attivi)
- Gestione quota IndexedDB (StorageManager.estimate)

## Note tecniche per le prossime iterazioni

- Build: `npm run build` (tsc -b + vite). Base path GH Pages: `/Auguriamoci/`
  (override con env `BASE_PATH`).
- Config runtime in Dexie `kv` chiave `app-config`; token OAuth andrà in
  localStorage separato (requisito PRD §3).
- Il Player monta lo stage in `src/pages/Player.tsx` (commento `--- Stage ---`).
- Tailwind v4: niente tailwind.config, si importa con `@import "tailwindcss"`.

## Diario iterazioni

- **Iter 1 (2026-07-11):** scaffold completo, build verde, git init + primo commit.
- **Iter 2 (2026-07-11):** OAuth GIS completo (auth.ts, useAuth, UI account).
  Verificato in browser: persistenza Client ID, stati bottone login, nessun
  errore console. OAuth reale da provare con Client ID vero.
- **Iter 3 (2026-07-11):** connettori Sheets/Calendar/Drive + sync engine +
  useSync + vitest (13 test verdi). Build verde, zero errori console.
- **Iter 4 (2026-07-11):** logica Step 4 completa (template, date, onomastici,
  widgetData) — 37 test verdi, build verde. UI editor rimandata a iter 5.
- **Iter 6 (2026-07-11):** Timeline Manager + player runtime completi. Stage
  verificato end-to-end in browser. Cleanup dati test fatto, clientId utente
  preservato.
- **Iter 5 (2026-07-11):** editor widget completo + gestione lista. IMPORTANTE:
  l'UTENTE ha configurato un Client ID reale e ha fatto login vero
  (licenza1@juvenes.it) — OAuth end-to-end confermato funzionante. Client ID
  in config IndexedDB: NON sovrascrivere/cancellare. Niente fetch dei suoi
  dati reali (calendari/fogli) senza richiesta esplicita.
