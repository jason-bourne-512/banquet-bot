// Live map content checks. No server, bot, publishing hook, or network.
// The map shows buffet and break names per room only; menus, counts and notes stay on the Rundown.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'live-map.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new Function(script); // syntax check
assert(!/fetch\(/.test(script), 'map must not pull the full rundown');
const DATA = JSON.parse(script.match(/var DATA = (\{.*\});/)[1]);
const rooms = d => [...Object.values(DATA.days[d].ev), ...DATA.days[d].off];
for (const d of ['2026-10-27', '2026-10-28']) {
  const bobcat = DATA.days[d].off.find(e => /Bobcat/.test(e.g));
  assert(!bobcat.s.some(l => l[2] === 'nofb'), `${d} Bobcat still shows No F&B`);
  assert.deepEqual(bobcat.s, [['8–5', 'Continuous Break', 'bev']], `${d} Bobcat should show its one break name only`);
  const galderma = DATA.days[d].ev.Camellia;
  assert(/Galderma/.test(galderma.g));
  assert(!galderma.s.some(l => l[2] === 'nofb'), `${d} Galderma booking row crowds the box`);
  assert(galderma.s.length <= 5, `${d} Galderma has too many lines for Camellia`);
}
for (const d of Object.keys(DATA.days)) for (const e of rooms(d)) for (const l of e.s) {
  assert.equal(l.length, 3, `${d} ${e.g}: bad line`);
  assert(!/\$\d/.test(l[1]), `${d} ${e.g}: price on the map`);
}
console.log('PASS: live map script parses, no rundown fetch, Bobcat Continuous Break, Galderma fits, no prices.');
