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

// Off-the-map boxes (lower left) must sit fully inside the map on every date, bottom border included.
// Renders the real page in headless Chrome with the clock set before every date, at a desktop and a phone width.
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('SKIP: off-map fit check needs Chrome'); process.exit(0); }
const probe = `<script>(function(){var R=Date;window.Date=class extends R{constructor(...a){a.length?super(...a):super('2026-01-01T12:00:00Z')}};Date.now=()=>new Date().getTime();})();</script>`;
const measure = `<script>
var out = [], m = document.getElementById('map');
document.querySelectorAll('#chips button').forEach(function (b) {
  b.click(); var r = m.getBoundingClientRect();
  m.querySelectorAll('.offmap .card').forEach(function (c) { var x = c.getBoundingClientRect();
    out.push([b.dataset.d, c.querySelector('.nm').textContent, +(x.bottom - r.bottom).toFixed(1), +(x.right - r.right).toFixed(1)]); });
});
document.body.setAttribute('data-fit', JSON.stringify(out));
</script>`;
const page = html
  .replace(/<link href="https:\/\/fonts[^>]*>/, '')
  .replace(/<script src="theme\.js[^>]*><\/script>/, '')
  .replace('<head>', `<head><base href="file://${path.join(__dirname, '..')}/">` + probe)
  .replace('</body>', measure + '</body>');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'livemap-')), 'fit.html');
fs.writeFileSync(tmp, page);
const allOff = Object.values(DATA.days).reduce((n, d) => n + d.off.length, 0);
for (const size of ['1400,1000', '390,844']) {
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--window-size=${size}`, '--dump-dom', 'file://' + tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const fit = JSON.parse(dom.match(/data-fit="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  assert.equal(fit.length, allOff, `${size}: measured ${fit.length} off-map boxes, expected ${allOff}`);
  for (const [d, room, below, right] of fit) {
    assert(below <= 0, `${size} ${d} ${room}: off-map box runs ${below}px past the map's bottom edge`);
    assert(right <= 0, `${size} ${d} ${room}: off-map box runs ${right}px past the map's right edge`);
  }
}
fs.rmSync(path.dirname(tmp), { recursive: true });
console.log(`PASS: all ${allOff} off-map boxes fit inside the map on every date (desktop and phone width).`);
