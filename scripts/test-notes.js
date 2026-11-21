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
assert.doesNotMatch(page, /firebase|firestore|The Wire/i);
assert.doesNotMatch(page, /<textarea/);
assert.doesNotMatch(page, /Add note|Save note|Delete note|type="password"|name="pin"|payment/i);
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
