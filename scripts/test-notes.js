// Notes tab: date picker events from the Rundown, notes grouped by person, sample data only.
// No server, browser, or network. Fixture is inline; also checks the live rundown.html when present.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { load } = require("cheerio");
const Notes = require("./notes-lib.js");

const fixture = `
<div class="day-section" data-date="2026-11-21">
  <div class="event-card">
    <div class="card-group">Emerson \u2014 Storage Pickup (Camellia B)</div>
    <div class="svc-row"><div class="svc-time">6:00 AM–<br>12:00 PM</div><span class="room-pill">Camellia B</span></div>
  </div>
  <div class="event-card">
    <div class="card-group">San Jose Barracuda \u2014 Meal Room (Plumeria)</div>
    <div class="svc-row"><div class="svc-time">8:00 AM–<br>1:00 PM</div><span class="room-pill">Plumeria</span></div>
  </div>
</div>
<div class="day-section" data-date="2026-11-21">
  <div class="event-card">
    <div class="card-group">Emerson \u2014 Storage Pickup (Camellia B)</div>
  </div>
</div>
<div class="day-section" data-date="2026-11-22"></div>
<div class="day-section" data-date="2026-11-24">
  <div class="event-card">
    <div class="card-group">Tucson Roadrunners \u2014 Team Meeting (Camellia)</div>
    <span class="room-pill">Camellia</span>
  </div>
</div>
`;

function helpers(html) {
  const $ = load(html);
  return {
    sections: $(".day-section").toArray(),
    txt: function (el) { return el ? Notes.clean($(el).text()) : ""; },
    qs: function (el, sel) { const n = $(el).find(sel).first(); return n.length ? n.get(0) : null; },
    qsa: function (el, sel) { return $(el).find(sel).toArray(); },
    attr: function (el, name) { return $(el).attr(name) || ""; }
  };
}

// first name only
assert.equal(Notes.firstName("Jason"), "Jason");
assert.equal(Notes.firstName("Jason Orta"), "Jason");
assert.equal(Notes.firstName("MGR: Diana"), "Diana");
assert.equal(Notes.firstName("  Lisa  "), "Lisa");
assert.equal(Notes.firstName(""), "");

// date helpers
assert.equal(Notes.isISODate("2026-11-21"), true);
assert.equal(Notes.isISODate("11/21/2026"), false);
assert.equal(Notes.shiftISODate("2026-11-21", 1), "2026-11-22");
assert.equal(Notes.shiftISODate("2026-11-21", -1), "2026-11-20");
assert.equal(Notes.formatDayLabel("2026-11-21"), "Sat, Nov 21");
assert.ok(Notes.formatNoteTime("2026-11-21T07:05:00-06:00").indexOf("7:05") >= 0);

// matching ignores typographic dashes
assert.equal(
  Notes.eventKey("2026-11-21", "Emerson — Storage Pickup (Camellia B)"),
  Notes.eventKey("2026-11-21", "Emerson - Storage Pickup (Camellia B)")
);

const h = helpers(fixture);
const nov21 = Notes.collectEvents(h, "2026-11-21");
assert.equal(nov21.length, 2, "dedupe the Overview repeat of the same day");
assert.deepEqual(nov21.map(function (e) { return e.group.replace(/\u2014/g, "—"); }).sort(), [
  "Emerson — Storage Pickup (Camellia B)",
  "San Jose Barracuda — Meal Room (Plumeria)"
].sort());
assert.ok(nov21.some(function (e) { return e.rooms.indexOf("Plumeria") >= 0 && /8:00 AM/.test(e.time); }));
assert.deepEqual(Notes.collectEvents(h, "2026-11-22"), []);
assert.equal(Notes.collectEvents(h, "2026-11-24").length, 1);

const thread = Notes.notesFor(Notes.SAMPLE_NOTES, "2026-11-21", "San Jose Barracuda — Meal Room (Plumeria)");
assert.equal(thread.length, 3);
assert.deepEqual(thread.map(function (n) { return n.name; }), ["Lisa", "Jason", "Jason"]);
assert.ok(thread[0].timeLabel.indexOf("7:05") >= 0);
assert.ok(thread.every(function (n) { return n.name.indexOf(" ") === -1; }), "first name only on notes");

const shuffled = Notes.notesFor([
  Notes.SAMPLE_NOTES[4],
  Notes.SAMPLE_NOTES[3]
], "2026-11-21", "San Jose Barracuda - Meal Room (Plumeria)");
assert.deepEqual(shuffled.map(function (n) { return n.name; }), ["Lisa", "Jason"]);

