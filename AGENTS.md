# Banquet Bot — agent instructions

Applies to Astra, Codex, and other coding agents working in this repository.

## Start every session

Read this file, `CLAUDE.md` completely, `BEO-NOTES.md`, and `scripts/README.md` before changing files. `CLAUDE.md` contains the authoritative BEO content conventions; follow them alongside these workflow rules. Read relevant code and check `git status` in both this repository and `~/banquet-bot-telegram`. Preserve existing user changes. Re-read a file before editing when the user may be editing it concurrently.

## Purpose and architecture

Banquet Bot supports banquet execution at the Westin Austin at The Domain, downstream of existing hotel systems. Prioritize fast comprehension during service, mobile usability, reliable information, and few taps. Keep future property portability in mind without expanding the task into a rewrite.

- `rundown.html` is the hand/AI-edited event source of truth, transcribed from BEO packets and revisions. There is no automatic PDF ingestion in these repositories.
- Its detailed cards, room-grouped Overview, and Diagrams tab form the main event interface. The embedded Overview derives its content from the cards. PDFs live in `diagrams/`; the viewer uses bundled PDF.js in `vendor/`.
- `index.html` contains the home page and manually transcribed weekly staff schedule.
- `menu.html`, `rooms.html`, `info.html`, `training.html`, and `handbook.html` hold operational reference material.
- `scripts/extract-rundown.js` derives `data/rundown.json` from the cards, using `parseTime.js` and `classify.js`. Never hand-edit derived JSON.
- `scripts/extract-staff-schedule.js` extracts Jason's shift starts only, not the full roster. `extract-page-text.js` derives reference text.
- `room-map.html` fetches `data/rundown.json` and lists rooms with no extracted bookings for the whole day. Missing bookings do not establish confirmed availability. Compound-room mappings are explicit; foyer overlap is not fully modeled.
- `~/banquet-bot-telegram` consumes the generated data for deterministic reminders and AI questions. Its Daily Brief tool can publish `today.html` back to this site on request. That page is not automatically refreshed every morning.
- The site uses static HTML/CSS/JavaScript and GitHub Pages, with no frontend build step. Node dependencies support extraction.

## Publishing and Git hooks: explicit approval required

NEVER push, deploy, publish, or invoke an action that does so without Jason's explicit approval. Completing implementation or testing is not approval. Default completion is tested local changes and a concise diff summary for review. Major UI changes must be reviewed locally before going live.

Inspect the installed `.git/hooks/post-commit` and tracked `scripts/post-commit-hook.sh` before any commit or workflow change. The installed hook currently extracts changed source pages, copies results into `~/banquet-bot-telegram`, regenerates local notification schedules, then automatically commits AND PUSHES the Telegram repository. A local site commit is therefore a publishing action under this rule, even when the site itself is not pushed.

Do not run a triggering commit without explicit approval for that publishing effect. Do not silently disable hooks or alter Git configuration to get around it. Check the Telegram index for unrelated staged work before any approved automatic commit. The hook reads working-directory files, so confirm they correspond to the intended commit. Hooks require installation on fresh clones; a tracked hook script alone is not active automation.

Do not run the real Telegram bot, notification-send scripts, or Daily Brief publishing tools as tests. Confirm with Jason before restarting an existing server or bot.

## Content and UI rules

Follow `CLAUDE.md` for exact markup and BEO conventions. Preserve first-name-only contacts, exclude phone numbers, retain required menu modifications and room-booking rows, and apply the established no-pricing and beverage shorthand rules. Keep visible text and language attributes consistent with its instructions.

Favor vertical room organization with clear times and service details. Keep dietary information near the relevant meal and setup information last. Avoid needless repetition of unchanged guest counts. Preserve EXP/GTD/SET distinctions where required; explain proposed convention changes before applying them.

Preserve the hand-written day summaries. An automatic day-summary rebuild was tried and reverted at Jason's request; do not reintroduce it without being asked. Future staging, changeover, conflict detection, or decision-support ideas are not authorization to implement them.

## Local testing and completion

1. Inspect dependencies and affected consumers before editing. Make incremental changes and preserve working functionality.
2. Serve over HTTP, never `file://`. Use a free throwaway local port; `python3 -m http.server 8899` from this repository is the usual example when that port is free. Do not test against production or restart an existing service without confirmation.
3. Syntax-check modified JavaScript, including inline scripts. Browser-test affected flows before a commit. For rundown changes, check relevant mobile and desktop views, Overview, navigation, and diagrams when affected.
4. After editing rundown HTML, run `node scripts/extract-rundown.js` and inspect every warning plus affected JSON records. A warning can mean a dropped service row. Check parsed times, rooms, counts, and service classification. Run schedule/reference extraction when their source changes. Do not run the publishing hook as a validation shortcut.
5. The site's `npm test` is currently a placeholder. Use meaningful focused checks; do not claim a passing suite that does not exist. Validate notification behavior with isolated fixtures and fake senders when touching that pipeline.
6. Inspect `git diff` and status in both repositories. Report what changed, what was tested, and any remaining uncertainty. Stop at local review unless publishing was explicitly approved.

## Review findings to verify before related work

These were observed in the September 27, 2026 source review and are not permanent design requirements. Re-check current code before treating them as unresolved; update this section when fixed.

- Site `data/` is ignored and untracked, but the room map fetches its JSON. A normal tracked-file Pages deployment lacks that resource.
- `parseTime.js` interpreted `11:00–<br>12:00 PM` as 23:00–12:00; current extracted records had no reversed ranges.
- Extraction can write partially incomplete output despite warnings; only an entirely empty result is blocked.
- Room-map date filtering uses UTC while the bot uses the property timezone.
- Shared page behavior/styles and time parsing are duplicated. Offline support is not established by home-screen icons alone.

For Telegram startup/delivery findings, read its `AGENTS.md`. Live Railway operation was not verified by the source review.
