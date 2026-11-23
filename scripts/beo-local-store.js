// BEO tab notes and highlights, saved on this Mac only. No Firebase, no sign-in.
// Pure state operations (shared by the browser page and scripts/serve-beo-beta.js) plus the store the page talks to.
// State shape: {v: 1, notes: [{id, date, eo, printed, revision, source, at, text}], highlights: [{id, date, eo, printed, revision, page, slot, x, y, w, h}]}
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./notes-lib.js"));
  else root.BeoLocal = factory(root.Notes);
})(typeof self !== "undefined" ? self : this, function (Notes) {
  "use strict";
  var LS_KEY = "bb-beo-local-v1";
  var API = "/api/beo";
  var MAX_NOTES = 2000, MAX_HIGHLIGHTS_TOTAL = 20000, MAX_BYTES = 2 * 1024 * 1024;

  function emptyState() { return {v: 1, notes: [], highlights: []}; }
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function idOk(id) { return typeof id === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(id); }

  function cleanNote(n) {
    if (!n || !idOk(n.id)) return null;
    var d;
    try { d = Notes.beoNoteDoc({date: n.date, eo: String(n.eo), printed: n.printed, revision: n.revision, source: n.source, text: n.text, createdAt: n.at || n.createdAt}); } catch (e) { return null; }
    return Notes.beoNoteFromDoc(n.id, d);
  }
  function cleanHighlight(h) {
    if (!h || !idOk(h.id)) return null;
    var b;
    try { b = Notes.highlightDoc({date: h.date, eo: String(h.eo), printed: h.printed, revision: h.revision, source: h.source, page: h.page, slot: h.slot, x: h.x, y: h.y, w: h.w, h: h.h}); } catch (e) { return null; }
    return Notes.highlightFromDoc(h.id, b.data);
  }
  // Any shape in, a clean state out. Bad rows are dropped; wrong top-level shape or oversize throws.
  function validateState(s) {
    if (!s || typeof s !== "object" || Array.isArray(s) || !Array.isArray(s.notes || []) || !Array.isArray(s.highlights || [])) throw new Error("Bad BEO state.");
    var notes = s.notes || [], hls = s.highlights || [];
    if (notes.length > MAX_NOTES * 2 || hls.length > MAX_HIGHLIGHTS_TOTAL * 2) throw new Error("BEO state is too large.");
    var out = emptyState(), seen = {};
    notes.forEach(function (n) { var c = cleanNote(n); if (c && !seen["n" + c.id]) { seen["n" + c.id] = 1; out.notes.push(c); } });
    hls.forEach(function (h) { var c = cleanHighlight(h); if (c && !seen["h" + c.id]) { seen["h" + c.id] = 1; out.highlights.push(c); } });
    if (out.notes.length > MAX_NOTES || out.highlights.length > MAX_HIGHLIGHTS_TOTAL) throw new Error("BEO state is too large.");
    if (JSON.stringify(out).length > MAX_BYTES) throw new Error("BEO state is too large.");
    return out;
  }

  // ---- pure operations: each returns {state, item} and never mutates its input ----
  function addNote(state, o) {
    var d = Notes.beoNoteDoc(o), id = idOk(o.id) ? o.id : newId("n_");
    // A caller-chosen id (migrated notes) that is already saved is returned as is, so a retry never adds a second copy.
    var have = state.notes.filter(function (n) { return n.id === id; })[0];
    if (have) return {state: state, item: have};
    var note = Notes.beoNoteFromDoc(id, d);
    if (state.notes.length >= MAX_NOTES) throw new Error("Too many notes.");
    return {state: {v: 1, notes: state.notes.concat([note]), highlights: state.highlights}, item: note};
  }
  function deleteNote(state, id) {
    return {state: {v: 1, notes: state.notes.filter(function (n) { return n.id !== id; }), highlights: state.highlights}, item: null};
  }
  // If the asked-for slot is taken on that page the next free one is used; a full page throws.
  function addHighlight(state, o) {
    var ident = {date: o.date, eo: String(o.eo), printed: o.printed, revision: Number(o.revision)};
    var page = Number(o.page);
    var onPage = Notes.highlightsFor(state.highlights, ident, page);
    var req = Number(o.slot);
    var slot = (!(req >= 1) || onPage.some(function (h) { return h.slot === req; })) ? Notes.nextHighlightSlot(onPage) : req;
    if (!slot) throw new Error("Too many highlights on this page.");
    if (state.highlights.length >= MAX_HIGHLIGHTS_TOTAL) throw new Error("Too many highlights.");
    var built = Notes.highlightDoc(Object.assign({}, o, {slot: slot}));
    var h = Notes.highlightFromDoc(newId("h_"), built.data);
    return {state: {v: 1, notes: state.notes, highlights: state.highlights.concat([h])}, item: h};
  }
  function deleteHighlight(state, id) {
    return {state: {v: 1, notes: state.notes, highlights: Notes.removeHighlight(state.highlights, id)}, item: null};
  }
  // Merge an incoming state into this one, keeping ids that already exist (carries browser-saved items to the file).
  function mergeState(state, incoming) {
    var inc = validateState(incoming), n = {}, h = {};
    state.notes.forEach(function (x) { n[x.id] = 1; });
    state.highlights.forEach(function (x) { h[x.id] = 1; });
    return validateState({notes: state.notes.concat(inc.notes.filter(function (x) { return !n[x.id]; })),
      highlights: state.highlights.concat(inc.highlights.filter(function (x) { return !h[x.id]; }))});
  }
  function forDate(state, date) {
    return {notes: state.notes.filter(function (n) { return n.date === date; }), highlights: state.highlights.filter(function (h) { return h.date === date; })};
  }

  // ---- backends: all expose state/addNote/removeNote/addHighlight/removeHighlight/merge ----
  // stateBackend runs the pure ops one at a time over load()/save(); the server uses it with a file, the page with localStorage.
  function stateBackend(load, save) {
    var chain = Promise.resolve();
    function run(fn) {
      var p = chain.then(function () { return Promise.resolve(load()).then(function (s) { return fn(validateState(s || emptyState())); }); });
      chain = p.catch(function () {});
      return p;
    }
    function apply(op) { return run(function (s) { var r = op(s); return Promise.resolve(save(r.state)).then(function () { return r.item; }); }); }
    return {
      state: function () { return run(function (s) { return s; }); },
      addNote: function (o) { return apply(function (s) { return addNote(s, o); }); },
      removeNote: function (id) { return apply(function (s) { return deleteNote(s, id); }); },
      addHighlight: function (o) { return apply(function (s) { return addHighlight(s, o); }); },
      removeHighlight: function (id) { return apply(function (s) { return deleteHighlight(s, id); }); },
      merge: function (inc) { return run(function (s) { var m = mergeState(s, inc); return Promise.resolve(save(m)).then(function () { return m; }); }); }
    };
  }
  function storageBackend(storage, key) {
    key = key || LS_KEY;
    return stateBackend(function () {
      try { return JSON.parse(storage.getItem(key)) || emptyState(); } catch (e) { return emptyState(); }
    }, function (s) { storage.setItem(key, JSON.stringify(s)); });
  }
  function apiBackend(fetchFn, base) {
    base = base || API;
    function call(method, url, body) {
      return fetchFn(url, {method: method, headers: {"Content-Type": "application/json"}, body: body == null ? undefined : JSON.stringify(body), cache: "no-store"}).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error((j && j.error) || "Local server said no."); e.http = r.status; throw e; }
          return j;
        });
      });
    }
    return {
      state: function () { return call("GET", base + "/state").then(function (j) { return validateState(j); }); },
      addNote: function (o) { return call("POST", base + "/notes", o).then(function (j) { return j.item; }); },
      removeNote: function (id) { return call("DELETE", base + "/notes/" + encodeURIComponent(id)); },
      addHighlight: function (o) { return call("POST", base + "/highlights", o).then(function (j) { return j.item; }); },
      removeHighlight: function (id) { return call("DELETE", base + "/highlights/" + encodeURIComponent(id)); },
      merge: function (inc) { return call("POST", base + "/import", inc); }
    };
  }

  // The store the page uses. Tries the local server first; if it cannot be reached, falls back to localStorage in this browser.
  // When the server is reachable, anything saved in the browser while it was down is merged into the file, then cleared from the browser.
  function createStore(opts) {
    opts = opts || {};
    var local = storageBackend(opts.storage, opts.key);
    var api = opts.fetch ? apiBackend(opts.fetch, opts.base) : null;
    var mode = "local", ready = null;
    var delKey = (opts.key || LS_KEY) + "-deleted";
    // Deletes made while the server is unreachable: ids kept here until they are replayed to the server.
    function readTombs() {
      var t = {};
      try { t = JSON.parse(opts.storage.getItem(delKey)) || {}; } catch (e) {}
      return {notes: Array.isArray(t.notes) ? t.notes.filter(idOk) : [], highlights: Array.isArray(t.highlights) ? t.highlights.filter(idOk) : []};
    }
    function writeTombs(t) {
      try {
        if (!t.notes.length && !t.highlights.length) opts.storage.removeItem(delKey);
        else opts.storage.setItem(delKey, JSON.stringify(t));
      } catch (e) {}
    }
    function addTomb(kind, id) {
      var t = readTombs();
      if (t[kind].indexOf(id) < 0) t[kind].push(id);
      writeTombs(t);
    }
    function hideTombs(s) {
      var t = readTombs();
      return {v: 1, notes: s.notes.filter(function (n) { return t.notes.indexOf(n.id) < 0; }), highlights: s.highlights.filter(function (h) { return t.highlights.indexOf(h.id) < 0; })};
    }
    // A tombstone clears only on success or 404 (already gone); 5xx, network and other errors keep it for the next try.
    function replayTombs() {
      var t = readTombs(), jobs = [];
      t.notes.forEach(function (id) { jobs.push({kind: "notes", id: id, run: api.removeNote(id)}); });
      t.highlights.forEach(function (id) { jobs.push({kind: "highlights", id: id, run: api.removeHighlight(id)}); });
      return Promise.all(jobs.map(function (j) {
        return j.run.then(function () { return true; }, function (e) { return !!(e && e.http === 404); }).then(function (done) { return {job: j, done: done}; });
      })).then(function (rs) {
        var cur = readTombs();
        rs.forEach(function (r) { if (r.done) cur[r.job.kind] = cur[r.job.kind].filter(function (x) { return x !== r.job.id; }); });
        writeTombs(cur);
      });
    }
    function netFail(e) { return !(e && e.http); }
    function pick() {
      if (!api) return Promise.resolve(local);
      return api.state().then(function () {
        mode = "server";
        return replayTombs().then(function () { return local.state(); }).then(function (ls) {
          ls = hideTombs(ls);
          if (!ls.notes.length && !ls.highlights.length) return api;
          return api.merge(ls).then(function () { try { opts.storage.removeItem(opts.key || LS_KEY); } catch (e) {} return api; }, function () { return api; });
        });
      }, function () { return local; });
    }
    function be() { if (!ready) ready = pick(); return ready; }
    function dropToLocal() { mode = "local"; ready = Promise.resolve(local); return local; }
    function viaOp(name, arg, tombKind) {
      function viaLocal() { return local[name](arg).then(function (r) { if (tombKind) addTomb(tombKind, arg); return r; }); }
      return be().then(function (b) {
        if (b !== api) return viaLocal();
        return b[name](arg).catch(function (e) { if (netFail(e)) { dropToLocal(); return viaLocal(); } throw e; });
      });
    }
    function stateFor(date) {
      return be().then(function (b) {
        return b.state().catch(function (e) { if (b === api && netFail(e)) return dropToLocal().state(); throw e; });
      }).then(function (s) { return forDate(hideTombs(s), date); });
    }
    return {
      live: true,
      mode: function () { return mode; },
      ready: function () { return be().then(function () { return mode; }); },
      listNotes: function (date) { return stateFor(date).then(function (s) { return s.notes; }); },
      listHighlights: function (date) { return stateFor(date).then(function (s) { return s.highlights; }); },
      addNote: function (o) { try { Notes.beoNoteDoc(o); } catch (e) { return Promise.reject(e); } return viaOp("addNote", o); },
      deleteNote: function (id) { return id ? viaOp("removeNote", id, "notes") : Promise.reject(new Error("No note.")); },
      addHighlight: function (o) {
        try { Notes.highlightDoc(Object.assign({}, o, {slot: Number(o.slot) >= 1 ? o.slot : 1})); } catch (e) { return Promise.reject(e); }
        return viaOp("addHighlight", o);
      },
      deleteHighlight: function (id) { return id ? viaOp("removeHighlight", id, "highlights") : Promise.reject(new Error("No highlight.")); }
    };
  }

  // Pure-JS SHA-256 (hex) so the id works in the browser and Node without async crypto.
  var SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function sha256Hex(str) {
    var bytes = unescape(encodeURIComponent(str)), len = bytes.length, w = [], i, j;
    for (i = 0; i < len; i++) w[i >> 2] |= bytes.charCodeAt(i) << (24 - (i % 4) * 8);
    w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    var words = (((len + 8) >> 6) + 1) * 16;
    for (i = 0; i < words; i++) if (!w[i]) w[i] = 0;
    w[words - 1] = len * 8; w[words - 2] = Math.floor(len / 536870912);
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < words; off += 16) {
      var m = w.slice(off, off + 16), a = H.slice();
      for (j = 16; j < 64; j++) {
        var s0 = rr(m[j - 15], 7) ^ rr(m[j - 15], 18) ^ (m[j - 15] >>> 3), s1 = rr(m[j - 2], 17) ^ rr(m[j - 2], 19) ^ (m[j - 2] >>> 10);
        m[j] = (m[j - 16] + s0 + m[j - 7] + s1) | 0;
      }
      for (j = 0; j < 64; j++) {
        var t1 = (a[7] + (rr(a[4], 6) ^ rr(a[4], 11) ^ rr(a[4], 25)) + ((a[4] & a[5]) ^ (~a[4] & a[6])) + SHA_K[j] + m[j]) | 0;
        var t2 = ((rr(a[0], 2) ^ rr(a[0], 13) ^ rr(a[0], 22)) + ((a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]))) | 0;
        a = [(t1 + t2) | 0, a[0], a[1], a[2], (a[3] + t1) | 0, a[4], a[5], a[6]];
      }
      for (j = 0; j < 8; j++) H[j] = (H[j] + a[j]) | 0;
    }
    return H.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  // Stable id for a migrated note: sha256 of the full key, timestamp and exact text (as JSON, so no field bleeds into another). The same old
  // note always gets the same id and different notes never share one. Identical duplicates get a _2, _3 ... suffix.
  function legacyId(key, n, seen) {
    var base = JSON.stringify([key, n.at, n.text]), c = seen[base] = (seen[base] || 0) + 1;
    return "lg_" + sha256Hex(base) + (c > 1 ? "_" + c : "");
  }
  // Old browser-only notes ({"date|eo": [{at, text}]}) matched to the index, each as {key, i, input}: key and i say where it sits in the old data.
  function legacyItems(storage, index) {
    var raw, out = [];
    try { raw = JSON.parse(storage.getItem("bb-beo-notes-v1")); } catch (e) { return out; }
    if (!raw || typeof raw !== "object") return out;
    var seen = {};
    Object.keys(raw).forEach(function (key) {
      var p = key.split("|"), list = ((index && index.days) || {})[p[0]] || [];
      var eo = list.filter(function (e) { return String(e.eo) === p[1]; })[0];
      if (!eo || !Array.isArray(raw[key])) return;
      raw[key].forEach(function (n, i) {
        if (!n || typeof n.text !== "string") return;
        var o = Notes.beoIdentity(p[0], eo); o.text = n.text; o.createdAt = n.at; o.id = legacyId(key, n, seen);
        out.push({key: key, i: i, id: o.id, input: o});
      });
    });
    return out;
  }
  function legacyNotes(storage, index) { return legacyItems(storage, index).map(function (it) { return it.input; }); }

  // Drop the notes that saved ({key, i} from legacyItems) from the old key so a later run never adds them twice. Notes that did not save or
  // match stay under the old key; the key goes away once nothing is left.
  function legacySettle(storage, saved) {
    var raw;
    try { raw = JSON.parse(storage.getItem("bb-beo-notes-v1")); } catch (e) { return; }
    if (!raw || typeof raw !== "object") return;
    var gone = {}, seen = {};
    saved.forEach(function (it) { gone[it.id] = true; });
    var left = {}, any = false;
    Object.keys(raw).forEach(function (key) {
      if (!Array.isArray(raw[key])) return;
      // Matched by stable id, not position, so settling one note at a time is safe.
      var keep = raw[key].filter(function (n) { return !(n && typeof n.text === "string" && gone[legacyId(key, n, seen)]); });
      if (keep.length) { left[key] = keep; any = true; }
    });
    if (any) storage.setItem("bb-beo-notes-v1", JSON.stringify(left)); else storage.removeItem("bb-beo-notes-v1");
  }

  return {LS_KEY: LS_KEY, API: API, MAX_BYTES: MAX_BYTES, MAX_NOTES: MAX_NOTES, emptyState: emptyState, validateState: validateState,
    addNote: addNote, deleteNote: deleteNote, addHighlight: addHighlight, deleteHighlight: deleteHighlight, mergeState: mergeState, forDate: forDate,
    stateBackend: stateBackend, storageBackend: storageBackend, apiBackend: apiBackend, createStore: createStore, legacyNotes: legacyNotes, legacyItems: legacyItems, legacySettle: legacySettle, idOk: idOk};
});
