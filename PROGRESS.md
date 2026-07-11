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
- [ ] **Step 4 — Templating + pannello widget** ← PROSSIMO
  - Interpolazione `{campo}`, editor widget (sheet URL→ID, mappatura colonne
    con auto-suggest data `/birth|date|nascita|data/i`), filtro compleanni
    (ignora anno, prossimi X giorni), onomastici (sheet o `nomi_onomastici.json`
    builtin con match case/accents-insensitive)
- [ ] **Step 5 — Timeline Manager**
  - Pagine fisse per widget, prefissi numerici file Drive (`5_foo.jpg`),
    fill dei buchi con file senza prefisso, shuffle collisioni per ciclo,
    durata per pagina
- [ ] **Step 6 — Player finale + polish**
  - Rendering widget nello stage, media (img/video loop muted), iframe Slides
    con skip offline, transizioni, icone PWA vere, deploy GitHub Pages (workflow)

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
