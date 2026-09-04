# Banquet Bot — Progress Log

_Last updated: 2026-09-04_

## DONE — "Overview" tab added to rundown.html (browser-tested, pushed)
Third tab on `rundown.html`, between Rundown and Diagrams: a flat, no-accordion view of every event — everything expanded, nothing to tap open. Parses the same `.day-section[data-date]` markup already on the page (no fetch, can't go stale) and condenses each company/group down to `Company / Contact / start–finish`, then per room, `time  LABEL`.

Labels: a named menu package (e.g. "Tejas Mexicano," "Healthy Start") shows its real name, shortened; a plain coffee/tea break with no named package shows REG/DEC/HW/Pepsi/Coke/etc.; a plated meal with no named package shows the priciest listed dish (usually the entrée); non-F&B activities (meeting, setup, registration, general session, breakout, exhibits, storage, teardown, office, green room, waiting room, board meeting) get short activity codes. Full key is a legend block at the top of the tab.

Look: always renders in a black-background/green-glow "digital terminal" style regardless of the site's own light/dark toggle (a deliberate distinct mode, not theme-linked) — random words briefly scramble into glitch characters, and a thin horizontal beam slowly sweeps top→bottom on an 11s loop. Past days are dimmed, today gets a TODAY badge, matching the Rundown tab's conventions.

Known gap: day headers (MON, TUE, …) in this tab stay in English even when the page is switched to Spanish — everything else in the app translates, this tab doesn't yet. Left as-is for now (confirmed acceptable).

`overview.html` (standalone first draft) and `design-options.html` (visual-direction scratch page) are still in the repo, unlinked from `index.html` — kept as reference/history of how this feature evolved, not part of the live nav. `index.html` itself is unchanged (single "BEO Rundown" tile, no separate Overview entry point — Overview only lives inside rundown.html now).

## DONE — Rundown update from Sep 3–23 BEO packet (pushed, tested live)
Extended `rundown.html` coverage from Sep 17 through Sep 23 (added Sep 18 UIL NFHS breakfast, and a new "Week of Sep 19–25" with Sep 21–23 — Austin Commercial LP's ATX Leadership Collaborative and Informa TechTarget's 3-day STRATA conference across Primrose AB/CD, Primrose Foyer C, Bluebell, Verbena and Barton). CFMA (Sep 20) still has no event order in this packet, so it stays diagram-only as before.

Cross-checked the new packet against what was already live and caught two real gaps:
- **Missing events**: Regeneron Pharmaceuticals' Buttercup meetings on Sep 11 (afternoon, pork shoulder prep) and Sep 12 (morning wrap-up) weren't in the rundown at all — added both as new event-cards.
- **Wrong headcounts**: Arbonne's Rise Up Retreat (Sep 11–12) was showing "Set for 114 · 19 crescent rounds of 6" and GTD 100 — the BEO says 96 guests, 16 rounds of 6. Corrected both days. Also fixed Rhonda & Ale's wedding (Sep 5) showing "EXP 25" when the BEO guarantees GTD 20 (and the chicken count was off, 25 vs the BEO's 18).
- **Stale "Final Day" labels**: Sep 17's UIL NFHS card said "Final Day," but the new packet shows UIL NFHS continues through Sep 18 — updated the day-summary, card title, and note.
- Flagged one ambiguity rather than guessing: the Sep 22 Informa lunch prints as "11:30 PM–12:30 PM" in the BEO, which can't be right given the day runs 6am–3pm — left a note in the card asking to confirm with Lisa, displayed the sensible AM reading.

## DONE — Full menu refresh (committed `32a69e3`, pushed, tested live)
Refreshed `menu.html` against the live Marriott e-menu (mi.bookmarriott.com, dated Sep 01, 2026) — every section (breakfast, breaks, lunch, dinner, reception, bar & wine, packages), most items re-priced, several new items added. Caught and fixed a real error: the old page had Monday and Sunday's daily lunch buffet themes swapped (Monday was showing Gourmet Deli, Sunday was showing Southern Comforts — actually the reverse, plus Gourmet Deli is available any day, not tied to Monday). Flagged two sections not found in the current online menu (Chef Attended Omelet Station, Conference Dining) with an inline note rather than deleting them, since they may just live on a different menu (e.g. the Corrine restaurant menu). Browser-tested: category expand/collapse, search filtering, light/dark theme all confirmed working before push.

## How we work now
- Claude edits the repo directly at `~/banquet-bot`, commits, and pushes from the Mac (zero-paste).
- Revert point tag on GitHub: **`pre-fixpack1`** (points at commit `9d671bc`, the state before Fix Pack 1). To roll the live site back: `git reset --hard pre-fixpack1 && git push --force`.

## Files (7 pages, all mobile-first, EN/ES + dark/light)
- `index.html` — staff schedule hub + nav, splash screen
- `rundown.html` — BEO daily rundown + Diagrams tab (pdf.js modal viewer)
- `menu.html` — searchable menu reference
- `training.html` — server training accordion
- `handbook.html` — associate handbook accordion
- `rooms.html` — room capacity specs
- `info.html` — property info (6 tabs)
- `diagrams/` — 9 room-set PDFs

---

## DONE — Fix Pack 1 (committed `56ca410`, pushed, tested live)
Verified on the live GitHub Pages site with a real browser — all pass, no console errors on any page.

1. **Light-theme flash fixed** on all 6 non-index pages — added the head boot script that applies saved theme before first paint (index already had it).
2. **rooms.html brought in line with the other pages:**
   - Swapped its odd single-button lang toggle for the standard EN/ES two-button toggle.
   - Fixed a real bug: 18 strings had both `data-en` and `data-es` on the same element, which its old show/hide translation couldn't swap — they stayed English in Spanish mode. Now translate correctly.
   - Standardized light background from `#f5f3ef` to `#f0ece3` to match every other page.
3. **"Foyer" rename** — replaced "Pre-Function" display text in `rundown.html` and `rooms.html` (kept training.html's "Foyer Briefing (Pre-Function)" since it teaches the synonym; kept PDF filenames as-is).
4. **rundown.html upgrades:**
   - Floating **⌖ TODAY button** — appears when today scrolls out of view, taps back to today (IntersectionObserver).
   - **Auto-dim past days** — any day with a date before today gets `.a-dim` automatically (less manual trimming).
   - **Diagram modal closes with Escape key AND phone back button** (history.pushState/popstate) instead of the back button exiting the whole page — this was an Android annoyance.

Note: pdf.js pauses rendering when a browser tab is backgrounded — caused false "timeouts" during automated testing but is a non-issue on phones (page is always foreground). Confirmed diagrams render instantly when tab is in front.

---

## QUEUE — agreed, do one at a time
1. **Extract shared.js + shared.css** — `setTheme`/`setLang`/theme-boot and the `:root` color tokens + header/toggle CSS are copy-pasted across all 7 files (this duplication is what caused the Fix Pack 1 bugs). Single file = one edit fixes every page. Highest-value refactor. _(Next up.)_
2. **Diagram chip on event cards** — small "📐 Diagram" chip on rundown event cards that have one, opening the modal directly (where a server actually looks during service). Keep the Diagrams tab too.
3. **Offline support** — service worker caching HTML + diagram PDFs + a web app manifest for home-screen install. Great 1 Hotel interview line ("works in the service corridor with no signal").
4. **Rundown search/filter** — by group or room; reuse the pattern already in menu/training/handbook.
5. **info.html bilingual** — it has zero `data-en` attributes and no EN/ES toggle; the only page not translated.

---

## ADOPTION IDEAS (make sales/events/servers want to use it)
**Servers** — "Happening now" view: highlight the current/next service block on page open (walk in mid-shift, see "10:15 coffee refresh, Lantana A" with no scrolling). Pair with a room filter ("I'm in Verbena today" → hide the rest) and pull allergy flags up to day level so none hide inside collapsed cards.

**Events (Diana, Samantha)** — Trust + printouts: a "last updated" stamp per day, plus a print stylesheet so the daily rundown prints as a clean one-pager — quietly replaces the BEO packet shuffle (the core pitch).

**Sales** — "Site visit mode": one flattering setup photo per room on the rooms page + a clean menu-highlights view = something to pull up on a tablet while walking a client through the space.

**Non-code, high-leverage** — QR-code poster in the break room linking to today's rundown. Adoption is mostly about removing the "find the link" step (also why home-screen install matters).

---

## STANDING RULES (from project memory — keep applying)
- **PRIVACY — hard rule, no exceptions:** no phone numbers, no last names, anywhere in the site. Contacts (CONTACT field, MGR/IC badges, notes) are first name only — even in prose notes like "packages under Gabby or Christel." Confirmed 2026-08-19 after an audit found last names had crept into several CONTACT fields. Use industry-type aliases when demoing externally.
- Always dynamic JS date detection for TODAY — never hardcoded dates.
- "Foyer" not "Pre-Function" throughout.
- Strip BEO `EXP=1` placeholders and "Post As:" prefixes.
- Any day with any consumable (food/bev/coffee/bar/snacks/water) renders a non-dim color.
- Include dry-set/banquet-box rooms even with no F&B block.
- Don't upload proprietary White Lodging/Marriott docs to third-party systems.
