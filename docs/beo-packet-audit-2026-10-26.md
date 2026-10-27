# BEO packet reconciliation, October 26, 2026

Source: `~/Downloads/BEO Packet 10.22.26-11.10.26.pdf`, 84 pages, 61 unique event orders.

The desktop live map previously rendered a separate abbreviated `DATA.days` object. Its Bobcat Bluebell entries for October 27 and 28 contained a `Meeting · No F&B` booking line and a generic `Continuous Break` line, without the menu. The Daily Brief uses the detailed rows in `rundown.html`, which already had chips, granola bars, regular coffee, teas and Pepsi products on consumption. The packet does not describe Bobcat as having no F&B. That text was added to the room-booking row during transcription, then displayed alongside actual service by the independent map renderer.

The map keeps its own `DATA.days` object and shows only buffet and break names per room (Jason's rule); menus, counts and notes stay on the Rundown. An interim version that fetched and rendered the full rundown was reverted in f0e8e96. Bobcat October 27 and 28 now show the event order's one function, `Continuous Break`, with the No F&B booking line removed. Galderma's Camellia box drops its booking line and uses the shorter title `Galderma · Team Building` so it fits.

## Packet reconciliation findings

- Added missing setup instructions to 24 cards, predominantly Lenovo, plus Dell, FCM and the October 27 in-house lunch. Added Lenovo November 3 AV-table drape instruction.
- Added Oncology's 5–7 PM bar agenda and 6–7 PM movement from foyer to ballroom. Kept its later October 23 guarantee of 103 and room setup revision; the October 20 packet's 95/108 figures are superseded.
- Corrected Lenovo November 6 breakfast/AM-break guarantees to 75 and beverage/lunch guarantees to 90, retaining EXP 100. Preserved differing EXP/SET figures on other matched event-order rows.
- Completed Lenovo November 4 bar soda flavors and bartender duration.
- Retained the cancelled Q2 Camellia B office as cancelled, and its active Bluebell replacement. Q2 October 22 meal allergies, room-flip sequence, breaks and notes are already present.
- Retained later Reliant Plumeria B additions, Werfen event orders, October 31 brunch and other material outside this packet. Those do not constitute packet omissions.
- Packet anomalies remain identified in source notes: Lenovo November 4 lunch prints an AM end time; FCM November 5 beverage service prints an AM end time. Existing PM interpretations are retained. Later diagrams that disagree with an event order remain flagged for manager confirmation.

## Validation and limits

`node scripts/extract-rundown.js` completed without warnings. `node scripts/test-live-map.js` syntax-checks the map script, confirms it does not fetch the rundown, checks Bobcat shows only `Continuous Break` and Galderma has no booking line and at most 5 lines, and checks no map line carries a price.

Browser layout verification could not run: the sandbox rejects binding a throwaway local HTTP server. The Galderma fit in Camellia has not been checked in a browser. No production site, bot, notification sender or publishing tool was used.

## Event-order coverage

Each order was reconciled to the source by order number, or by event/date/room for Q2 and Reliant (their cards lack the original packet order number). Continuation pages were included. Standard menu inclusions may be condensed according to CLAUDE.md; prices and private contact details are excluded.

| Order | Function date | Organization | Disposition |
| --- | --- | --- | --- |
| 418081 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283004 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 282220 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 282081 | Thursday, October 22, 2026 | Q2 Banking | Cancelled office; Bluebell replacement retained |
| 683269 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 418557 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283349 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283334 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283319 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283104 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283233 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 283224 | Thursday, October 22, 2026 | Q2 Banking | Reconciled to Rundown and map source |
| 972430 | Saturday, October 24, 2026 | Robe Lighting | Reconciled to Rundown and map source |
| 087290 | Saturday, October 24, 2026 | PMADTX -Puppy Mill Awareness Day TX | Reconciled to Rundown and map source |
| 469844 | Saturday, October 24, 2026 | PMADTX -Puppy Mill Awareness Day TX | Reconciled to Rundown and map source |
| 644697 | Monday, October 26, 2026 | US Oncology | Later guarantee/setup revision retained |
| 471342 | Tuesday, October 27, 2026 | Bobcat Company | Reconciled to Rundown and map source |
| 705287 | Tuesday, October 27, 2026 | Galderma Laboratories, LP | Reconciled to Rundown and map source |
| 465242 | Tuesday, October 27, 2026 | Reliant Life Sciences | Reconciled to Rundown and map source |
| 388962 | Tuesday, October 27, 2026 | AUSDW In-House Account | Reconciled to Rundown and map source |
| 569519 | Wednesday, October 28, 2026 | Momentum Skilled Services | Reconciled to Rundown and map source |
| 471359 | Wednesday, October 28, 2026 | Bobcat Company | Reconciled to Rundown and map source |
| 435513 | Wednesday, October 28, 2026 | Galderma Laboratories, LP | Reconciled to Rundown and map source |
| 975446 | Wednesday, October 28, 2026 | Reliant Life Sciences | Reconciled to Rundown and map source |
| 362914 | Wednesday, October 28, 2026 | ABB Inc. | Reconciled to Rundown and map source |
| 087353 | Thursday, October 29, 2026 | Upbring | Reconciled to Rundown and map source |
| 983102 | Thursday, October 29, 2026 | AUSDW In-House Account | Reconciled to Rundown and map source |
| 173428 | Monday, November 02, 2026 | Altasciences | Reconciled to Rundown and map source |
| 345417 | Monday, November 02, 2026 | Texas Association of School Boards (TASB) | Reconciled to Rundown and map source |
| 173527 | Tuesday, November 03, 2026 | Altasciences | Reconciled to Rundown and map source |
| 230646 | Tuesday, November 03, 2026 | Lenovo | Reconciled to Rundown and map source |
| 496782 | Tuesday, November 03, 2026 | Bayer | Reconciled to Rundown and map source |
| 230654 | Tuesday, November 03, 2026 | Lenovo | Reconciled to Rundown and map source |
| 230838 | Wednesday, November 04, 2026 | Lenovo | Reconciled to Rundown and map source |
| 230820 | Wednesday, November 04, 2026 | Lenovo | Reconciled to Rundown and map source |
| 230894 | Wednesday, November 04, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976320 | Wednesday, November 04, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976365 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976606 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 494832 | Thursday, November 05, 2026 | FCM | Reconciled to Rundown and map source |
| 496370 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 496242 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976683 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976669 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976653 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976571 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 976538 | Thursday, November 05, 2026 | Lenovo | Reconciled to Rundown and map source |
| 977190 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 977252 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 496394 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 496386 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 496378 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 977284 | Friday, November 06, 2026 | Lenovo | Reconciled to Rundown and map source |
| 043579 | Friday, November 06, 2026 | FCM | Reconciled to Rundown and map source |
| 043611 | Friday, November 06, 2026 | FCM | Reconciled to Rundown and map source |
| 043643 | Friday, November 06, 2026 | FCM | Reconciled to Rundown and map source |
| 290459 | Sunday, November 08, 2026 | Dell | Reconciled to Rundown and map source |
| 290637 | Monday, November 09, 2026 | Dell | Reconciled to Rundown and map source |
| 290645 | Monday, November 09, 2026 | Dell | Reconciled to Rundown and map source |
| 290665 | Tuesday, November 10, 2026 | Dell | Reconciled to Rundown and map source |
| 290673 | Tuesday, November 10, 2026 | Dell | Reconciled to Rundown and map source |
