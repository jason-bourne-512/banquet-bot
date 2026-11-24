// Captain Report notes checks. No server, browser or network.
// Every event's default note must read differently: no sentence repeats from event to event on one night (Jason 2026-10-28).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Privacy = require('./contact-privacy.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'captain-report.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new Function(script); // syntax check
const src = script.match(/  var CAP = [\s\S]*?\n  function recap\(e, i\) \{[\s\S]*?\n  \}\n/)[0];
const night = iso => new Function('ISO', 'window', src + ';return recap;')(iso, { BBContactPrivacy: Privacy });
const row = (svc, room) => ({time: '', svc, room, count: ''});
// 10/28 as the Rundown has it (services, rooms, contacts)
const oct28 = [
  ['Momentum Skilled Services - Corporate Retreat', 'Morgan', ['Breakfast', 'Continuous Break', 'Lunch Buffet', 'Coffee Break'], 'Verbena'],
  ['Reliant Life Sciences - All Company Meeting - Final Day', 'Whitney', ['Continuous Break', 'Lunch'], 'Plumeria A'],
  ['Galderma - USMAN Team Building & Culture', 'Shelby', ['Breakfast', 'Coffee Break - AM Break', 'Continuous Break', 'Lunch', 'Coffee Break - PM Break'], 'Camellia'],
  ['AUSDW In-House - Dinner', 'Mike', ['Dinner'], 'Bonnell'],
  ['ABB - ABB and AWS Social Event', 'Ray', ['Reception', 'Reception'], 'Barton'],
  ['Bobcat - GME Meeting', 'Steve', ['Continuous Break'], 'Bluebell'],
  ['Werfen - Meeting', 'Brooke', ['Breakfast', 'Coffee Break - AM Coffee Break', 'Lunch Buffet', 'Coffee Break - PM Coffee Break'], 'Primrose AB'],
].map(([name, contact, svcs, room]) => ({name, contact, rows: svcs.map(s => row(s, room))}));
// a busy night of look-alike events; the phrase lists hold 14 each (busiest Rundown night so far is 12)
const busy = Array.from({length: 14}, (_, i) => ({name: 'Group ' + i, contact: 'Sam', rows: [row(i % 2 ? 'Lunch' : 'Breakout - No F&B', 'Room ' + i)]}));
for (const [iso, evs] of [['2026-10-28', oct28], ['2026-11-06', busy], ['2026-12-01', oct28.concat(busy).slice(0, 14)]]) {
  const recap = night(iso), seen = {};
  evs.forEach((e, i) => {
    const note = recap(e, i);
    assert(!/[\u2014\u2013]/.test(note), `${iso} ${e.name}: dash in note`);
    assert(!/\$\d/.test(note), `${iso} ${e.name}: price in note`);
    if (Privacy.shouldHide(e.contact)) assert(!e.contact || !note.includes(e.contact), `${iso} ${e.name}: client contact should stay hidden`);
    else assert(note.includes(e.contact), `${iso} ${e.name}: staff contact missing`);
    if (/final day/i.test(e.name)) assert(/final|last/i.test(note), `${iso} ${e.name}: final day not mentioned`);
    for (const s of note.split(/(?<=\.) (?=[A-Z])/)) { assert(!seen[s], `${iso}: "${s}" repeats on ${e.name}`); seen[s] = 1; }
  });
}
console.log('PASS: captain report parses, every event note on a night is worded differently, client contacts hidden, no dashes or prices.');