// grouping: same author merged, blocks ordered by earliest note, times oldest first
const barraJason = Notes.SAMPLE_NOTES.filter(function (n) {
  return /Barracuda/.test(n.group) && n.name === "Jason";
});
assert.ok(barraJason.length >= 2, "sample data should show one person with 2+ notes");
const mixed = Notes.groupNotesByAuthor([
  barraJason[1],
  Notes.SAMPLE_NOTES[3],
  barraJason[0]
]);
assert.equal(mixed.length, 2);
assert.equal(mixed[0].name, "Lisa", "person blocks ordered by earliest note");
assert.equal(mixed[1].name, "Jason");
assert.equal(mixed[1].notes.length, 2, "same author merged into one block");
assert.deepEqual(mixed[1].notes.map(function (n) { return n.at; }), [
  "2026-11-21T07:28:00-06:00",
  "2026-11-21T09:15:00-06:00"
]);
assert.ok(mixed[1].notes[0].at < mixed[1].notes[1].at || mixed[1].notes[0].at.localeCompare(mixed[1].notes[1].at) < 0);

const packed = Notes.eventsWithNotes(nov21, Notes.SAMPLE_NOTES);
const emerson = packed.find(function (e) { return /Emerson/.test(e.group); });
const barra = packed.find(function (e) { return /Barracuda/.test(e.group); });
assert.equal(emerson.notes.length, 1);
assert.equal(emerson.notes[0].name, "Diana");
assert.equal(barra.notes.length, 3);
assert.equal(barra.authors.length, 2);
assert.deepEqual(barra.authors.map(function (b) { return b.name; }), ["Lisa", "Jason"]);
assert.equal(barra.authors[1].notes.length, 2);
assert.ok(barra.authors[1].notes[0].timeLabel.indexOf("7:28") >= 0);
assert.ok(barra.authors[1].notes[1].timeLabel.indexOf("9:15") >= 0);
assert.ok(packed.some(function (e) { return e.authors.some(function (b) { return b.notes.length >= 2; }) && e.authors.length >= 2; }),
  "sample data has an event with two people and one person with 2+ notes");

// pinned general notes: not tied to a date or event, same group-by-person layout, shown on every date
assert.equal(Notes.SAMPLE_PINNED.length, 3);
assert.ok(Notes.SAMPLE_PINNED.every(function (n) { return n.name && n.at && n.text && n.date == null && n.group == null; }),
  "pinned samples are general notes with no date or event");
const pinnedList = Notes.pinnedNotes(Notes.SAMPLE_PINNED);
assert.equal(pinnedList.length, 3);
assert.ok(pinnedList[0].timeLabel.indexOf("9:00") >= 0);
assert.ok(/Nov 18/.test(pinnedList[0].timeLabel), "pinned times include the date, since they are not tied to the picker");
const pinnedShuffled = Notes.pinnedAuthors([
  Notes.SAMPLE_PINNED[2],
  Notes.SAMPLE_PINNED[0],
  Notes.SAMPLE_PINNED[1]
]);
assert.equal(pinnedShuffled.length, 2);
assert.equal(pinnedShuffled[0].name, "Hector", "pinned blocks ordered by earliest note");
assert.equal(pinnedShuffled[1].name, "Jason");
assert.equal(pinnedShuffled[1].notes.length, 2, "same author merged in pinned notes");
assert.deepEqual(pinnedShuffled[1].notes.map(function (n) { return n.at; }), [
  "2026-11-19T14:20:00-06:00",
  "2026-11-20T08:05:00-06:00"
]);
const otherDay = Notes.eventsWithNotes(Notes.collectEvents(h, "2026-11-22"), Notes.SAMPLE_NOTES);
assert.deepEqual(Notes.pinnedAuthors(Notes.SAMPLE_PINNED).map(function (b) { return b.name; }), ["Hector", "Jason"]);
assert.equal(otherDay.length, 0, "a day with no events still has the same pinned notes");

// sample data safety: no prices, phones, PINs, or payment fields
const sampleText = JSON.stringify(Notes.SAMPLE_NOTES) + JSON.stringify(Notes.SAMPLE_PINNED);
assert(!/\$\d/.test(sampleText), "sample notes must not include prices");
assert(!/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(sampleText), "sample notes must not include phone numbers");
assert(!/\bPIN\b/i.test(sampleText), "sample notes must not mention PINs");
assert(!/card number|cvv|billing/i.test(sampleText));
assert.ok(Notes.SAMPLE_BANNER.toLowerCase().indexOf("sample") >= 0);
assert.equal(Notes.PAGE_SUB, "Side notes and FYIs. Anything critical still goes on the BEO or to your manager.");
assert.doesNotMatch(Notes.PAGE_SUB, /\u2014|\u2013/);
assert.doesNotMatch(Notes.INTRO_COPY, /\u2014|\u2013/);

// intro pop-up: hidden until the device opts in, then show once
assert.equal(Notes.INTRO_KEY, "bb-notes-intro-seen");
assert.equal(Notes.TESTER_KEY, "bb-notes-tester");
assert.match(Notes.INTRO_COPY, /Side notes and FYIs only/);
assert.match(Notes.INTRO_COPY, /Got it|Sample notes for now/, "copy mentions sample / upcoming save");
function memStore() {
  return {
    data: Object.create(null),
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; },
    setItem: function (k, v) { this.data[k] = String(v); },
    removeItem: function (k) { delete this.data[k]; }
  };
}
const mem = memStore();
assert.equal(Notes.isNotesTester(mem), false);
assert.equal(Notes.applyNotesTester({ search: "", pathname: "/rundown.html", storage: mem }), false);
assert.equal(Notes.isNotesTester(mem), false, "hidden by default");
assert.equal(Notes.shouldShowIntro(mem), false, "no intro without opt-in");
assert.equal(Notes.showNotesIntro({storage: mem, document: {querySelector: function () { return null; }}, window: {}}), null, "no intro without opt-in");

