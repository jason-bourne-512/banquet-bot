# BEO/reference extraction pipeline (feeds banquet-bot-telegram)

These scripts turn this repo's hand-edited HTML into structured data for the
separate `~/banquet-bot-telegram` project (Telegram notifications + Claude
Q&A). Full design/decision history: see the `banquet-bot-telegram-notifications`
memory file, or `~/banquet-bot-telegram/README.md`.

## Scripts

- `extract-rundown.js` — rundown.html's event cards → `data/rundown.json` (meal/break/beverage/activity, classified by `classify.js`, times parsed by `parseTime.js`).
- `extract-staff-schedule.js` — index.html's staff table → `data/staff-schedule.json` (Jason's shift-start time per date, for the morning digest).
- `extract-page-text.js` — generic HTML→text for menu/rooms/info/training/handbook.html → `data/reference/*.txt`.
- `post-commit-hook.sh` — **the actual hook logic, tracked here because `.git/hooks/` itself is never committed by git.**

## One-time setup on a fresh clone

Git hooks must be installed manually after cloning — this is normal git behavior, not something specific to this repo:

```bash
cp scripts/post-commit-hook.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

After that, any commit touching `rundown.html`, `index.html`, or the reference
pages automatically re-extracts the relevant data and pushes it into
`~/banquet-bot-telegram` (paths are hardcoded in the hook — edit it if either
repo ever moves).

## Dependencies

`npm install` in this directory (cheerio, luxon) — separate from and unrelated
to the site itself, which has no build step.

## BEO tab (this Mac only)

`beo-beta.html` shows the day's original BEO pages with red updates, notes under each BEO, and yellow highlights (drag to
highlight, tap a highlight to remove it). It is Mac-only:

- The side-panel BEO link (Jason's Private block) shows only when Banquet Bot is opened from `127.0.0.1` or `localhost`. It never appears on the live site, and visiting the page there does not turn it on. Off localhost the page just says it only works on the Mac.
- The originals are company documents and are never committed: `build-beo-originals.js` reads the BEO packet PDFs in `~/Downloads` and renders the newest print of each event order into `beo-originals/` (gitignored).
- Notes and highlights save through the local server into `beo-local-state.json` at the repo root (gitignored, written atomically, never served). They survive reloads and are shared by every browser on this Mac. If the server is not running, the page saves them in that browser's localStorage (`bb-beo-local-v1`) and merges them into the file the next time the server is up. Old `bb-beo-notes-v1` notes are copied over once, and the old key is removed only after they all saved.
- No Firebase and no Google sign-in is involved.

```bash
node scripts/build-beo-originals.js      # window: 7 days back to 21 days out (--from / --to / --src to change)
node scripts/serve-beo-beta.js           # http://127.0.0.1:8765/beo-beta.html  (restart it after pulling changes)
node scripts/test-beo-local.js           # store, server API, and the localhost gate
```

Server API (127.0.0.1 only, Host and Origin checked, JSON only): `GET /api/beo/state`, `POST /api/beo/notes`,
`POST /api/beo/highlights`, `POST /api/beo/import`, `DELETE /api/beo/notes/<id>`, `DELETE /api/beo/highlights/<id>`.
