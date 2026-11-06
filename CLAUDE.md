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
- **CONTACT = the in-house contact** (Jason 2026-10-20): fill CONTACT (and the IC chip) from the event order's "IN-HOUSE CONTACT" line, not the CUSTOMER line. Only when it says "SAME" does the customer become the contact. First name only.
- Every `data-en`/`data-es`/visible-text trio stays identical (site doesn't actually translate, just duplicates English three times).
- Match existing markup conventions exactly: `.event-card` → `.card-head`/`.card-badges` → `.svc-row` (`.svc-time`/`.svc-top` with tag/room-pill/gtd-pill/`.svc-menu`) → `.card-foot` (CONTACT/ROOM/NOTE/DIAGRAM).
- **Sign name = POST AS** (Jason 2026-11-03): every `.event-card` carries `data-post="…"` from the event order's header POST AS line (the one at the top of the sheet), which Print Signs uses as the group name. Clean it up: drop month-year tags (Nov2026), account numbers/codes and typos. If the header is the generic in-house account, use the function's POST AS instead. If it names a person or says "Do Not Post", leave `data-post` off (the Rundown group name is used).
- **Every F&B item shows on the Live Map** (Jason 2026-11-03): every F&B service gets its own short Live Map row, abbreviated so it never overflows its box using just the menu or station name ("Passed apps", "Chips & dips station", "Taste of the Southwest", "Favorite Brands bar", "PM break"); no full item lists on the map, the Rundown has those. Stations/displays buried in another section (e.g. a display station at the end of a passed list) get their own Rundown row and their own Live Map row.
- Day-button color rotation (`a1`-`a5`) must stay unbroken when inserting/removing days.
- `data/rundown.json` is derived from `rundown.html` via `scripts/extract-rundown.js` — never hand-edited. Re-run after every HTML change and check for warnings (a warning means a row got silently dropped from Telegram notification data).
- **No pricing** anywhere in `svc-menu` content going forward (2026-09-26) — drop per-person and per-item prices when building/editing a card. Applies to new/edited content; not a mandate to retroactively strip every existing card unless asked.
- **Coffee/tea shorthand** (2026-09-26): write beverage service as plain "Reg, Decaf, Tazo Teas" rather than verbose brand-name phrasing like "Little City Regular and Decaf Coffee, Assortment of Teas."
- **"No F&B" not the long form** (2026-09-26): use "No F&B" everywhere instead of "No food or beverage required at this time" (applied sitewide, all 83 instances).
- **Multi-note foot-row readability** (2026-09-26): when a ROOM or NOTE foot-value has multiple distinct notes, put each on its own line via `<br>` (matches the existing multi-item svc-menu convention). `scripts/extract-rundown.js`'s `textOrDataEn()` now replaces `<br>` with a space before stripping tags, so this degrades to readable prose in the derived JSON instead of running words together with no separator — this fix covers svc-menu's pre-existing `<br>` usage too, not just foot-rows.
- **Event order details in the card footer** (2026-10-02): carry every bottom-of-BEO section onto the card, in this foot-row order: CONTACT, ROOM (room + full ROOM SETUP text), FOOD (BEO "FOOD" notes), AV (BEO "AUDIO VISUAL"), BILLING, NOTE, DIAGRAM. FOOD and BILLING are newer keys (`data-es` "COMIDA" / "FACTURACIÓN"); `extract-rundown.js` only reads CONTACT/ROOM/NOTE, so keep dietary/allergy info in NOTE too when it matters for Telegram.
- **BILLING is non-price terms only** (2026-10-02): state that terms exist ("F&B minimum applies (see BEO)", "10% off F&B", "small-group surcharge applies to lunch", "setup changes incur a reset charge") — never dollar amounts. Same no-pricing rule as svc-menu.
- **Room booking rows for every function** (2026-10-02, reinforces rule #2 above): every BEO attendance-table line gets its own svc-row — Meeting/Meal Room/Breakout/Set Up rows as "X — No F&B" with their real time range — and every service time cell must keep the `–<br>` form (e.g. `8:00 AM–<br>5:00 PM`); without the `<br>` the extractor silently drops the row.
- **Booking rows are hidden where there's food** (2026-10-05, Jason): the rundown page does not show a room's "X — No F&B" booking row when that room has any food/beverage row — it read as a contradiction. Rooms with no F&B at all still show it. Display-only: keep authoring the booking rows in the HTML (rule above) so the data stays complete.
- **One block per room** (2026-10-05): the rundown splits a multi-room card into one block per room, each with its own times and staff; the note and event order details show on the first room only.
- **No "same menu as …" shortcuts** (2026-10-02): write each day's menu out in full from its own event order, even when it repeats another day's buffet.
- **Every event-order note reaches the card** (2026-10-15, Jason): any additional information on an event order — SPECIAL ARRANGEMENTS, ROOM SETUP rows (all of them, including continuation pages), AUDIO VISUAL, FOOD/BEVERAGE notes, billing terms, agendas (as "Agenda on the event order"), dietary notes — must land in the card's footer rows so it shows in the desktop Daily Brief (Setup triangle: Setup/Note/Food/AV/Billing/Shipping) and the phone Rundown's Event order details. When stripping a price would break a sentence ("Bar turns to Cash Bar after $900 is reached"), reword it so it still reads ("hosted bar turns to a cash bar once the hosted limit is reached"). After every packet, check each EO's raw SPECIAL/ROOM/AV text against the card.
- **SHIPPING foot-row** (2026-10-12): client packages (carrier, box count, deadline, tracking numbers one per line, return-pickup notes) go in a SHIPPING foot-row (`data-es` "ENVÍOS") placed before DIAGRAM. The rundown's Event order details renders it; also put a one-line pointer in NOTE so Telegram (which reads CONTACT/ROOM/NOTE only) sees it.
- **Captain reports: vary wording so each sounds human, never templated** (2026-10-28, Jason): `captain-report.html` words each event's default note differently, with varied openers and sentence order and no stock line repeated from event to event on a night. Keep the facts the same, first names only, no em dashes, no prices. `node scripts/test-captain-report.js` checks it.
- **Captain report layout** (2026-11-03, Jason): "Banquet Captain Report / Westin Austin at The Domain" header with Captain Jason and Manager Hector. One section per group: event manager, room, overall start-to-finish time, guaranteed, a blank Number Served, bar type only when there is a bar, optional Special Plates / Service Notes / Guest Comments, and the varied generic Notes. No per-service rows, no setup notes. Jason can remove a Rundown event or add his own. Events with no F&B (set-up, office, meeting-only bookings) get no section; time, room and guarantee come from the F&B services only.
- **Today page folded into the Rundown** (2026-11-03, Jason): `today.html` only redirects to `rundown.html#rundown` and is gone from the desktop menu. On today's Rundown, a service whose end time has passed grays out by itself (phone and desktop); on desktop a click blacks a service out as DONE (kept per computer in localStorage `bb-rd-done-<date>`), and a "Today, in order" strip lists the F&B service times across all groups.
- **Scheduler vacant spots** (2026-11-04, Jason): every shift has "+ Vacant", an open spot with its own hours (`VAC` in the build, saved per computer like the rest of the draft). It shows as a red dashed VACANT chip with Fill / × and counts in the shift pill. On the final schedule and the Excel file it gets a "VACANT · NEEDS TO BE FILLED" band with highlighted cells until it is filled. Fill → pick a person: they take the spot's hours and the vacancy disappears.
- **Pre-Function on the Live Map** (2026-11-04, Jason): Pre-Function is the foyer, and its Social Tables diagram is the same space as the floor plan's foyer, so it overlays that foyer at full size with walls and doors lined up, never shrunk into the strip. Whenever a day has a Pre-Function event with a PRE-FUNCTION diagram, add `[451,96,1949,1360,"livemap/g_PREFUNCTIONfrom<Event>.png","Pre-Function · <Group> <service>",[990,1000,1700,1034]]` (the 7th field is the label's box, in the clear lower foyer). Make the image from the PDF: render at 300 dpi (`pdftoppm -r 300`), cut the scale bar and caption (keep y 0-3085), rotate a quarter turn counter-clockwise (`np.rot90(a,1)`), crop to x 46-3075, y 2-2547, turn white transparent (black with alpha = 255 - gray), then resample at 2 px per plan px with this per-axis wall-to-wall map (rotated px → plan px, slope .4956 past the ends). X: 46→451.5, 104→485, 324→579, 426→638.5, 581→711, 856→842, 1143→988.5, 1505→1176, 1938→1372, 2577→1706, 2863→1837, 3008→1915.5. Y: 262→225.5, 764→473.5, 1265.5→717, 1556→869.5, 1897→1050, 2544→1358. The event text stays on the off-map Pre-Function card.
- **Captains on the Scheduler** (2026-11-04, Jason): Jason (`CAPTAINS`) can be put on any shift from a "Captain" group in the + add list. Construct schedule never places him. His hours go on his own Banquet Captain row on the final schedule and in the Excel file, never the SERVER band, and they count in Hours check.
- **Flag every change that comes in by email** (2026-11-06, Jason): whenever an Outlook email (Diana, Lisa, Hector or anyone) changes an event that is already on the Rundown, mark what changed so it shows as a red ⚑ "Updated <day> · <who>: <what>" line. Put `data-upd="YYYY-MM-DD|Who|What changed"` (email date, sender's first name, one short plain sentence, no prices) on the `.svc-row` that changed (new rows too); for a setup, room, count-only or note change that isn't one service, put it on the `.event-card`. Several updates on one element join with `;;`. Keep earlier `data-upd` entries when a newer email changes the same thing (append, don't replace). Brand-new events from a first packet don't get flags; revisions, adds, cancellations of a service and moved times/rooms do. Also add "revised <m/d>" to the NOTE's event order line.
