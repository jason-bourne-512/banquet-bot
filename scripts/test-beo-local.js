// BEO tab, Mac-only: local notes/highlights store, the local server API, and the desktop.js localhost gate.
// No browser, no Firebase. The server is started on a throwaway port with a temp state file.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const Notes = require("./notes-lib.js");
const Store = require("./beo-local-store.js");
const { createServer } = require("./serve-beo-beta.js");

const root = path.join(__dirname, "..");
const eoRec = {eo: 339574, printed: "2026-11-16", versions: [{printed: "2026-11-11", source: "a.pdf"}, {printed: "2026-11-16", source: "b.pdf"}]};
const ident = Notes.beoIdentity("2026-11-18", eoRec);
const box = {page: 0, slot: 1, x: 10, y: 10, w: 40, h: 10};

function memStorage() {
  return {data: Object.create(null),
    getItem(k) { return k in this.data ? this.data[k] : null; },
    setItem(k, v) { this.data[k] = String(v); },
    removeItem(k) { delete this.data[k]; }};
}

function req(port, method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : (typeof body === "string" ? body : JSON.stringify(body));
    const h = Object.assign({}, data != null ? {"Content-Type": "application/json"} : {}, headers || {});
    const r = http.request({host: "127.0.0.1", port, method, path: url, headers: h}, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({status: res.statusCode, text: Buffer.concat(chunks).toString("utf8")}));
    });
    r.on("error", reject);
    if (data != null) r.write(data);
    r.end();
  });
}
const json = (r) => JSON.parse(r.text);

