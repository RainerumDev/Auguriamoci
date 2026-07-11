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
- [ ] **Step 2 — Google OAuth (GIS)** ← PROSSIMO
  - Caricare script GIS, token client (implicit flow), scopes: sheets.readonly,
    drive.readonly, calendar.readonly
  - Salvataggio access token + expiry in localStorage (MAI nell'export config)
  - Silent refresh con prompt='' se sessione Google attiva; avviso a scadenza
  - Client ID configurabile dall'utente nelle impostazioni (niente backend)
  - UI login/logout in SettingsOverlay
- [ ] **Step 3 — Connettori API**
  - `src/lib/google/sheets.ts` — fetch valori + prima riga per mappatura
  - `src/lib/google/calendar.ts` — lista calendari + eventi N giorni
  - `src/lib/google/drive.ts` — listing cartella + download blob → tabella media
  - Sync loop (setInterval, solo online) → scrive in `datasets`
- [ ] **Step 4 — Templating + pannello widget**
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
