// Focused source-to-render checks. No server, bot, publishing hook, or network.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'live-map.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'rundown.html'), 'utf8');
function dom(html) {
  const $ = cheerio.load(html);
  const cache = new WeakMap();
  function wrap(el) {
    if (!el) return null;
    if (cache.has(el)) return cache.get(el);
    const w = {
      querySelector: s => wrap($(el).find(s)[0]),
      querySelectorAll: s => $(el).find(s).toArray().map(wrap),
      getAttribute: k => $(el).attr(k),
      cloneNode: () => wrap($(el).clone()[0]),
      replaceWith: text => $(el).replaceWith(text),
      get textContent() { return $(el).text(); },
      set textContent(v) { $(el).text(v); },
      get innerHTML() { return $(el).html(); },
      set innerHTML(v) { $(el).html(v); },
      style: {}, dataset: el.attribs || {}, classList: {toggle() {}},
      addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; },
      clientWidth: 1200, clientHeight: 800, offsetWidth: 1200, offsetHeight: 900,
      scrollWidth: 1200, scrollHeight: 800, scrollLeft: 0, scrollTop: 0
    };
    cache.set(el, w); return w;
  }
  const doc = wrap($.root()[0]);
  doc.getElementById = id => wrap($('#' + id)[0]);
  return doc;
}
(async () => {
  const document = dom(html);
  let fetched = false;
  const context = {document, Intl, Date, console, location: {hash: '#2026-10-27'}, history: {replaceState() {}},
    window: {innerHeight: 1000, addEventListener() {}},
    DOMParser: class { parseFromString(s) { return dom(s); } },
    fetch: async url => { assert.equal(url, 'rundown.html'); fetched = true; return {ok: true, text: async () => source}; }
  };
  let script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  script = script.replace(/\}\)\(\);\s*$/, 'globalThis.check = {RD, buildDay, draw, notesFor, openDet, span};})();');
  vm.runInNewContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  assert(fetched);
  assert.match(document.getElementById('details').textContent, /Assorted Granola Bars/);
  const {check} = context;
  let rooms = 0, rows = 0;
  for (const date of Object.keys(check.RD).filter(d => d >= '2026-10-22' && d <= '2026-11-10')) {
    check.draw(date);
    const text = document.getElementById('details').textContent;
    for (const R of Object.values(check.RD[date])) {
      rooms++;
      for (const r of R.rows) {
        rows++;
        assert(text.includes(r.lbl), `${date} ${R.room}: missing time ${r.lbl}`);
        assert(text.includes(r.gtd), `${date} ${R.room}: missing counts ${r.gtd}`);
        if (!r.nofb) assert(text.includes(r.menu), `${date} ${R.room}: missing menu`);
      }
      for (const c of R.cards) for (const [k, v] of c.foot) {
        assert(text.includes(v.replace(/\n/g, '')), `${date} ${R.room}: missing ${k}`);
      }
    }
  }
  check.draw('2026-10-27');
  const bobcat = check.buildDay('2026-10-27').off.find(e => e.room === 'Bluebell');
  assert(!bobcat.s.some(l => /No F&B/i.test(l.lbl)));
  assert.equal(bobcat.s.length, 2); // Booking hours remain available alongside service.
  for (const item of ['Chips', 'Granola Bars', 'Regular Coffee', 'Teas', 'Pepsi']) assert(bobcat.s.some(l => l.r.menu.includes(item)));
  check.openDet(bobcat);
  assert(document.getElementById('det').open);
  assert.match(document.getElementById('det').textContent, /Pads, Pens and Water/);
  const $ = cheerio.load(source);
  const lenovo = $('.event-card').filter((i, el) => $(el).text().includes('event order 977190')).first();
  assert.deepEqual(lenovo.find('.gtd-pill').toArray().map(el => $(el).text()), ['EXP 100', 'GTD 75 · EXP 100', 'GTD 90 · EXP 100', 'GTD 75 · EXP 100', 'GTD 90 · EXP 100']);
  console.log(`PASS: ${rooms} room/day records, ${rows} rows, all menus/counts/times/footer notes; Bobcat details and Lenovo guarantees.`);
})().catch(e => {console.error(e); process.exitCode = 1;});