assert.equal(Notes.applyNotesTester({ search: "?notes=on", pathname: "/index.html", storage: mem }), true);
assert.equal(mem.getItem("bb-notes-tester"), "1");
assert.equal(Notes.isNotesTester(mem), true);
assert.equal(Notes.applyNotesTester({ search: "?notes=off", pathname: "/index.html", storage: mem }), false);
assert.equal(mem.getItem("bb-notes-tester"), null);
assert.equal(Notes.isNotesTester(mem), false);

assert.equal(Notes.applyNotesTester({ search: "", pathname: "/banquet-bot/notes.html", storage: mem }), true, "opening notes.html opts in");
assert.equal(mem.getItem("bb-notes-tester"), "1");
assert.equal(Notes.applyNotesTester({ search: "?date=2026-11-21", pathname: "notes.html", storage: mem }), true);
assert.equal(Notes.applyNotesTester({ search: "?notes=off", pathname: "notes.html", storage: mem }), false, "?notes=off wins on notes.html");
assert.equal(Notes.isNotesTester(mem), false);
assert.equal(Notes.applyNotesTester({ search: "?date=2026-11-21&notes=on", pathname: "/rundown.html", storage: mem }), true);

assert.equal(Notes.introSeen(mem), false);
assert.equal(Notes.shouldShowIntro(mem), true, "intro shows after opt-in, once");
Notes.markIntroSeen(mem);
assert.equal(mem.getItem("bb-notes-intro-seen"), "1");
assert.equal(Notes.introSeen(mem), true);
assert.equal(Notes.shouldShowIntro(mem), false);
assert.equal(Notes.showNotesIntro({storage: mem, document: {querySelector: function () { return null; }}, window: {}}), null, "already seen: do not mount");

// page is read-only and wired to the lib
const page = fs.readFileSync(path.join(__dirname, "..", "notes.html"), "utf8");
assert.match(page, /type="date"/);
assert.match(page, /scripts\/notes-lib\.js/);
assert.match(page, /id="nt-banner"/);
assert.match(page, /nt-card/);
assert.match(page, /nt-author/);
assert.match(page, /Pinned: General notes/);
assert.match(page, /Daily event notes/);
assert.ok(page.indexOf("Pinned: General notes") < page.indexOf("Daily event notes"), "Pinned section is above Daily event notes");
assert.ok(page.indexOf("id=\"nt-pinned\"") < page.indexOf("id=\"nt-date\"") || page.indexOf("id='nt-pinned'") < page.indexOf('id="nt-date"') || page.indexOf('id="nt-pinned"') < page.indexOf('id="nt-date"'),
  "date picker sits in the Daily section, below Pinned");
assert.match(page, /Side notes and FYIs\. Anything critical still goes on the BEO or to your manager\./);
assert.doesNotMatch(page, /The Wire/i, "Banquet Bot Firebase only");
assert.doesNotMatch(page, /firebase|firestore/i, "live Notes tab stays as on main: no Firebase, no sign-in");
assert.doesNotMatch(page, /<textarea/);
assert.doesNotMatch(page, /type="password"|name="pin"/i);
new Function(page.match(/<script>\s*([\s\S]*?)<\/script>/)[1]); // syntax check

