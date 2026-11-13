#!/usr/bin/env node
/*
 * audit-live-map.js — pre-flight checker for live-map.html
 *
 * Catches the failure modes that have shipped silently before:
 *   E1 invisible room   — an ev room whose name resolves to no box (renders as nothing)
 *   E2 broken image     — a ghost/bg image path that doesn't exist on disk
 *   E3 bad service code  — a service row type not in the known legend
 *   E4 past day present  — a day before today still in DATA (hard rule: prune past days)
 *   E5 phone / last name — a contact or text that looks like a phone # or full name
 *   W1 no diagram overlay — an on-map room whose box no ghost covers (lists candidate
 *                           diagram files so you can decide: wire one, or confirm none exists)
 *
 * Exit code is non-zero if any Eâ€‘level error is found (W1 is advisory, never fails).
 * Run from the repo root:  node scripts/audit-live-map.js  [--day YYYY-MM-DD]
 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'live-map.html'), 'utf8');
const DATA = JSON.parse(html.match(/var DATA = (\{[\s\S]*?\});\n/)[1]);
const BOX = DATA.box;
const LEGEND = new Set(['bfast', 'lunch', 'dinner', 'recep', 'brk', 'bev', 'nofb']);

// same resolver the page uses (keep in sync with live-map.html boxFor)
function boxFor(r) {
  if (BOX[r]) return BOX[r];
  const m = /^(.+?) ([A-Z]+)$/.exec(r);
  if (m && m[2].length > 1) {
    let out = null;
    for (const L of m[2]) { const p = BOX[m[1] + ' ' + L]; if (!p) return null;
      out = out ? [Math.min(out[0], p[0]), Math.min(out[1], p[1]), Math.max(out[2], p[2]), Math.max(out[3], p[3])] : p.slice(); }
    return out;
  }
  return null;
}
function area(b) { return (b[2] - b[0]) * (b[3] - b[1]); }
function overlap(a, b) {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return w * h;
}
// Fixed boardrooms: a permanent table-and-chairs set, never reconfigured, so they
// will NEVER have a setup diagram (Jason 2026-11-12). Not a gap — suppress W1 for them.
const NO_DIAGRAM = new Set(['Buttercup', 'Bluebell']);

// candidate diagram files for a room (advisory): previews whose name contains the room's base word
const previews = fs.existsSync(path.join(ROOT, 'diagrams/previews'))
  ? fs.readdirSync(path.join(ROOT, 'diagrams/previews')) : [];
// Candidate diagrams for a room, preferring files from the SAME booking client.
// `group` is the room's ev.g string (e.g. "Natera LDP · Breakout"); its leading
// words give the client token we match against the "...fromCLIENT.png" filename.
function candidates(room, group) {
  const base = room.split(' ')[0].toUpperCase();
  const byRoom = previews.filter(f => f.toUpperCase().includes(base));
  const client = (group || '').split('·')[0].replace(/[^A-Za-z]/g, '').toUpperCase();
  const clientKey = client.slice(0, 6); // first 6 letters, enough to disambiguate clients
  const fromClient = clientKey ? byRoom.filter(f => f.toUpperCase().replace(/[^A-Z]/g, '').includes(clientKey)) : [];
  if (fromClient.length) return { list: fromClient.slice(0, 4), client: null };
  return { list: [], client: group ? group.split('·')[0].trim() : null, any: byRoom.length };
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const only = (process.argv.includes('--day')) ? process.argv[process.argv.indexOf('--day') + 1] : null;

const errors = [], warns = [];
const E = (code, day, msg) => errors.push(`  ✗ [${code}] ${day}  ${msg}`);
const W = (code, day, msg) => warns.push(`  ⚠ [${code}] ${day}  ${msg}`);
const PHONE = /\b\d{3}[\s.\-]?\d{3}[\s.\-]?\d{4}\b|\b\d{3}[\s.\-]\d{4}\b/;

for (const day of Object.keys(DATA.days).sort()) {
  if (only && day !== only) continue;
  if (day.slice(0, 10) < today) { W('E4', day, 'day is before today — should be pruned'); }
  const d = DATA.days[day];
  const ghosts = (d.ghosts || []).map(g => ({ box: [g[0], g[1], g[2], g[3]], img: g[4] }));

  // ev rooms
  for (const room of Object.keys(d.ev || {})) {
    const b = boxFor(room);
    if (!b) { E('E1', day, `on-map room "${room}" resolves to no box — it renders as NOTHING`); continue; }
    for (const row of d.ev[room].s || []) if (!LEGEND.has(row[2])) E('E3', day, `room "${room}" service "${row[1]}" has unknown type "${row[2]}"`);
    // diagram coverage: is this room's box covered by any wired ghost?
    const covered = ghosts.some(g => overlap(b, g.box) >= 0.55 * area(b));
    if (!covered && !NO_DIAGRAM.has(room)) {
      const c = candidates(room, d.ev[room].g);
      const note = c.list.length
        ? `wire one of: ${c.list.join(', ')}`
        : (c.client ? `no diagram from "${c.client}" on file (gap — pending Social Tables, or confirm none)` : 'no diagram on record');
      W('W1', day, `room "${room}" has NO diagram overlay — ${note}`);
    }
  }
  // off rooms (always render; just check codes + bg image)
  for (const o of d.off || []) {
    for (const row of o.s || []) if (!LEGEND.has(row[2])) E('E3', day, `off-map "${o.room}" service "${row[1]}" has unknown type "${row[2]}"`);
    if (o.bg && !fs.existsSync(path.join(ROOT, o.bg[0]))) E('E2', day, `off-map "${o.room}" bg image missing: ${o.bg[0]}`);
  }
  // ghost images exist
  for (const g of ghosts) if (!fs.existsSync(path.join(ROOT, g.img))) E('E2', day, `ghost image missing: ${g.img}`);
  // phone / full-name scan on contacts
  for (const c of d.contacts || []) {
    if (PHONE.test(c.join(' '))) E('E5', day, `contact looks like a phone number: ${c.join(' ')}`);
    if (/\s\S+\s\S/.test((c[1] || '').trim())) W('E5', day, `contact "${c[1]}" may contain a last name (first-name-only rule)`);
  }
}

const label = only ? `day ${only}` : `${Object.keys(DATA.days).length} days (today = ${today})`;
console.log(`\nLive Map audit — ${label}\n`);
if (errors.length) { console.log('ERRORS:'); errors.forEach(e => console.log(e)); console.log(''); }
if (warns.length) { console.log('ADVISORY:'); warns.forEach(w => console.log(w)); console.log(''); }
if (!errors.length && !warns.length) console.log('  ✓ clean — no errors, full diagram coverage\n');
else if (!errors.length) console.log('  ✓ no blocking errors (advisories above are judgment calls)\n');
process.exit(errors.length ? 1 : 0);
