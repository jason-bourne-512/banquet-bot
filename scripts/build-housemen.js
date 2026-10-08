#!/usr/bin/env node
// Drafts Housemen nightly lists from data/rundown.json + rundown.html diagrams.
// Night D sets up for D+1:
//   Set     — room is used tomorrow by a different group, or isn't in use today (full build from the ROOM setup text)
//   Refresh — same group continues tomorrow and the setup doesn't change
//   Clear   — used today, not used tomorrow (clean & clear only; next use noted)
// Order: rooms free at clock-in first (sets, then refreshes, by tomorrow's start), then rooms
// still in use by when they free up, then clears. End times are BEO room holds, never flagged.
// usage: node scripts/build-housemen.js FROM TO   → prints DAYS entries (JS) to stdout
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const rundown = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/rundown.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'rundown.html'), 'utf8');
const [FROM, TO] = process.argv.slice(2);

const STANDARD = ['Vacuum', 'Tray jack + clean tray', 'Pens, pads & candy tray on credenza'];
const NO_STANDARD = /pre-function|foyer|corinne|patio/i;
const base = c => String(c).split(' — ')[0].trim();
const sub = c => String(c).split(' — ').slice(1).join(' — ').replace(/\s*—\s*Final Day$/i, '').trim();
const hm = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const clock = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h < 12 || h === 24 ? 'AM' : 'PM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const label = iso => { const d = new Date(iso + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' }) + ' ' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };
const short = iso => { const d = new Date(iso + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' }) + ' ' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };

// ── diagrams per date from the rundown cards
const $ = cheerio.load(html);
const diagrams = {}; // date -> [{group, label, path}]
$('#rundownList .day-section[data-date]').each((_, sec) => {
  const date = $(sec).attr('data-date');
  $(sec).find('.event-card').each((__, card) => {
    const group = $(card).find('.card-group').first().attr('data-en') || $(card).find('.card-group').first().text();
    $(card).find('.diag-link').each((___, b) => {
      const m = ($(b).attr('onclick') || '').match(/openDiagram\('diagrams\/([^']+)'\s*,\s*'([^']*)'/);
      if (m) (diagrams[date] ||= []).push({ group: base(group.replace(/&amp;/g, '&')), label: m[2].replace(/&amp;/g, '&'), file: m[1] });
    });
  });
});

// ── room usage per day
const roomName = r => String(r || '').trim();
function usage(date) {
  const out = new Map();
  for (const ev of (rundown[date] || {}).events || []) {
    for (const it of ev.items) {
      const r = roomName(it.room); if (!r) continue;
      const u = out.get(r) || { base: base(ev.client), ev, start: Infinity, end: -Infinity };
      if (base(ev.client) !== u.base && hm(it.time) < u.start) { u.base = base(ev.client); u.ev = ev; }
      u.start = Math.min(u.start, hm(it.time));
      u.end = Math.max(u.end, hm(it.endTime || it.time) || hm(it.time));
      u.endStr = u.end === hm(it.endTime || '') ? it.endTime : (u.endStr || it.endTime);
      out.set(r, u);
    }
  }
  for (const u of out.values()) { const h = Math.floor(u.end / 60), m = u.end % 60; u.endStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  return out;
}

// The ROOM text for one room inside a card that may cover several rooms.
function setupFor(ev, room) {
  const rooms = [...new Set(ev.items.map(i => roomName(i.room)))];
  const tokens = String(ev.roomDetail || '').split(/\s+·\s+/).map(t => t.trim()).filter(Boolean)
    .filter(t => !/^room rental/i.test(t));
  const buckets = new Map(); let cur = null;
  for (const t of tokens) {
    const hit = rooms.find(r => t.toLowerCase().startsWith(r.toLowerCase()) || t.toLowerCase().split(/\s*&\s*/).some(p => r.toLowerCase().startsWith(p) && p.length > 3));
    if (hit && (t.length <= hit.length + 2 || /&/.test(t))) {
      cur = t.split(/\s*&\s*/).map(p => rooms.find(r => r.toLowerCase().startsWith(p.toLowerCase())) || p);
      cur.forEach(r => buckets.has(r) || buckets.set(r, []));
      continue;
    }
    if (cur) cur.forEach(r => buckets.get(r).push(t)); else (buckets.get('*') || buckets.set('*', []).get('*')).push(t);
  }
  const own = buckets.get(room) || [];
  const general = buckets.get('*') || [];
  // Split "a, b, c" into lines, but never on a comma inside parentheses.
  const splitTop = t => { const out = []; let depth = 0, cur = '';
    for (const ch of t) { if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out; };
  return (own.length ? own : general).flatMap(splitTop).map(s => s.trim()).filter(Boolean);
}
const isExisting = items => items.some(t => /existing set|refresh/i.test(t));
// The physical setup style (rounds, schoolroom, crescent, U-shape…). Same group + same style = refresh.
const STYLE = /\b(crescent|rounds?|schoolroom|classroom|theat(?:er|re)|u-shape|hollow square|conference|boardroom|lounge|cocktail|reception|highboys?|stage|banquet|existing)\b/gi;
const styleOf = a => new Set((a.join(' ').toLowerCase().match(STYLE) || []).map(w => w.replace(/s$/, '').replace('theatre', 'theater').replace('classroom', 'schoolroom')));
const sameSetup = (tomorrow, today) => { const t = styleOf(tomorrow), d = styleOf(today); return t.size === 0 || t.has('existing') || [...t].every(w => d.has(w)); };

function nextUse(room, after, limit) {
  for (let d = addDays(after, 1); d <= limit; d = addDays(d, 1)) {
    const u = usage(d).get(room);
    if (u) return `${short(d)} → ${u.base}`;
  }
  return `No event on file through ${short(limit).split(' ')[1]}`;
}
function diagFor(date, b, room) {
  const list = (diagrams[date] || []).filter(x => x.group === b);
  const r = room.toLowerCase();
  const exact = list.filter(x => x.label.toLowerCase().startsWith(r) || x.file.toLowerCase().startsWith(r.replace(/\s+/g, '')));
  const files = [...new Set(exact.map(x => x.file))];
  return files.length ? (files.length === 1 ? files[0] : files) : null;
}

const LAST = Object.keys(rundown).sort().slice(-1)[0];
const nights = [];
for (let D = FROM; D <= TO; D = addDays(D, 1)) {
  const T = addDays(D, 1);
  const today = usage(D), tomorrow = usage(T);
  const rooms = [];
  for (const [room, u] of tomorrow) {
    const ev = u.ev, items = setupFor(ev, room);
    const t = today.get(room);
    const rec = { room, for: `${u.base}${sub(ev.client) ? ' · ' + sub(ev.client) : ''}`.slice(0, 70), tStart: u.start };
    if (t) { rec.end = clock(t.endStr); rec.endMin = t.end; }
    const fromReport = /from events report/i.test(ev.note || '');
    const flags = [];
    if (t && t.base === u.base && (isExisting(items) || sameSetup(items, setupFor(t.ev, room)) || !items.length)) {
      rec.t = 'ref';
    } else {
      rec.t = 'set';
      const lines = [];
      if (t && t.base !== u.base) lines.push(`Flip from ${t.base}`);
      else if (t) { lines.push('Setup changes from today'); }
      lines.push(...items.filter(x => !/existing set/i.test(x)));
      if (!items.length) flags.push('No setup on file — check the event order');
      if (!NO_STANDARD.test(room)) lines.push(...STANDARD);
      rec.items = lines;
    }
    if (fromReport && rec.t === 'set') flags.push('From events report — no event order yet');
    const dg = diagFor(T, u.base, room);
    if (dg) rec.diag = dg;
    if (flags.length) rec.flags = flags;
    rooms.push(rec);
  }
  for (const [room, t] of today) {
    if (tomorrow.has(room)) continue;
    rooms.push({ t: 'clr', room, for: `${t.base} finished`, end: clock(t.endStr), endMin: t.end, next: nextUse(room, T, LAST) });
  }
  if (!rooms.length) continue;
  const free = rooms.filter(r => r.t !== 'clr' && r.endMin == null).sort((a, b) => (a.t === b.t ? 0 : a.t === 'set' ? -1 : 1) || a.tStart - b.tStart);
  const busy = rooms.filter(r => r.t !== 'clr' && r.endMin != null).sort((a, b) => a.endMin - b.endMin);
  const clr = rooms.filter(r => r.t === 'clr').sort((a, b) => a.endMin - b.endMin);
  nights.push({ iso: D, target: label(T), crew: '', shift: '', rooms: [...free, ...busy, ...clr] });
}

const js = v => JSON.stringify(v);
const lines = nights.map(n => {
  const rs = n.rooms.map(r => {
    const f = [`t:${js(r.t)}`, `room:${js(r.room)}`, `for:${js(r.for)}`];
    if (r.end) f.push(`end:${js(r.end)}`);
    if (r.diag) f.push(`diag:${js(r.diag)}`);
    if (r.items) f.push(`items:${js(r.items)}`);
    if (r.next) f.push(`next:${js(r.next)}`);
    if (r.flags) f.push(`flags:${js(r.flags)}`);
    return `   {${f.join(', ')}},`;
  }).join('\n');
  return ` { iso:${js(n.iso)}, target:${js(n.target)}, crew:"", shift:"", rooms:[\n${rs}\n ]},`;
});
process.stdout.write(lines.join('\n') + '\n');
process.stderr.write(`nights: ${nights.length} (${nights[0]?.iso} → ${nights[nights.length - 1]?.iso}), rooms: ${nights.reduce((s, n) => s + n.rooms.length, 0)}\n`);
