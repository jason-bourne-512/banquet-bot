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
for (const room of ['Bluebell', 'bluebell', 'Bluebell A', 'Bluebell AB', 'Bluebell A+B', 'Buttercup', 'buttercup']) {
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
  day('2026-01-07', [card('Blue Group', 'Bluebell'), card('Cam Group', 'Camellia')]) +
  day('2026-01-08', [card('Butter Group', 'Buttercup'), card('Blue Group', 'Bluebell')]);
// ?ts= / ?ss= seed the saved Title / Subtext size; a probe records the computed type sizes (pt) of the first sheet of each kind
const stub = `<script>localStorage.setItem('bb-hsm-who', JSON.stringify({name: 'Jason'}));
(function () { var q = new URLSearchParams(location.search);
  [['ts', 'bb-sign-title-size'], ['ss', 'bb-sign-sub-size']].forEach(function (p) { if (q.get(p[0]) == null) localStorage.removeItem(p[1]); else localStorage.setItem(p[1], q.get(p[0])); });
  setTimeout(function () { var o = {}; [['gt', '.sheet.dir .gt'], ['gr', '.sheet.dir .gr'], ['dt', '.sheet.door .dt'], ['ds', '.sheet.door .ds'], ['dr', '.sheet.door .dr']].forEach(function (p) {
    var e = document.querySelector(p[1]); if (e) o[p[0]] = +(parseFloat(getComputedStyle(e).fontSize) * 0.75 / (e.closest('.sheet').style.getPropertyValue('--k') || 1)).toFixed(2); });
    o.pressed = [].map.call(document.querySelectorAll('.sg-size button[aria-pressed=true]'), function (b) { return b.dataset.k + b.dataset.v; });
    document.documentElement.setAttribute('data-probe', JSON.stringify(o)); }, 1500); })();
window.fetch = function () { return Promise.resolve({text: function () { return Promise.resolve(${JSON.stringify(rundown).replace(/</g, '\\u003c')}); }}); };</script>`;
const page = html
  .replace(/<link href="https:\/\/fonts[^>]*>/, '')
  .replace('<head>', `<head><base href="file://${path.join(__dirname, '..')}/">` + stub);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signs-'));
const tmp = path.join(tmpDir, 'signs.html');
fs.writeFileSync(tmp, page);
const render = (date, ts, ss) => {
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmpDir, 'profile')}`, '--allow-file-access-from-files', '--window-size=1400,1000', '--virtual-time-budget=3000', '--dump-dom', `file://${tmp}?date=${date}${ts ? '&ts=' + ts : ''}${ss ? '&ss=' + ss : ''}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const printed = dom.replace(/<script[\s\S]*?<\/script>/g, ''); // the page's script holds the sheet templates
  const count = re => (printed.match(re) || []).length;
  const probe = JSON.parse(dom.match(/data-probe='([^']*)'|data-probe="([^"]*)"/).slice(1).find(Boolean).replace(/&quot;/g, '"'));
  const res = {doors: count(/class="sheet door"/g), blueDoors: count(/class="dr">Bluebell/g), dirs: count(/class="sheet dir"/g), right: count(/class="arrow r"/g), left: count(/class="arrow l"/g)};
  return Object.assign(res, {probe});
};
const counts = date => { const { probe, ...c } = render(date); return c; };
const countsAt = (date, ts, ss) => { const { probe, ...c } = render(date, ts, ss); return c; };
assert.deepEqual(counts('2026-01-05'), {doors: 0, blueDoors: 0, dirs: 1, right: 1, left: 0}, 'Bluebell: one right-arrow directional, no door sign');
assert.deepEqual(counts('2026-01-06'), {doors: 0, blueDoors: 0, dirs: 1, right: 1, left: 0}, 'Bluebell A: one right-arrow directional, no door sign');
assert.deepEqual(counts('2026-01-07'), {doors: 2, blueDoors: 0, dirs: 2, right: 2, left: 0}, 'Bluebell beside Camellia: Camellia keeps its 2 door signs, Bluebell keeps its own directional');
assert.deepEqual(counts('2026-01-08'), {doors: 0, blueDoors: 0, dirs: 2, right: 2, left: 0}, 'Buttercup + Bluebell: each its own right-arrow directional, no door signs');

// Title / Subtext size controls: default M (100%) keeps today's type; larger steps grow only their own lines.
const def = render('2026-01-07').probe;
assert.deepEqual({gt: def.gt, gr: def.gr, dt: def.dt, ds: def.ds, dr: def.dr}, {gt: 54, gr: 26, dt: 60, ds: undefined, dr: 34}, 'default sizes match the original 54/26/60/34pt (no Door sub line on a Meeting)');
assert.deepEqual(def.pressed.sort(), ['sub100', 'title100'], 'default Title and Subtext are M (100%)');
const big = render('2026-01-07', 120, 140).probe;
assert.ok(Math.abs(big.gt - 54 * 1.2) < 0.01, 'Title L grows the directional title'); assert.ok(Math.abs(big.dt - 60 * 1.2) < 0.01, 'Title L grows the door title');
assert.ok(Math.abs(big.gr - 26 * 1.4) < 0.01, 'Subtext XL grows the directional lines'); assert.ok(Math.abs(big.dr - 34 * 1.4) < 0.01, 'Subtext XL grows the door room name');
assert.deepEqual(big.pressed.sort(), ['sub140', 'title120'], 'saved choices restore as pressed buttons');
const tOnly = render('2026-01-07', 140).probe;
assert.equal(tOnly.gr, 26, 'Title alone leaves the subtext lines alone'); assert.equal(tOnly.dr, 34);
const bad = render('2026-01-07', 'abc', 999).probe;
assert.equal(bad.gt, 54, 'invalid saved Title falls back to 100%'); assert.equal(bad.gr, 26, 'invalid saved Subtext falls back to 100%');
assert.deepEqual(countsAt('2026-01-07', 140, 140), {doors: 2, blueDoors: 0, dirs: 2, right: 2, left: 0}, 'larger size: sheet counts unchanged, still no Bluebell door sign');
assert.deepEqual(countsAt('2026-01-08', 140, 140), {doors: 0, blueDoors: 0, dirs: 2, right: 2, left: 0}, 'larger size: Buttercup + Bluebell still directional only');
assert.deepEqual(countsAt('2026-01-05', 80, 80), {doors: 0, blueDoors: 0, dirs: 1, right: 1, left: 0}, 'smaller size: Bluebell still directional only');
fs.rmSync(tmpDir, { recursive: true });
console.log('PASS: rendered page prints no Bluebell door sign and one right-arrow Bluebell directional; Camellia door signs unchanged.');
console.log('PASS: Title and Subtext size controls default to 100%, scale only their own lines, restore from localStorage and fall back on bad values.');
