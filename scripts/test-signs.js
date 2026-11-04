// Print Signs checks. No server, bot, publishing hook, or network.
// Bluebell never needs a door sign, only its own directional with a right arrow (Jason 2026-11-03).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const html = fs.readFileSync(path.join(__dirname, '..', 'signs.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new Function(script); // syntax check
const src = script.match(/  var ROOM_RE = [\s\S]*?\n  function parseRoom\(r\) \{[\s\S]*?\n  \}\n/)[0];
const parseRoom = new Function(src + ';return parseRoom;')();
for (const room of ['Bluebell', 'bluebell', 'Bluebell A', 'Bluebell AB', 'Bluebell A+B']) {
  const r = parseRoom(room);
  assert.equal(r.doors, 0, `${room}: should get no door sign`);
  assert.equal(r.dir, 'R', `${room}: arrow should point right`);
}
assert.equal(parseRoom('Camellia').doors, 2, 'Camellia full room should keep 2 door signs');
console.log('PASS: signs page parses, Bluebell in any section gets 0 door signs and a right arrow.');

// Renders the real page in headless Chrome against a small Rundown, then counts the printed sheets.
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('SKIP: rendered sign check needs Chrome'); process.exit(0); }
const card = (group, room) => `<div class="event-card"><div class="card-group">${group}</div><div class="svc-row"><div class="svc-top"><span class="tag">Meeting</span><span class="room-pill">${room}</span></div></div></div>`;
const day = (date, cards) => `<div class="day-section" data-date="${date}">${cards.join('')}</div>`;
const rundown = day('2026-01-05', [card('Blue Group', 'Bluebell')]) +
  day('2026-01-06', [card('Blue Section', 'Bluebell A')]) +
  day('2026-01-07', [card('Blue Group', 'Bluebell'), card('Cam Group', 'Camellia')]);
const stub = `<script>localStorage.setItem('bb-hsm-who', JSON.stringify({name: 'Jason'}));
window.fetch = function () { return Promise.resolve({text: function () { return Promise.resolve(${JSON.stringify(rundown).replace(/</g, '\\u003c')}); }}); };</script>`;
const page = html
  .replace(/<link href="https:\/\/fonts[^>]*>/, '')
  .replace('<head>', `<head><base href="file://${path.join(__dirname, '..')}/">` + stub);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signs-'));
const tmp = path.join(tmpDir, 'signs.html');
fs.writeFileSync(tmp, page);
const render = date => {
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmpDir, 'profile')}`, '--allow-file-access-from-files', '--window-size=1400,1000', '--virtual-time-budget=3000', '--dump-dom', `file://${tmp}?date=${date}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const printed = dom.replace(/<script[\s\S]*?<\/script>/g, ''); // the page's script holds the sheet templates
  const count = re => (printed.match(re) || []).length;
  return {doors: count(/class="sheet door"/g), blueDoors: count(/class="dr">Bluebell/g), dirs: count(/class="sheet dir"/g), right: count(/class="arrow r"/g), left: count(/class="arrow l"/g)};
};
assert.deepEqual(render('2026-01-05'), {doors: 0, blueDoors: 0, dirs: 1, right: 1, left: 0}, 'Bluebell: one right-arrow directional, no door sign');
assert.deepEqual(render('2026-01-06'), {doors: 0, blueDoors: 0, dirs: 1, right: 1, left: 0}, 'Bluebell A: one right-arrow directional, no door sign');
assert.deepEqual(render('2026-01-07'), {doors: 2, blueDoors: 0, dirs: 2, right: 2, left: 0}, 'Bluebell beside Camellia: Camellia keeps its 2 door signs, Bluebell keeps its own directional');
fs.rmSync(tmpDir, { recursive: true });
console.log('PASS: rendered page prints no Bluebell door sign and one right-arrow Bluebell directional; Camellia door signs unchanged.');