// side panel and Home point at the tab, but only after opt-in
const desktop = fs.readFileSync(path.join(__dirname, "..", "desktop.js"), "utf8");
assert.match(desktop, /href="notes\.html"/);
assert.match(desktop, />Notes<\/a>/);
assert.match(desktop, /showNotesIntro/);
assert.match(desktop, /notes-lib\.js/);
assert.match(desktop, /bb-notes-tester/);
assert.match(desktop, /notesTester\(\) \? /);
assert.match(desktop, /if \(!notesTester\(\)\) return;/);
assert.match(desktop, /applyNotesTesterFlag/);
assert.match(Notes.INTRO_COPY, /New: Notes/);
const home = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.match(home, /href="notes\.html"/);
assert.match(home, />NOTES</);
assert.match(home, /id="notesBtn"/);
assert.match(home, /destination notes"[^>]*\bhidden\b/);
assert.match(home, /bb-notes-tester/);
assert.match(home, /destination\.notes\[hidden\]/);
assert.match(page, /Notes\.applyNotesTester\(/);
const theme = fs.readFileSync(path.join(__dirname, "..", "theme.js"), "utf8");
assert.match(theme, /bb-notes-tester/);
assert.match(theme, /desktop\.js\?v=1121c/);

// ---- Firebase config, Auth, App Check ----
assert.equal(Notes.firebaseConfigReady(null), false);
assert.equal(Notes.firebaseConfigReady({}), false);
assert.equal(Notes.firebaseConfigReady({apiKey: "YOUR_API_KEY", projectId: "YOUR_PROJECT_ID", appId: "YOUR_APP_ID"}), false, "example placeholders are not ready");
const goodCfg = {apiKey: "AIzaX", projectId: "bb-notes", appId: "1:2:web:3"};
assert.equal(Notes.firebaseConfigReady(goodCfg), true);
assert.equal(Notes.firebaseConfigReady(Object.assign({disabled: true}, goodCfg)), false);
assert.equal(Notes.appCheckSiteKey(goodCfg), "", "no site key means App Check is skipped");
assert.equal(Notes.appCheckSiteKey(Object.assign({appCheckSiteKey: "YOUR_RECAPTCHA_V3_SITE_KEY"}, goodCfg)), "", "placeholder key is not a key");
assert.equal(Notes.appCheckSiteKey(Object.assign({appCheckSiteKey: "6LcRealKey"}, goodCfg)), "6LcRealKey");
const repoRoot = path.join(__dirname, "..");
const exampleCfg = fs.readFileSync(path.join(__dirname, "firebase-config.example.js"), "utf8");
assert.match(exampleCfg, /apiKey[\s\S]*projectId[\s\S]*appId/);
assert.match(exampleCfg, /appCheckSiteKey/);
assert.match(fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8"), /^scripts\/firebase-config\.js$/m, "real config stays untracked");
assert.match(fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8"), /^beo-originals\/$/m, "BEO originals stay untracked");
assert.equal(Notes.isSignedIn(null), false);
assert.equal(Notes.isSignedIn({}), false);
assert.equal(Notes.isSignedIn({uid: "u1"}), true);
assert.equal(Notes.isPermissionError({code: "permission-denied"}), true);
assert.equal(Notes.isPermissionError(new Error("Missing or insufficient permissions.")), true);
assert.equal(Notes.isPermissionError(new Error("offline")), false);

function fakeModules(log, opts) {
  return function (name) {
    log.push("load " + name);
    const mods = {
      "firebase-app": {initializeApp: function (c) { log.push("initializeApp"); return {cfg: c}; }},
      "firebase-firestore": {getFirestore: function () { log.push("getFirestore"); return {db: 1}; }},
      "firebase-auth": {
        getAuth: function () { log.push("getAuth"); return {auth: 1}; },
        GoogleAuthProvider: function () { this.google = true; },
        signInWithPopup: function (a, p) { log.push("popup " + !!p.google); return Promise.resolve({user: {uid: "u1"}}); },
        signOut: function () { log.push("signOut"); return Promise.resolve(); },
        onAuthStateChanged: function (a, cb) { log.push("watch"); cb({uid: "u1"}); cb(null); cb({}); return function () {}; }
      },
      "firebase-app-check": {
        ReCaptchaV3Provider: function (k) { this.key = k; },
        initializeAppCheck: function (app, o) { log.push("appCheck " + o.provider.key); }
      }
    };
    if (opts && opts.failAppCheck && name === "firebase-app-check") return Promise.reject(new Error("blocked"));
    return Promise.resolve(mods[name]);
  };
}
(async function () {
  await assert.rejects(Notes.connectFirebase(null, fakeModules([])), /not configured/);
  const logA = [];
  const noKey = await Notes.connectFirebase(goodCfg, fakeModules(logA));
  assert.equal(noKey.appCheck, false);
  assert.ok(!logA.some(function (l) { return /app-check|appCheck/.test(l); }), "App Check modules are not loaded without a site key");
  assert.ok(logA.indexOf("load firebase-auth") >= 0, "Auth loads once config is ready");
  const logB = [];
  const withKey = await Notes.connectFirebase(Object.assign({appCheckSiteKey: "6LcRealKey"}, goodCfg), fakeModules(logB));
  assert.equal(withKey.appCheck, true);
  assert.ok(logB.indexOf("appCheck 6LcRealKey") > logB.indexOf("initializeApp"), "App Check starts after initializeApp");
  assert.ok(logB.indexOf("appCheck 6LcRealKey") < logB.indexOf("getFirestore"), "App Check starts before Firestore");
  const soft = await Notes.connectFirebase(Object.assign({appCheckSiteKey: "6LcRealKey"}, goodCfg), fakeModules([], {failAppCheck: true}));
  assert.equal(soft.appCheck, false, "App Check load failure does not break the page");
  const logC = [];
  await Notes.signInWithGoogle(noKey);
  await Notes.signOutUser(noKey);
  const seen = [];
  Notes.watchAuth(noKey, function (u) { seen.push(u && u.uid); });
  assert.deepEqual(seen, ["u1", null, null], "a user object without a uid counts as signed out");

  // ---- Notes store: sample fallback, live add/list/pinned/delete ----
  const sampleStore = Notes.createNotesStore(null);
  assert.equal(sampleStore.live, false);
  assert.equal((await sampleStore.listNotes({date: "2026-11-21"})).length, 4);
  assert.equal((await sampleStore.listPinned()).length, 3);
  await assert.rejects(sampleStore.addNote({text: "x", authorFirstName: "Jo", pinned: true}));

  const T0 = "2026-11-21T10:00:00-06:00";
  const rows = {};
  let seq = 0;
  const fake = {
    collection: function (db, name) { return {name: name}; },
    where: function (f, op, v) { return {f: f, v: v}; },
    query: function (c, w) { return {c: c, w: w}; },
    doc: function (db, name, id) { return {name: name, id: id}; },
    getDocs: async function (q) {
      const hits = (rows[q.c.name] || []).filter(function (r) { return r.data[q.w.f] === q.w.v; });
      return {forEach: function (cb) { hits.forEach(function (r) { cb({id: r.id, data: function () { return r.data; }}); }); }};
    },
    addDoc: async function (c, data) { const id = "n" + (++seq); (rows[c.name] = rows[c.name] || []).push({id: id, data: data}); return {id: id}; },
    setDoc: async function (ref, data) {
      const list = (rows[ref.name] = rows[ref.name] || []);
      if (list.some(function (r) { return r.id === ref.id; })) throw Object.assign(new Error("Missing or insufficient permissions."), {code: "permission-denied"});
      list.push({id: ref.id, data: data});
    },
    deleteDoc: async function (ref) { const l = rows[ref.name]; l.splice(l.findIndex(function (r) { return r.id === ref.id; }), 1); }
  };
  const live = Notes.createNotesStore(Notes.createFirestoreBackend(fake, {}));
  assert.equal(live.live, true);
  const added = await live.addNote({date: "2026-11-21", group: "Barracuda", text: "Doors at 8", authorFirstName: "Lisa", createdByDeviceId: "d-1", createdAt: T0});
  assert.equal(added.id, "n1");
  await live.addNote({pinned: true, text: "Ice machine slow", authorFirstName: "Jason", createdByDeviceId: "d-2", createdAt: T0});
  await live.addNote({date: "2026-11-22", group: "Other", text: "Elsewhere", authorFirstName: "Jason", createdByDeviceId: "d-2", createdAt: T0});
  const day = await live.listNotes({date: "2026-11-21"});
  assert.equal(day.length, 1);
  assert.equal(day[0].name, "Lisa");
  assert.equal(Notes.notesFor(day, "2026-11-21", "Barracuda")[0].id, "n1", "id survives into display notes");
  const pins = await live.listPinned();
  assert.equal(pins.length, 1);
  assert.equal(Notes.pinnedNotes(pins)[0].id, "n2");
  await assert.rejects(live.deleteNote(day[0], {name: "Hector", deviceId: "d-1"}, "2026-11-21T10:01:00-06:00"));
  assert.equal(rows.notes.length, 3);
  await live.deleteNote(day[0], {name: "Lisa", deviceId: "d-1"}, "2026-11-21T10:05:00-06:00");
  await live.deleteNote(pins[0], {name: "Jason", deviceId: "d-9"}, "2026-12-01T10:00:00-06:00");
  assert.equal(rows.notes.length, 1);
  await assert.rejects(live.addNote({date: "2026-11-21", group: "G", text: "Pay with card 4111111111111111", authorFirstName: "Lisa"}));

  // ---- BEO notes and highlights: doc builders ----
  const eoRec = {eo: "339574", org: "ML", printed: "2026-11-16", pages: ["a.png", "b.png"], versions: [
    {printed: "2026-11-11", source: "BEOs Magic Leap Offsite.pdf"}, {printed: "2026-11-16", source: "BEO Packet 11.12.26-12.02.26.pdf"}]};
  const ident = Notes.beoIdentity("2026-11-18", eoRec);
  assert.deepEqual(ident, {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 2, source: "BEO Packet 11.12.26-12.02.26.pdf"});
  const single = Notes.beoIdentity("2026-11-18", {eo: 218045, printed: "2026-11-10", versions: [{printed: "2026-11-10", source: "p.pdf"}]});
  assert.equal(single.revision, 1);
  assert.equal(single.eo, "218045");
  assert.equal(Notes.beoIdentity("2026-11-18", {eo: "1", printed: "2026-11-10"}).revision, 1, "no versions array still gets revision 1");

  const bn = Notes.beoNoteDoc(Object.assign({text: "  Bar opens at 5  ", createdAt: T0}, ident));
  assert.deepEqual(bn, {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 2, source: "BEO Packet 11.12.26-12.02.26.pdf", text: "Bar opens at 5", createdAt: T0});
  assert.throws(function () { Notes.beoNoteDoc(Object.assign({text: "x"}, ident, {eo: "ABC"})); }, /BEO/);
  assert.throws(function () { Notes.beoNoteDoc(Object.assign({text: "x"}, ident, {date: "bad"})); }, /BEO/);
  assert.throws(function () { Notes.beoNoteDoc(Object.assign({text: "x"}, ident, {printed: ""})); }, /BEO/);
  assert.throws(function () { Notes.beoNoteDoc(Object.assign({text: "card 4111 1111 1111 1111"}, ident)); }, /payment|PINs/i);
  assert.throws(function () { Notes.beoNoteDoc(Object.assign({text: "   "}, ident)); });

  // highlight math: percent boxes, any drag direction, clamped, tiny boxes dropped
  const rect = {left: 100, top: 200, width: 400, height: 500};
  assert.deepEqual(Notes.highlightFromDrag(140, 250, 300, 300, rect), {x: 10, y: 10, w: 40, h: 10});
  assert.deepEqual(Notes.highlightFromDrag(300, 300, 140, 250, rect), {x: 10, y: 10, w: 40, h: 10}, "drag up and left gives the same box");
  assert.deepEqual(Notes.highlightFromDrag(0, 0, 600, 900, rect), {x: 0, y: 0, w: 100, h: 100}, "drag past the page edge is clamped");
  assert.equal(Notes.highlightFromDrag(140, 250, 141, 251, rect), null, "tiny drag is dropped");
  assert.deepEqual(Notes.highlightFromDrag(140, 250, 300, 250, rect), {x: 10, y: 9.5, w: 40, h: 1}, "horizontal swipe becomes a 1% band");
  assert.deepEqual(Notes.highlightFromDrag(140, 250, 140, 350, rect), {x: 9.5, y: 10, w: 1, h: 20}, "vertical swipe becomes a 1% band");
  assert.equal(Notes.highlightFromDrag(140, 250, 300, 300, {left: 0, top: 0, width: 0, height: 0}), null, "no layout, no box");
  assert.equal(Notes.normalizeHighlight({x: "a", y: 1, w: 5, h: 5}), null);
  assert.deepEqual(Notes.normalizeHighlight({x: 95, y: 10, w: 20, h: 5}), {x: 95, y: 10, w: 5, h: 5}, "right edge clamped");
  assert.deepEqual(Notes.normalizeHighlight({x: -5, y: 10, w: 20, h: 5}), {x: 0, y: 10, w: 15, h: 5}, "left edge clamped");
  assert.deepEqual(Notes.normalizeHighlight({id: 7, x: 1.234, y: 2.345, w: 3.456, h: 4.567}), {x: 1.23, y: 2.35, w: 3.46, h: 4.57, id: "7"}, "rounds to 2 places, keeps id");
  // the same box follows the image when it is displayed larger
  const small = Notes.highlightFromDrag(140, 250, 300, 300, rect);
  const big = Notes.highlightFromDrag(100 + 0.1 * 800, 200 + 0.1 * 1000, 100 + 0.5 * 800, 200 + 0.2 * 1000, {left: 100, top: 200, width: 800, height: 1000});
  assert.deepEqual(small, big, "normalized coordinates survive resizing");

  const boxes = [{id: "a", x: 10, y: 10, w: 40, h: 10, slot: 1}, {id: "b", x: 20, y: 12, w: 10, h: 5, slot: 2}];
  assert.equal(Notes.hitHighlight(boxes, 25, 14).id, "b", "topmost (latest) box wins");
  assert.equal(Notes.hitHighlight(boxes, 45, 15).id, "a");
  assert.equal(Notes.hitHighlight(boxes, 80, 80), null);
  assert.equal(Notes.hitHighlight([], 1, 1), null);
  assert.deepEqual(Notes.removeHighlight(boxes, "b").map(function (b) { return b.id; }), ["a"]);
  assert.equal(boxes.length, 2, "remove does not mutate");
  assert.equal(Notes.removeHighlight(boxes, "zzz").length, 2);
  assert.equal(Notes.nextHighlightSlot([]), 1);
  assert.equal(Notes.nextHighlightSlot(boxes), 3);
  assert.equal(Notes.nextHighlightSlot([{slot: 2}]), 1, "frees the lowest open slot");
  const full = []; for (let i = 1; i <= Notes.MAX_HIGHLIGHTS; i++) full.push({slot: i});
  assert.equal(Notes.nextHighlightSlot(full), 0, "a page holds at most MAX_HIGHLIGHTS");
  assert.equal(Notes.MAX_HIGHLIGHTS, 50);

  const hd = Notes.highlightDoc(Object.assign({page: 1, slot: 3, x: 10, y: 10, w: 40, h: 10, createdAt: T0}, ident));
  assert.equal(hd.id, "2026-11-18_339574_2026-11-16_r2_p2_h3");
  assert.deepEqual(hd.data, {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 2, source: "BEO Packet 11.12.26-12.02.26.pdf", page: 1, slot: 3, x: 10, y: 10, w: 40, h: 10, createdAt: T0});
  assert.equal(Notes.beoPageKey(ident, 0), "2026-11-18_339574_2026-11-16_r2_p1");
  assert.throws(function () { Notes.highlightDoc(Object.assign({page: 0, slot: 51, x: 1, y: 1, w: 5, h: 5}, ident)); }, /Too many/);
  assert.throws(function () { Notes.highlightDoc(Object.assign({page: 0, slot: 0, x: 1, y: 1, w: 5, h: 5}, ident)); }, /Too many/);
  assert.throws(function () { Notes.highlightDoc(Object.assign({page: -1, slot: 1, x: 1, y: 1, w: 5, h: 5}, ident)); }, /page/);
  const band = Notes.highlightDoc(Object.assign({page: 0, slot: 1, x: 1, y: 1, w: 0.2, h: 5, createdAt: T0}, ident));
  assert.equal(band.data.w, 1);
  assert.equal(band.data.h, 5);
  assert.throws(function () { Notes.highlightDoc(Object.assign({page: 0, slot: 1, x: 1, y: 1, w: 0.2, h: 0.2}, ident)); }, /small/);
  assert.throws(function () { Notes.highlightDoc(Object.assign({page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5}, ident, {eo: ""})); }, /BEO/);

  // highlights belong to one print and one page
  const hlList = [
    Notes.highlightFromDoc("h1", {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 2, page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5}),
    Notes.highlightFromDoc("h2", {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 2, page: 1, slot: 1, x: 1, y: 1, w: 5, h: 5}),
    Notes.highlightFromDoc("h3", {date: "2026-11-18", eo: "339574", printed: "2026-11-11", revision: 1, page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5}),
    Notes.highlightFromDoc("h4", {date: "2026-11-18", eo: "218045", printed: "2026-11-16", revision: 2, page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5}),
    Notes.highlightFromDoc("h5", {date: "2026-11-18", eo: "339574", printed: "2026-11-16", revision: 1, page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5})
  ];
  assert.deepEqual(Notes.highlightsFor(hlList, ident, 0).map(function (h) { return h.id; }), ["h1"], "other pages, prints, revisions, and EOs are excluded");

  // BEO store through the Firestore adapter
  const beo = Notes.createBeoStore(Notes.createBeoBackend(fake, {}));
  assert.equal(beo.live, true);
  const note = await beo.addNote(Object.assign({text: "Bar opens at 5", createdAt: T0}, ident));
  assert.equal(note.eo, "339574");
  assert.equal(note.printed, "2026-11-16");
  await beo.addNote(Object.assign({text: "Other day", createdAt: T0}, ident, {date: "2026-11-19"}));
  const notesToday = await beo.listNotes("2026-11-18");
  assert.equal(notesToday.length, 1);
  assert.equal(Notes.beoNotesFor(notesToday, "2026-11-18", "339574").length, 1);
  assert.equal(Notes.beoNotesFor(notesToday, "2026-11-18", "218045").length, 0);
  await assert.rejects(beo.addNote(Object.assign({text: "PIN: 1234"}, ident)));
  await beo.deleteNote(note.id);
  assert.equal(rows.beoNotes.length, 1);

  const hl1 = await beo.addHighlight(Object.assign({page: 0, slot: 1, x: 10, y: 10, w: 40, h: 10}, ident));
  assert.equal(hl1.id, "2026-11-18_339574_2026-11-16_r2_p1_h1");
  await assert.rejects(beo.addHighlight(Object.assign({page: 0, slot: 1, x: 10, y: 10, w: 40, h: 10}, ident)), "a taken slot is refused, as updates are denied");
  await beo.addHighlight(Object.assign({page: 1, slot: 1, x: 10, y: 10, w: 40, h: 10}, ident));
  const stored = await beo.listHighlights("2026-11-18");
  assert.equal(stored.length, 2);
  assert.equal(Notes.highlightsFor(stored, ident, 0).length, 1);
  await beo.deleteHighlight(hl1.id);
  assert.equal((await beo.listHighlights("2026-11-18")).length, 1);

  // locked store (not signed in): nothing reaches Firestore
  const locked = Notes.createBeoStore(null);
  assert.equal(locked.live, false);
  const before = JSON.stringify(rows);
  await assert.rejects(locked.listNotes("2026-11-18"), /Sign in/);
  await assert.rejects(locked.listHighlights("2026-11-18"), /Sign in/);
  await assert.rejects(locked.addNote(Object.assign({text: "x"}, ident)), /Sign in/);
  await assert.rejects(locked.addHighlight(Object.assign({page: 0, slot: 1, x: 1, y: 1, w: 5, h: 5}, ident)), /Sign in/);
  await assert.rejects(locked.deleteNote("n1"), /Sign in/);
  await assert.rejects(locked.deleteHighlight("x"), /Sign in/);
  assert.equal(JSON.stringify(rows), before, "locked store does not write");

  console.log("PASS: Firebase Auth and App Check wiring, notes store, BEO note and highlight builders, highlight math, locked store.");
})().catch(function (e) { console.error(e); process.exit(1); });

// ---- BEO page wiring ----
const beoPage = fs.readFileSync(path.join(repoRoot, "beo-beta.html"), "utf8");
assert.doesNotMatch(beoPage, /firebase|firestore|Sign in with Google|signIn|watchAuth/i, "BEO tab has no Firebase or Google sign-in");
assert.match(beoPage, /scripts\/beo-local-store\.js/);
assert.match(beoPage, /BeoLocal\.createStore/);
assert.match(beoPage, /pointerdown/);
assert.match(beoPage, /pointermove/);
assert.match(beoPage, /pointerup/);
assert.match(beoPage, /pointercancel/);
assert.match(beoPage, /Notes\.highlightFromDrag/);
assert.match(beoPage, /Notes\.hitHighlight|data-hid/);
assert.match(beoPage, /preventDefault/);
assert.match(beoPage, /bb-beo-notes-v1/, "old browser notes are migrated, not dropped");
assert.match(beoPage, /noindex/);
assert.match(beoPage, /127\.0\.0\.1:8765\/beo-beta\.html/, "off-localhost message points at the Mac");
assert.doesNotMatch(beoPage, /setItem\("bb-beo-beta"/, "visiting the page never turns on the side-panel link");
assert.match(beoPage, /beo-originals\/index\.json/);
assert.match(beoPage, /Updated "|Revision " /, "red updates stay");
new Function(beoPage.match(/<script>\s*([\s\S]*?)<\/script>/)[1]); // syntax check
const server = fs.readFileSync(path.join(__dirname, "serve-beo-beta.js"), "utf8");
assert.match(server, /127\.0\.0\.1/, "originals server binds to localhost");
assert.doesNotMatch(server, /0\.0\.0\.0|"::"/);

// ---- Firestore rules: Auth-tied, Jason only, nothing open ----
const rules = fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8");
const ruleCode = rules.split("\n").filter(function (l) { return !/^\s*\/\//.test(l); }).join("\n");
assert.doesNotMatch(ruleCode, /if\s+true/, "no rule may be open (if true)");
assert.doesNotMatch(rules, /TIGHTEN BEFORE TEAM LAUNCH|TEMPORARY|no Auth yet/i, "temporary tester rules are gone");
assert.match(ruleCode, /request\.auth != null/);
assert.match(ruleCode, /request\.auth\.uid == ownerUid\(\)/);
assert.match(ruleCode, /email_verified == true/);
assert.match(ruleCode, /sign_in_provider == 'google\.com'/);
assert.match(ruleCode, /return 'OWNER_UID_NOT_SET';/, "placeholder owner denies everyone until filled in firestore.rules.local");
assert.doesNotMatch(rules, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/i, "no email address in committed rules");
["notes/{noteId}", "beoNotes/{noteId}", "beoHighlights/{highlightId}"].forEach(function (coll) {
  const start = ruleCode.indexOf("match /" + coll);
  assert.ok(start >= 0, coll + " is covered");
  const block = ruleCode.slice(start, ruleCode.indexOf("\n    }\n", start));
  assert.match(block, /allow read: if isOwner\(\);/, coll + " read needs the owner");
  assert.match(block, /allow create: if isOwner\(\)/, coll + " create needs the owner");
  assert.match(block, /allow update: if false;/, coll + " has no updates");
  assert.match(block, /allow delete: if isOwner\(\);/, coll + " delete needs the owner");
  assert.doesNotMatch(block, /allow (read|write|get|list|create|update|delete)[^;]*:\s*if\s+true/);
});
assert.match(ruleCode, /size\(\) <= 500/);
assert.match(ruleCode, /cvv\|cvc\|card number/);
assert.match(ruleCode, /slot <= 50/, "highlight count is bounded");
assert.match(ruleCode, /pct\(request\.resource\.data\.x\)/, "highlight coordinates are bounded");
assert.match(ruleCode, /highlightId == /, "highlight id pins the page and slot");
assert.doesNotMatch(ruleCode, /allow (read|write)[^;]*;[^]*match \/\{/, "no catch-all match");
assert.equal((ruleCode.match(/\ballow\b/g) || []).length, 12, "four allow lines per collection, nothing extra");
const docs = fs.readFileSync(path.join(repoRoot, "docs", "notes-firebase.md"), "utf8");
assert.match(docs, /Nov 21 temporary rules/);
assert.match(docs, /must not stay published/);
assert.match(docs, /App Check/);
assert.match(docs, /not been deployed/);
assert.match(docs, /beoNotes/);
assert.match(docs, /beoHighlights/);

// live Rundown: same source as the rest of the app, unique groups for a known day
const rundownPath = path.join(__dirname, "..", "rundown.html");
if (fs.existsSync(rundownPath)) {
  const live = Notes.collectEvents(helpers(fs.readFileSync(rundownPath, "utf8")), "2026-11-21");
  const names = live.map(function (e) { return e.group; });
  assert.equal(names.length, new Set(names).size, "live Rundown day should not repeat groups");
  assert.ok(live.every(function (e) { return e.date === "2026-11-21" && e.group; }));
  if (live.length) {
    assert.ok(live.some(function (e) { return /Emerson/i.test(e.group); }), "Nov 21 still has Emerson when present on the Rundown");
  }
}

console.log("PASS: Notes tab lists pinned general notes above daily event notes, groups sample notes by person, stays read-only, hides Notes until opt-in, and shows the intro once.");
