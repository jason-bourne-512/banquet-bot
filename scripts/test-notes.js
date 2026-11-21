// Notes tab: date picker events from the Rundown, chronological first-name threads, sample data only.
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
assert.equal(thread.length, 2);
assert.deepEqual(thread.map(function (n) { return n.name; }), ["Lisa", "Jason"]);
assert.ok(thread[0].timeLabel.indexOf("7:05") >= 0);
assert.ok(thread.every(function (n) { return n.name.indexOf(" ") === -1; }), "first name only on notes");

const shuffled = Notes.notesFor([
  Notes.SAMPLE_NOTES[4],
  Notes.SAMPLE_NOTES[3]
], "2026-11-21", "San Jose Barracuda - Meal Room (Plumeria)");
assert.deepEqual(shuffled.map(function (n) { return n.name; }), ["Lisa", "Jason"]);

const packed = Notes.eventsWithNotes(nov21, Notes.SAMPLE_NOTES);
const emerson = packed.find(function (e) { return /Emerson/.test(e.group); });
const barra = packed.find(function (e) { return /Barracuda/.test(e.group); });
assert.equal(emerson.notes.length, 1);
assert.equal(emerson.notes[0].name, "Diana");
assert.equal(barra.notes.length, 2);

// sample data safety: no prices, phones, PINs, or payment fields
const sampleText = JSON.stringify(Notes.SAMPLE_NOTES);
assert(!/\$\d/.test(sampleText), "sample notes must not include prices");
assert(!/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(sampleText), "sample notes must not include phone numbers");
assert(!/\bPIN\b/i.test(sampleText), "sample notes must not mention PINs");
assert(!/card number|cvv|billing/i.test(sampleText));
assert.ok(Notes.SAMPLE_BANNER.toLowerCase().indexOf("sample") >= 0);

// page is read-only and wired to the lib
const page = fs.readFileSync(path.join(__dirname, "..", "notes.html"), "utf8");
assert.match(page, /type="date"/);
assert.match(page, /scripts\/notes-lib\.js/);
assert.match(page, /id="nt-banner"/);
assert.match(page, /nt-card/);
assert.doesNotMatch(page, /firebase|firestore|The Wire/i);
assert.doesNotMatch(page, /<textarea/);
assert.doesNotMatch(page, /Add note|Save note|Delete note|type="password"|name="pin"|payment/i);
new Function(page.match(/<script>\s*([\s\S]*?)<\/script>/)[1]); // syntax check

// side panel and Home point at the tab
const desktop = fs.readFileSync(path.join(__dirname, "..", "desktop.js"), "utf8");
assert.match(desktop, /href="notes\.html"/);
assert.match(desktop, />Notes<\/a>/);
const home = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.match(home, /href="notes\.html"/);
assert.match(home, />NOTES</);

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

console.log("PASS: Notes tab lists Rundown groups by date, shows chronological first-name sample threads, and stays read-only.");
