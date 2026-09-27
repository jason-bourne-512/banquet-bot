# Banquet Bot — BEO → Rundown Rules

This file governs how BEO packets get read and turned into `rundown.html` cards. Loaded automatically whenever Claude works in this repo. Jason fills in the answers below over time, going day-by-day through packets and noting what he'd have done differently — Claude reads this before every packet round and follows whatever's been decided here.

Standing workflow (already locked, see memory `feedback_banquet_bot_dev_workflow`): browser-test on a throwaway local port before every commit, never test against the live server, syntax-check every edit, confirm before any server restart.

---

## Open questions — fill in as you go

### 1. Reconciling conflicting numbers between an old card and a new BEO/email
When a revision doesn't cleanly read as "replace old value with new value" — e.g. the Sep 21 Informa case where the site said "12 rounds of 6" and a revision email said "(16) Crescent rounds of 5 vs (16) Rounds of 7," and it wasn't obvious whether that was old→new or two different figures.

**Decision:** _(not yet answered)_

### 2. How much menu detail belongs on a card
Full ingredient-by-ingredient list vs. a shorthand like "same menu as [date]'s card" vs. just the buffet/table name and price. Same question for whether repeated items across days should get copied in full or cross-referenced.

**Decision (2026-09-26):** The goal is to take ALL the information in the BEO and condense/abbreviate it — not selectively drop content. Concretely, from the Sep 26 SCAD breakfast case:
- Don't list a modified buffet's own *standard/included* items (juices, pastries, eggs, yogurt, etc.) — those are already implied by the buffet's name.
- DO list every specifically named add-on/upcharge item the BEO calls out (e.g., "(55) Egg White Frittata @ $12 Each"), with a short parenthetical of its real description — these are real modifications from the base menu and matter operationally.
- Preserve the BEO's own qualifiers on a menu name exactly — "Modified X", "Slightly Modified Y" — don't drop them.
- Include summary-level "room booking" rows too (e.g. a top "Meeting — No F&B" spanning the full function-space time), even when sub-rows (breakfast/breaks) already exist, so the card reflects the BEO's full attendance table, not just the F&B sub-items.
- Condense agenda/timeline notes (arrival, program flow, departure times) into one line in the NOTE foot-row rather than omitting them.

### 3. When a thin/sparse BEO entry gets a real card vs. diagram-only vs. skipped with a comment
Precedent so far: "Pain Specialist of America" and a few others have been skipped with an inline HTML comment when time/room/headcount are all blank. But what's the line — is *any* missing field enough to skip, or only when nothing usable exists at all?

**Decision:** _(not yet answered)_

### 4. What counts as a "real conflict" worth flagging vs. just picking the newer source silently
BEO packets are dated/printed, so a newer packet should generally win over stale site content — but when does a mismatch deserve an inline note asking staff to confirm with the manager, vs. just quietly fixing it?

**Decision:** _(not yet answered)_

### 5. Anything else you want done differently
Open slot — add new headers here as you go through packets and hit more cases.

---

## Locked rules (already settled, don't relitigate)

- No last names or phone numbers anywhere on the site — first names only for CONTACT/MGR/IC fields.
- Every `data-en`/`data-es`/visible-text trio stays identical (site doesn't actually translate, just duplicates English three times).
- Match existing markup conventions exactly: `.event-card` → `.card-head`/`.card-badges` → `.svc-row` (`.svc-time`/`.svc-top` with tag/room-pill/gtd-pill/`.svc-menu`) → `.card-foot` (CONTACT/ROOM/NOTE/DIAGRAM).
- Day-button color rotation (`a1`-`a5`) must stay unbroken when inserting/removing days.
- `data/rundown.json` is derived from `rundown.html` via `scripts/extract-rundown.js` — never hand-edited. Re-run after every HTML change and check for warnings (a warning means a row got silently dropped from Telegram notification data).
- **No pricing** anywhere in `svc-menu` content going forward (2026-09-26) — drop per-person and per-item prices when building/editing a card. Applies to new/edited content; not a mandate to retroactively strip every existing card unless asked.
- **Coffee/tea shorthand** (2026-09-26): write beverage service as plain "Reg, Decaf, Tazo Teas" rather than verbose brand-name phrasing like "Little City Regular and Decaf Coffee, Assortment of Teas."
- **"No F&B" not the long form** (2026-09-26): use "No F&B" everywhere instead of "No food or beverage required at this time" (applied sitewide, all 83 instances).
- **Multi-note foot-row readability** (2026-09-26): when a ROOM or NOTE foot-value has multiple distinct notes, put each on its own line via `<br>` (matches the existing multi-item svc-menu convention). `scripts/extract-rundown.js`'s `textOrDataEn()` now replaces `<br>` with a space before stripping tags, so this degrades to readable prose in the derived JSON instead of running words together with no separator — this fix covers svc-menu's pre-existing `<br>` usage too, not just foot-rows.
