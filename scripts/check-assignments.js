#!/usr/bin/env node
// Verifies every entry in assignments.json matches a real event + room in
// data/rundown.json (same matching rule the rundown page and Telegram use).
// Exits non-zero on any miss so a typo never silently drops someone's name.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rundown = JSON.parse(fs.readFileSync(path.join(root, 'data/rundown.json'), 'utf8'));
const assign = JSON.parse(fs.readFileSync(path.join(root, 'assignments.json'), 'utf8'));
const norm = s => String(s || '').toLowerCase().trim();
let bad = 0, ok = 0;
for (const [date, list] of Object.entries(assign)) {
  if (date.startsWith('_')) continue;
  const day = rundown[date];
  for (const a of list) {
    const hit = day && day.events.some(e => norm(e.client).includes(norm(a.group)) && e.items.some(i => norm(i.room) === norm(a.room)));
    if (hit) { ok++; continue; }
    bad++;
    console.error(`✗ ${date}: no event matching group "${a.group}" in room "${a.room}"`);
  }
}
console.log(`assignments: ${ok} matched, ${bad} unmatched`);
process.exit(bad ? 1 : 0);
