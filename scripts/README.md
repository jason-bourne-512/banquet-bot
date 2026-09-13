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
