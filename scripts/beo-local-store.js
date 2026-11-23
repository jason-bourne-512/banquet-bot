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

  // Stable id for a migrated note: the same old note always gets the same id, whatever has been removed around it.
  function legacyId(key, n, seen) {
    var base = key + "|" + n.at + "|" + n.text, h = 5381;
    for (var k = 0; k < base.length; k++) h = ((h * 33) ^ base.charCodeAt(k)) >>> 0;
    var c = seen[base] = (seen[base] || 0) + 1;
    return "lg_" + h.toString(36) + "_" + base.length.toString(36) + (c > 1 ? "_" + c : "");
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
