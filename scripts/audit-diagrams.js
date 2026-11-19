#!/usr/bin/env node
/*
 * audit-diagrams.js — are diagrams shared across Rundown, Live Map and Housemen?
 *
 * For every day from today on:
 *   E1 map-only diagram   — a Live Map overlay for a room the Rundown has no diagram for that day
 *                           (the Rundown card, Overview and Housemen never see it)
 *   E2 missing file       — a Rundown or Housemen diagram whose PDF or preview PNG isn't in diagrams/
 *   W1 no map overlay     — a Rundown diagram for an on-map room the Live Map shows that day with no overlay
 *   W2 no Housemen diagram — a Set/Refresh room with no diagram of its own and no Rundown match
 *                           (housemen.html picks up Rundown diagrams at load time — same rule as here:
 *                           that room on the day it's set for, else the same group's from up to a week before)
 *
 * Exit code is non-zero if any E-level problem is found. Run from the repo root:
 *   node scripts/audit-diagrams.js  [--from YYYY-MM-DD]
 */
const fs = require('fs'), path = require('path');
const cheerio = require('cheerio');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));

const arg = process.argv.indexOf('--from');
const FROM = arg > 0 ? process.argv[arg + 1] : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dayAt = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Rundown: every diagram link per date (cards + the hidden #diagramsList), keyed by room
const $ = cheerio.load(read('rundown.html'));
const rd = {};
$('.day-section[data-date]').each((_, sec) => {
  const date = $(sec).attr('data-date');
  $(sec).find('.diag-link').each((__, b) => {
    const m = ($(b).attr('onclick') || '').match(/openDiagram\('diagrams\/([^']+)'\s*,\s*'([^']*)'/);
    if (!m) return;
    const L = rd[date] ||= [];
    const card = $(b).closest('.event-card'), g = card.length ? card.find('.card-group').first() : $(b).closest('.diag-group').find('.diag-group-name').first();
    if (!L.some(x => x.file === m[1])) L.push({ file: m[1], rooms: [key(m[1].split(/from/i)[0]), key(m[2].split(/[:—·(]/)[0])],
      group: key((g.attr('data-en') || g.text() || '').split(' — ')[0]) });
  });
});
const rdHas = (date, room) => (rd[date] || []).some(x => x.rooms.includes(key(room)));
// Same lookup housemen.html does for a night: the room on the day it's set for, else the same group's diagram
// for that room from up to a week before.
function hsmMatch(night, room, forText) {
  const k = key(room), grp = key(String(forText).split(' · ')[0]);
  for (let n = 1; n >= -6; n--)
    if ((rd[dayAt(night, n)] || []).some(x => x.rooms.includes(k) && (n === 1 || (x.group && grp && (x.group.startsWith(grp) || grp.startsWith(x.group)))))) return true;
  return false;
}

// Live Map: overlays per date
const DATA = JSON.parse(read('live-map.html').match(/var DATA = (\{[\s\S]*?\});\n/)[1]);

// Housemen: nightly rooms
const DAYS = eval(read('housemen.html').match(/const DAYS = (\[[\s\S]*?\n\]);/)[1]);

const errors = [], warns = [];
for (const [date, day] of Object.entries(DATA.days)) {
  if (date < FROM) continue;
  const ghostRooms = (day.ghosts || []).map(g => key(path.basename(g[4]).replace(/^g_/, '').split(/from/i)[0]));
  ghostRooms.forEach((g, i) => {
    if (!rdHas(date, g)) errors.push(`[E1] ${date}  Live Map overlay ${path.basename(day.ghosts[i][4])} has no Rundown diagram for that room — add the PDF to diagrams/ and the card`);
  });
  for (const room of Object.keys(day.ev || {})) {
    if (rdHas(date, room) && !ghostRooms.some(g => g === key(room) || key(room).startsWith(g) || g.startsWith(key(room))))
      warns.push(`[W1] ${date}  ${room}: Rundown has a diagram, Live Map has no overlay`);
  }
}
for (const [date, L] of Object.entries(rd)) {
  if (date < FROM) continue;
  for (const x of L) {
    if (!exists('diagrams/' + x.file)) errors.push(`[E2] ${date}  Rundown links diagrams/${x.file}, file missing`);
    else if (!exists('diagrams/previews/' + x.file.replace(/\.pdf$/i, '.png'))) errors.push(`[E2] ${date}  no preview for ${x.file} (pdftoppm -png -r 110 -singlefile)`);
  }
}
for (const d of DAYS) {
  if (d.iso < FROM) continue;
  for (const r of d.rooms) {
    if (r.t === 'clr') continue;
    const own = [].concat(r.diag || []);
    own.forEach(f => { if (!exists('diagrams/' + f)) errors.push(`[E2] night ${d.iso}  ${r.room}: Housemen links diagrams/${f}, file missing`); });
    if (!own.length && !hsmMatch(d.iso, String(r.room).replace(/\s*\(.*\)$/, ''), r.for))
      warns.push(`[W2] night ${d.iso}  ${r.room} (${r.for}): no diagram anywhere`);
  }
}

console.log(`Diagram audit — Rundown · Live Map · Housemen, from ${FROM}\n`);
if (errors.length) { console.log('ERRORS:'); errors.forEach(e => console.log('  ✗ ' + e)); console.log(); }
if (warns.length) { console.log('ADVISORY:'); warns.forEach(w => console.log('  ⚠ ' + w)); console.log(); }
console.log(errors.length ? `  ✗ ${errors.length} error(s)` : '  ✓ no blocking errors');
process.exit(errors.length ? 1 : 0);