(async function () {
  // ---- pure store: notes ----
  let st = Store.emptyState();
  const n1 = Store.addNote(st, Object.assign({text: "  Bar opens at 5 ", createdAt: "2026-11-18T10:00:00.000Z"}, ident));
  assert.equal(n1.item.text, "Bar opens at 5");
  assert.equal(st.notes.length, 0, "ops never mutate their input");
  st = n1.state;
  st = Store.addNote(st, Object.assign({text: "Other day"}, ident, {date: "2026-11-19"})).state;
  assert.throws(() => Store.addNote(st, Object.assign({text: "x"}, ident, {eo: "ABC"})), /BEO/);
  assert.throws(() => Store.addNote(st, Object.assign({text: "   "}, ident)));
  assert.equal(Store.forDate(st, "2026-11-18").notes.length, 1);
  st = Store.deleteNote(st, n1.item.id).state;
  assert.equal(st.notes.length, 1, "delete removes just that note");

  // ---- pure store: highlights, slots, tap-to-remove ----
  let hs = Store.emptyState();
  const h1 = Store.addHighlight(hs, Object.assign({}, ident, box));
  hs = h1.state;
  assert.equal(h1.item.slot, 1);
  const h2 = Store.addHighlight(hs, Object.assign({}, ident, box));
  assert.equal(h2.item.slot, 2, "a taken slot moves to the next free one");
  hs = h2.state;
  assert.equal(Notes.highlightsFor(hs.highlights, ident, 0).length, 2);
  assert.equal(Notes.highlightsFor(hs.highlights, ident, 1).length, 0, "other pages are separate");
  assert.throws(() => Store.addHighlight(hs, Object.assign({}, ident, box, {w: 0.1, h: 0.1})), /small/);
  for (let i = 0; i < Notes.MAX_HIGHLIGHTS - 2; i++) hs = Store.addHighlight(hs, Object.assign({}, ident, box)).state;
  assert.equal(Notes.highlightsFor(hs.highlights, ident, 0).length, Notes.MAX_HIGHLIGHTS);
  assert.throws(() => Store.addHighlight(hs, Object.assign({}, ident, box)), /Too many/, "slot cap per page");
  assert.equal(Store.addHighlight(hs, Object.assign({}, ident, box, {page: 1})).item.page, 1, "cap is per page");
  hs = Store.deleteHighlight(hs, h1.item.id).state;
  assert.equal(Notes.highlightsFor(hs.highlights, ident, 0).length, Notes.MAX_HIGHLIGHTS - 1, "tap removes one highlight");
  assert.equal(Notes.highlightFromDrag(140, 250, 300, 300, {left: 100, top: 200, width: 800, height: 1000}).w, 20, "drag geometry still percent of the page");
  assert.equal(Notes.removeHighlight([{id: "a"}, {id: "b"}], "a").length, 1);

  // ---- validation: shape and size ----
  assert.throws(() => Store.validateState(null), /Bad/);
  assert.throws(() => Store.validateState([]), /Bad/);
  assert.throws(() => Store.validateState({notes: "x"}), /Bad/);
  assert.throws(() => Store.validateState({notes: new Array(5000).fill({})}), /large/);
  assert.deepEqual(Store.validateState({notes: [{id: "../x", text: "hi"}, {id: "ok", date: "bad"}], highlights: [{id: "h"}]}), Store.emptyState(), "bad rows are dropped");
  const ok = Store.validateState({notes: [Object.assign({id: "n1", at: "2026-11-18T10:00:00.000Z"}, Store.addNote(Store.emptyState(), Object.assign({text: "a"}, ident)).item)]});
  assert.equal(ok.notes.length, 1);

  // ---- localStorage fallback (no server) ----
  const ls = memStorage();
  const down = Store.createStore({storage: ls});
  assert.equal(await down.ready(), "local");
  const ln = await down.addNote(Object.assign({text: "saved in browser"}, ident));
  const lh = await down.addHighlight(Object.assign({}, ident, box));
  assert.ok(ls.getItem("bb-beo-local-v1"), "uses bb-beo-local-v1");
  const again = Store.createStore({storage: ls});
  assert.equal((await again.listNotes("2026-11-18")).length, 1, "a reload in the same browser keeps notes");
  assert.equal((await again.listHighlights("2026-11-18")).length, 1);
  await again.deleteNote(ln.id); await again.deleteHighlight(lh.id);
  assert.equal((await again.listNotes("2026-11-18")).length, 0);
  assert.equal(Store.createStore({storage: ls}).mode(), "local");

  // ---- legacy bb-beo-notes-v1 notes ----
  const old = memStorage();
  old.setItem("bb-beo-notes-v1", JSON.stringify({"2026-11-18|339574": [{at: "2026-11-17T09:00:00.000Z", text: "old note"}], "2026-11-18|1": [{at: "x", text: "no such eo"}]}));
  const mig = Store.legacyNotes(old, {days: {"2026-11-18": [eoRec]}});
  assert.equal(mig.length, 1);
  assert.equal(mig[0].text, "old note");
  assert.equal(mig[0].printed, "2026-11-16");
  assert.equal(old.getItem("bb-beo-notes-v1") !== null, true, "legacy key is never deleted by the helper");

  // Two migration attempts must not duplicate notes, even when an older note is outside the index window.
  const idx = {days: {"2026-11-18": [eoRec]}};
  const mst = memStorage(), mstore = Store.createStore({storage: mst});
  old.setItem("bb-beo-notes-v1", JSON.stringify({"2026-11-18|339574": [{at: "2026-11-17T09:00:00.000Z", text: "old note"}], "2026-11-01|9": [{at: "x", text: "outside window"}]}));
  async function migrateOnce() {
    const items = Store.legacyItems(old, idx), saved = [];
    for (const it of items) { await mstore.addNote(it.input); saved.push(it); }
    Store.legacySettle(old, saved);
  }
  await migrateOnce(); await migrateOnce();
  assert.equal((await mstore.listNotes("2026-11-18")).length, 1, "migrated note is not duplicated by a second attempt");
  assert.deepEqual(JSON.parse(old.getItem("bb-beo-notes-v1")), {"2026-11-01|9": [{at: "x", text: "outside window"}]}, "only the unmigrated note stays under the old key");
  Store.legacySettle(old, []);
  assert.ok(old.getItem("bb-beo-notes-v1"), "nothing saved, nothing removed");
  old.setItem("bb-beo-notes-v1", JSON.stringify({"2026-11-18|339574": [{at: "a", text: "only"}]}));
  Store.legacySettle(old, Store.legacyItems(old, idx));
  assert.equal(old.getItem("bb-beo-notes-v1"), null, "key removed once every note moved");

  // First legacy note saves, the second stalls: settling per note means a reload does not add the first again.
  const st2 = memStorage(), store2 = Store.createStore({storage: st2}), old2 = memStorage();
  old2.setItem("bb-beo-notes-v1", JSON.stringify({"2026-11-18|339574": [{at: "2026-11-17T09:00:00.000Z", text: "first"}, {at: "2026-11-17T09:05:00.000Z", text: "second"}]}));
  async function migrateStall(failSecond) {
    for (const it of Store.legacyItems(old2, idx)) {
      try {
        if (failSecond && it.input.text === "second") throw new Error("stalled");
        await store2.addNote(it.input);
        Store.legacySettle(old2, [it]);
      } catch (e) {}
    }
  }
  await migrateStall(true);
  assert.deepEqual(JSON.parse(old2.getItem("bb-beo-notes-v1"))["2026-11-18|339574"].map((n) => n.text), ["second"], "saved note leaves the old key at once");
  await migrateStall(false);
  const got2 = (await store2.listNotes("2026-11-18")).map((n) => n.text).sort();
  assert.deepEqual(got2, ["first", "second"], "first note appears only once after the retry");
  assert.equal(old2.getItem("bb-beo-notes-v1"), null);
  // Even if the settle was lost, the stable id keeps a retry from adding a second copy.
  old2.setItem("bb-beo-notes-v1", JSON.stringify({"2026-11-18|339574": [{at: "2026-11-17T09:00:00.000Z", text: "first"}]}));
  await migrateStall(false);
  assert.equal((await store2.listNotes("2026-11-18")).length, 2, "same legacy id is not inserted twice");

  // Two notes with the same key and timestamp whose old short hash collided ("B`" and "CA"): each keeps its own id and settling one keeps the other.
  const old3 = memStorage(), at3 = "2026-11-17T09:00:00.000Z", key3 = "2026-11-18|339574";
  old3.setItem("bb-beo-notes-v1", JSON.stringify({[key3]: [{at: at3, text: "B`"}, {at: at3, text: "CA"}]}));
  const items3 = Store.legacyItems(old3, idx);
  assert.equal(items3.length, 2);
  assert.notEqual(items3[0].id, items3[1].id, "colliding-hash texts get distinct ids");
  assert.ok(Store.idOk(items3[0].id) && Store.idOk(items3[1].id), "ids stay valid");
  Store.legacySettle(old3, [items3[0]]);
  assert.deepEqual(JSON.parse(old3.getItem("bb-beo-notes-v1"))[key3].map((n) => n.text), ["CA"], "settling the first leaves the second");
  // Mid-batch stall then reload: the second stalls, a reload still has it and saves both once.
  const old4 = memStorage(), store4 = Store.createStore({storage: memStorage()});
  old4.setItem("bb-beo-notes-v1", JSON.stringify({[key3]: [{at: at3, text: "B`"}, {at: at3, text: "CA"}]}));
  for (const it of Store.legacyItems(old4, idx)) {
    try { if (it.input.text === "CA") throw new Error("stalled"); await store4.addNote(it.input); Store.legacySettle(old4, [it]); } catch (e) {}
  }
  assert.deepEqual(JSON.parse(old4.getItem("bb-beo-notes-v1"))[key3].map((n) => n.text), ["CA"], "stalled note survives the reload");
  for (const it of Store.legacyItems(old4, idx)) { await store4.addNote(it.input); Store.legacySettle(old4, [it]); }
  assert.deepEqual((await store4.listNotes("2026-11-18")).map((n) => n.text).sort(), ["B`", "CA"], "both notes saved exactly once");
  assert.equal(old4.getItem("bb-beo-notes-v1"), null);

  // ---- server ----
  const tmp =fs.mkdtempSync(path.join(os.tmpdir(), "beo-srv-"));
  fs.mkdirSync(path.join(tmp, "beo-originals"));
  fs.mkdirSync(path.join(tmp, "node_modules"));
  fs.mkdirSync(path.join(tmp, ".git"));
  fs.mkdirSync(path.join(tmp, "data"));
  fs.writeFileSync(path.join(tmp, "beo-originals", "p.png"), "png");
  fs.writeFileSync(path.join(tmp, "node_modules", "x.js"), "x");
  fs.writeFileSync(path.join(tmp, ".git", "config"), "secret");
  fs.writeFileSync(path.join(tmp, "data", "r.json"), "{}");
  fs.writeFileSync(path.join(tmp, "page.html"), "<p>hi</p>");
  fs.writeFileSync(path.join(tmp, "firebase-config.js"), "k");
  fs.writeFileSync(path.join(path.dirname(tmp), path.basename(tmp) + "-outside.txt"), "outside");
  const stateFile = path.join(tmp, "beo-local-state.json");
  const srv = createServer({root: tmp, stateFile: stateFile, port: 0});
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  srv.close(); // port is only known now; restart with the real one so the Host check matches
  const real = createServer({root: tmp, stateFile: stateFile, port: port});
  await new Promise((r) => real.listen(port, "127.0.0.1", r));
  assert.equal(real.address().address, "127.0.0.1", "binds 127.0.0.1 only");

  assert.equal((await req(port, "GET", "/page.html")).status, 200);
  assert.equal((await req(port, "GET", "/beo-originals/p.png")).text, "png");
  for (const bad of ["/.git/config", "/node_modules/x.js", "/data/r.json", "/beo-local-state.json", "/firebase-config.js", "/%2e%2e/" + path.basename(tmp) + "-outside.txt", "/..%2f" + path.basename(tmp) + "-outside.txt", "/beo-originals/..%2f..%2fetc/passwd"]) {
    const r = await req(port, "GET", bad);
    assert.ok(r.status === 403 || r.status === 404, bad + " refused, got " + r.status);
    assert.doesNotMatch(r.text, /secret|outside/);
  }
  assert.equal((await req(port, "GET", "/%zz")).status, 400);

  // case-insensitive deny list (macOS file system is case-insensitive)
  fs.writeFileSync(path.join(tmp, "beo-local-state.json"), "PRIVATE-STATE");
  for (const bad of ["/BEO-LOCAL-STATE.JSON", "/Beo-Local-State.json", "/FIREBASE-CONFIG.JS", "/.GIT/config", "/Node_Modules/x.js", "/DATA/r.json", "/%2eGIT/config"]) {
    const r = await req(port, "GET", bad);
    assert.ok(r.status === 403 || r.status === 404, bad + " refused, got " + r.status);
    assert.doesNotMatch(r.text, /PRIVATE-STATE|secret/);
  }
  fs.rmSync(path.join(tmp, "beo-local-state.json"));
  // symlinks cannot escape the root or reach private files
  fs.symlinkSync(path.join(path.dirname(tmp), path.basename(tmp) + "-outside.txt"), path.join(tmp, "escape.txt"));
  fs.symlinkSync(path.join(tmp, "firebase-config.js"), path.join(tmp, "cfg.txt"));
  fs.symlinkSync(path.join(tmp, ".git"), path.join(tmp, "gitlink"));
  fs.symlinkSync(path.dirname(tmp), path.join(tmp, "up"));
  for (const bad of ["/escape.txt", "/cfg.txt", "/gitlink/config", "/up/" + path.basename(tmp) + "-outside.txt"]) {
    const r = await req(port, "GET", bad);
    assert.equal(r.status, 403, bad + " refused, got " + r.status);
    assert.doesNotMatch(r.text, /secret|outside|^k$/);
  }
  // Host check covers static files too (DNS rebinding)
  assert.equal((await req(port, "GET", "/page.html", null, {Host: "evil.example"})).status, 403, "static: wrong Host refused");
  assert.equal((await req(port, "GET", "/beo-originals/p.png", null, {Host: "evil.example:" + port})).status, 403, "originals: wrong Host refused");
  assert.equal((await req(port, "GET", "/page.html", null, {Host: "localhost:" + port})).status, 200);
  assert.equal((await req(port, "GET", "/page.html", null, {Host: "127.0.0.1"})).status, 403, "Host must carry the port");

  let r = await req(port, "GET", "/api/beo/state");
  assert.deepEqual(json(r), Store.emptyState(), "empty to start, no file yet");
  assert.equal(fs.existsSync(stateFile), false);
  r = await req(port, "POST", "/api/beo/notes", Object.assign({text: "Bar opens at 5"}, ident));
  assert.equal(r.status, 200);
  const noteId = json(r).item.id;
  assert.ok(fs.existsSync(stateFile), "persisted to the JSON file");
  assert.equal(fs.readdirSync(tmp).filter((f) => /tmp-/.test(f)).length, 0, "temp file renamed away (atomic write)");
  assert.equal(JSON.parse(fs.readFileSync(stateFile, "utf8")).notes.length, 1);
  r = await req(port, "POST", "/api/beo/highlights", Object.assign({}, ident, box));
  assert.equal(r.status, 200);
  const hlId = json(r).item.id;
  // a second server on the same file (a restart, or another browser) sees the same data
  r = await req(port, "GET", "/api/beo/state");
  assert.equal(json(r).notes.length, 1);
  assert.equal(json(r).highlights.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, "utf8")).highlights[0].id, hlId);

  assert.equal((await req(port, "POST", "/api/beo/notes", Object.assign({text: ""}, ident))).status, 400, "bad note rejected");
  assert.equal((await req(port, "POST", "/api/beo/notes", "{nope")).status, 400, "bad JSON rejected");
  assert.equal((await req(port, "POST", "/api/beo/notes", "[]")).status, 400);
  assert.equal((await req(port, "POST", "/api/beo/highlights", Object.assign({}, ident, box, {w: 0, h: 0}))).status, 400);
  assert.equal((await req(port, "POST", "/api/beo/notes", "x", {"Content-Type": "text/plain"})).status, 415, "JSON content type required");
  assert.equal((await req(port, "POST", "/api/beo/import", "x".repeat(Store.MAX_BYTES + 100000))).status, 413, "oversize body rejected");
  assert.equal((await req(port, "DELETE", "/api/beo/notes/..%2f..%2fx")).status, 404, "traversal in an id never reaches a handler");
  assert.equal((await req(port, "DELETE", "/api/beo/notes/a%20b")).status, 400, "bad id rejected");
  assert.equal((await req(port, "GET", "/api/beo/nope")).status, 404);
  assert.equal((await req(port, "PUT", "/api/beo/state", {})).status, 405);
  assert.equal((await req(port, "GET", "/api/beo/state", null, {Host: "evil.example"})).status, 403, "wrong Host refused");
  assert.equal((await req(port, "POST", "/api/beo/notes", Object.assign({text: "x"}, ident), {Origin: "https://evil.example"})).status, 403, "cross-site origin refused");
  assert.equal((await req(port, "POST", "/api/beo/notes", Object.assign({text: "x"}, ident), {Origin: "http://127.0.0.1:" + port})).status, 200);
  assert.equal(json(await req(port, "GET", "/api/beo/state")).notes.length, 2);

  // the page's store, talking to the server through real HTTP
  const viaFetch = (url, o) => new Promise((resolve, reject) => {
    const rq = http.request({host: "127.0.0.1", port: port, method: o.method, path: url, headers: o.headers}, (res) => {
      const c = []; res.on("data", (d) => c.push(d));
      res.on("end", () => { const t = Buffer.concat(c).toString("utf8"); resolve({ok: res.statusCode < 400, status: res.statusCode, json: () => Promise.resolve(JSON.parse(t))}); });
    });
    rq.on("error", reject); if (o.body) rq.write(o.body); rq.end();
  });
  const lsSrv = memStorage();
  lsSrv.setItem("bb-beo-local-v1", JSON.stringify(Store.addNote(Store.emptyState(), Object.assign({text: "saved while server was down"}, ident)).state));
  const live = Store.createStore({fetch: viaFetch, storage: lsSrv});
  assert.equal(await live.ready(), "server");
  const dayNotes = await live.listNotes("2026-11-18");
  assert.ok(dayNotes.some((n) => n.text === "saved while server was down"), "browser-only notes merge into the file");
  assert.equal(lsSrv.getItem("bb-beo-local-v1"), null, "browser copy cleared after merge");
  await live.deleteNote(noteId);
  assert.ok(!(await live.listNotes("2026-11-18")).some((n) => n.id === noteId));
  await live.deleteHighlight(hlId);
  assert.equal((await live.listHighlights("2026-11-18")).length, 0);
  assert.equal((await req(port, "DELETE", "/api/beo/notes/" + noteId)).status, 200, "deleting twice is fine");

  // deletes made while the server is down are replayed on reconnect (tombstones)
  const tsrv = memStorage();
  const sn = json(await req(port, "POST", "/api/beo/notes", Object.assign({text: "keep until deleted offline"}, ident))).item;
  const sh = json(await req(port, "POST", "/api/beo/highlights", Object.assign({}, ident, box))).item;
  const failFetch = () => Promise.reject(new TypeError("fetch failed"));
  let up = true;
  const flaky = (url, o) => up ? viaFetch(url, o) : failFetch();
  const t1 = Store.createStore({fetch: flaky, storage: tsrv});
  assert.equal(await t1.ready(), "server");
  up = false;
  await t1.deleteNote(sn.id); await t1.deleteHighlight(sh.id);
  assert.equal(t1.mode(), "local", "dropped to local when server went down");
  assert.ok(tsrv.getItem("bb-beo-local-v1-deleted"), "tombstones recorded");
  assert.ok(!(await t1.listNotes("2026-11-18")).some((n) => n.id === sn.id), "hidden while down");
  // reload while the server is still down: still hidden
  const t2 = Store.createStore({fetch: flaky, storage: tsrv});
  assert.equal(await t2.ready(), "local");
  assert.ok(!(await t2.listNotes("2026-11-18")).some((n) => n.id === sn.id));
  assert.ok(!(await t2.listHighlights("2026-11-18")).some((h) => h.id === sh.id));
  assert.ok(json(await req(port, "GET", "/api/beo/state")).notes.some((n) => n.id === sn.id), "server still has it until replay");
  // server back: replay, then gone from the server for good
  up = true;
  const t3 = Store.createStore({fetch: flaky, storage: tsrv});
  assert.equal(await t3.ready(), "server");
  assert.ok(!(await t3.listNotes("2026-11-18")).some((n) => n.id === sn.id), "note does not come back after reload");
  assert.ok(!(await t3.listHighlights("2026-11-18")).some((h) => h.id === sh.id), "highlight does not come back after reload");
  const after = json(await req(port, "GET", "/api/beo/state"));
  assert.ok(!after.notes.some((n) => n.id === sn.id) && !after.highlights.some((h) => h.id === sh.id), "server copy deleted by replay");
  assert.equal(tsrv.getItem("bb-beo-local-v1-deleted"), null, "tombstones cleared after replay");
  // tombstone stays if the server is only half back (replay fails on network error)
  up = false;
  const t4 = Store.createStore({fetch: flaky, storage: tsrv});
  await t4.ready();
  const extra = await t4.addNote(Object.assign({text: "x"}, ident));
  await t4.deleteNote(extra.id);
  assert.ok(JSON.parse(tsrv.getItem("bb-beo-local-v1-deleted")).notes.indexOf(extra.id) > -1, "pending deletion kept while down");

  // replay: a 500 keeps the tombstone (and the item stays hidden), a 404 clears it
  const tn = json(await req(port, "POST", "/api/beo/notes", Object.assign({text: "replay status"}, ident))).item;
  const th = json(await req(port, "POST", "/api/beo/highlights", Object.assign({}, ident, box))).item;
  tsrv.removeItem("bb-beo-local-v1-deleted");
  tsrv.setItem("bb-beo-local-v1-deleted", JSON.stringify({notes: [tn.id], highlights: [th.id]}));
  let delStatus = 500;
  const statusFetch = (url, o) => (o && o.method === "DELETE")
    ? Promise.resolve({ok: false, status: delStatus, json: () => Promise.resolve({error: "x"})})
    : viaFetch(url, o);
  const t5 = Store.createStore({fetch: statusFetch, storage: tsrv});
  assert.equal(await t5.ready(), "server");
  const kept = JSON.parse(tsrv.getItem("bb-beo-local-v1-deleted"));
  assert.ok(kept.notes.indexOf(tn.id) > -1 && kept.highlights.indexOf(th.id) > -1, "500 keeps the tombstones");
  assert.ok(!(await t5.listNotes("2026-11-18")).some((n) => n.id === tn.id), "note stays hidden after a failed delete");
  assert.ok(!(await t5.listHighlights("2026-11-18")).some((h) => h.id === th.id), "highlight stays hidden after a failed delete");
  delStatus = 404;
  const t6 = Store.createStore({fetch: statusFetch, storage: tsrv});
  assert.equal(await t6.ready(), "server");
  assert.equal(tsrv.getItem("bb-beo-local-v1-deleted"), null, "404 clears the tombstones");

  await new Promise((r) => real.close(r));
  fs.rmSync(tmp, {recursive: true, force: true});
  fs.rmSync(tmp + "-outside.txt", {force: true});

  // ---- repo hygiene ----
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignore, /^beo-local-state\.json\*?$/m, "saved state is gitignored");
  assert.match(ignore, /^beo-originals\/$/m);
  assert.match(ignore, /^scripts\/firebase-config\.js$/m);
  const serverSrc = fs.readFileSync(path.join(__dirname, "serve-beo-beta.js"), "utf8");
  assert.match(serverSrc, /listen\(PORT, "127\.0\.0\.1"/);
  assert.doesNotMatch(serverSrc, /0\.0\.0\.0|"::"/);
  const page = fs.readFileSync(path.join(root, "beo-beta.html"), "utf8");
  assert.match(page, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(page, /firebase-config|Sign in with Google/i);

  // ---- desktop.js gate ----
  const desktop = fs.readFileSync(path.join(root, "desktop.js"), "utf8");
  const fn = desktop.match(/function beoBeta\(\) \{[^\n]*\}/);
  assert.ok(fn, "beoBeta gate exists");
  const gate = (hostname) => vm.runInNewContext("(function(){ var location = {hostname: " + JSON.stringify(hostname) + "}; var localStorage = {getItem: function(){ return '1'; }}; var get = function(){ return '1'; }; " + fn[0] + " return beoBeta(); })()");
  assert.equal(gate("127.0.0.1"), true);
  assert.equal(gate("localhost"), true);
  assert.equal(gate("jaesin.github.io"), false, "live site: tab hidden");
  assert.equal(gate("banquet-bot.example.com"), false);
  assert.equal(gate("127.0.0.1.evil.com"), false);
  assert.equal(gate("evil-localhost"), false);
  assert.doesNotMatch(fn[0], /localStorage|get\(/, "the old bb-beo-beta flag no longer decides");
  const jason = desktop.indexOf('w.name == "Jason" ?'), hector = desktop.indexOf('w.name == "Hector" ?');
  const link = desktop.indexOf("beoBeta() ?");
  assert.ok(jason > 0 && hector > jason && link > jason && link < hector, "BEO link sits inside Jason's Private block only");
  assert.equal(desktop.split("beo-beta.html").length - 1, 2, "no other BEO links in desktop.js");
  const hectorBlock = desktop.slice(hector, hector + 700);
  assert.doesNotMatch(hectorBlock.split("\n").slice(0, 3).join("\n"), /beo/i, "Hector's Tools links unchanged");
  assert.match(desktop, /notesTester\(\) \? /, "Notes tester link still gated by its own flag");
  assert.match(desktop, /bb-notes-tester/);

  console.log("PASS: BEO local store (notes, highlights, slots, remove), localStorage fallback and migration, local server API (atomic write, validation, blocked paths, host/origin checks), localhost gate.");
})().catch((e) => { console.error(e); process.exit(1); });
