// Site search: events can be found by BEO number, with or without a BEO or # prefix.
// No server, browser, or network. Loads search.js in a small stub and queries a fixture index.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const Privacy = require("./contact-privacy.js");

function el() {
  return { textContent: "", style: {}, className: "", appendChild: function () {}, addEventListener: function () {}, replaceChildren: function () {}, dispatchEvent: function () {}, querySelector: function () { return null; } };
}
const document = {
  createElement: function () { return el(); },
  head: { appendChild: function () {} },
  body: el(),
  readyState: "complete",
  addEventListener: function () {},
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  createTreeWalker: function () { return { nextNode: function () { return null; } }; }
};
const window = { document: document, dispatchEvent: function () {}, addEventListener: function () {} };
const context = {
  window: window,
  document: document,
  location: { search: "", pathname: "/" },
  Event: Event,
  URLSearchParams: URLSearchParams,
  Intl: Intl,
  fetch: function () { return Promise.reject(new Error("no network in search tests")); },
  localStorage: { getItem: function () { return null; } },
  NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
  console: console
};
context.window = window;
context.document = document;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "search.js"), "utf8"), context);
const bb = context.window.bbSearch;
assert.ok(bb && typeof bb.hits === "function", "search.js should export hits for tests");

const roadrunners = {
  type: "event",
  date: "2026-11-24",
  title: "Tucson Roadrunners — Team Meeting (Camellia)",
  meta: "Camellia",
  time: "8:00 AM– 1:00 PM",
  text: "Tucson Roadrunners — Team Meeting (Camellia) MGR: Lisa NOTE Tucson Roadrunners Nov2026 / event order 532563 (11/17 packet)",
  url: "rundown.html?date=2026-11-24",
  anchor: "Tucson Roadrunners — Team Meeting (Camellia)"
};
const strata = {
  type: "event",
  date: "2026-09-21",
  title: "STRATA conference",
  meta: "Primrose CD",
  time: "9:30 AM",
  text: "NOTE BEO #017235: Primrose CD setup now begins 9:30 AM",
  url: "rundown.html?date=2026-09-21",
  anchor: "STRATA conference"
};
const twoBeos = {
  type: "event",
  date: "2026-11-24",
  title: "Two function group",
  meta: "Verbena",
  time: "10:00 AM",
  text: "NOTE Boots & Bling Gala Oct2026 / event order 111111/222222 (10/20 packet)",
  url: "rundown.html?date=2026-11-24",
  anchor: "Two function group"
};
const mutotech = {
  type: "event",
  date: "2026-12-05",
  title: "Muto Technology — Holiday Party (Primrose D)",
  meta: "Primrose D",
  time: "5:00– 9:00 PM",
  text: "NOTE Mutotech Holiday Party Dec2026 / event orders 815221, 815184 (11/17 packet)",
  url: "rundown.html?date=2026-12-05",
  anchor: "Muto Technology — Holiday Party (Primrose D)"
};
const noBeo = {
  type: "event",
  date: "2026-11-27",
  title: "Ginger Allure MedSpa — Holiday Party",
  meta: "Primrose ABC",
  time: "9:00 AM– 5:00 PM",
  text: "NOTE No BEO yet · from the 21 Days Out report (printed 11/23) · Prospect, not confirmed yet",
  url: "rundown.html?date=2026-11-27",
  anchor: "Ginger Allure MedSpa — Holiday Party"
};
const menu = {
  type: "menu",
  title: "All About Texas Hosted Bar",
  items: ["Tito's", "Seersucker Gin"],
  text: "All About Texas Hosted Bar Tito's Seersucker Gin",
  url: "menu.html",
  anchor: "All About Texas Hosted Bar"
};
const fireman = {
  type: "menu",
  title: "Host Bar",
  items: ["Fireman's #4"],
  text: "Host Bar Fireman's #4",
  url: "menu.html",
  anchor: "Host Bar"
};
const meats = {
  type: "menu",
  title: "Charcuterie",
  items: ["4 Charcuterie Meats"],
  text: "Charcuterie 4 Charcuterie Meats",
  url: "menu.html",
  anchor: "Charcuterie"
};
const index = [roadrunners, strata, twoBeos, mutotech, noBeo, menu, fireman, meats];

function titles(q) { return bb.hits(index, q).map(function (x) { return x.title; }); }

assert.deepEqual(titles("532563"), [roadrunners.title], "bare number finds event order 532563");
assert.deepEqual(titles("BEO 532563"), [roadrunners.title], "BEO 532563 finds event order 532563");
assert.deepEqual(titles("BEO #532563"), [roadrunners.title], "BEO #532563 finds event order 532563");
assert.deepEqual(titles("#532563"), [roadrunners.title], "#532563 finds event order 532563");
assert.deepEqual(titles("eo 532563"), [roadrunners.title], "eo 532563 finds event order 532563");
assert.deepEqual(titles("event order 532563"), [roadrunners.title], "event order 532563 still finds it");
assert.deepEqual(titles("5325"), [roadrunners.title], "partial number 5325 finds 532563");
assert.deepEqual(titles("BEO#532563"), [roadrunners.title], "BEO#532563 with no space finds it");

assert.deepEqual(titles("017235"), [strata.title], "bare 017235 finds BEO #017235");
assert.deepEqual(titles("BEO 017235"), [strata.title], "BEO 017235 finds BEO #017235");
assert.deepEqual(titles("#017235"), [strata.title], "#017235 finds BEO #017235");
assert.deepEqual(titles("17235"), [strata.title], "17235 without the leading zero finds 017235");

assert.deepEqual(titles("111111"), [twoBeos.title], "first of two event orders");
assert.deepEqual(titles("BEO 222222"), [twoBeos.title], "second of two event orders, with BEO prefix");

assert.equal(titles("532563").indexOf(noBeo.title), -1, "a card with no BEO number is not a false hit");
assert.deepEqual(titles("Tucson"), [roadrunners.title], "group name search is unchanged");
assert.deepEqual(titles("Hosted Bar").filter(function (t) { return t === menu.title; }), [menu.title], "menu search is unchanged");
assert.deepEqual(titles("BEO"), [strata.title, noBeo.title], "BEO alone still matches the word BEO, not every event");
assert.deepEqual(titles("#4"), [fireman.title], "#4 still finds Fireman's #4 and does not also match '4 Charcuterie Meats'");

assert.equal(titles("BEO 2026").indexOf(mutotech.title), -1, "BEO 2026 does not match a Dec2026 note");
assert.deepEqual(titles("BEO 815221"), [mutotech.title], "BEO 815221 finds event orders 815221, 815184");
assert.deepEqual(titles("BEO 815184"), [mutotech.title], "BEO 815184 finds the second number in the list");
assert.deepEqual(titles("#815184"), [mutotech.title], "#815184 finds the second number in the list");
assert.deepEqual(titles("event order 815221"), [mutotech.title], "event order 815221 finds a plural event orders list");
assert.deepEqual(titles("BEO 8152"), [mutotech.title], "partial prefixed number BEO 8152 finds 815221");
assert.deepEqual(titles("815184"), [mutotech.title], "bare second event order still matches");


const hiddenHtml = '<div class="event-card"><div class="card-group">Hidden Contact Group</div><span class="badge badge-mgr">MGR: Lisa</span><span class="badge badge-ic">IC: Laura</span><div class="foot-row"><span class="foot-key">CONTACT</span><span class="foot-val">Laura 512-555-1234 jane@client.com</span></div><div class="foot-row"><span class="foot-key">NOTE</span><span class="foot-val">event order 644111 · Check with Laura</span></div></div>';
const hiddenEvent = {
  type: "event",
  date: "2026-12-01",
  title: "Hidden Contact Group",
  meta: "Camellia",
  time: "9:00 AM",
  text: Privacy.cardSearchText(hiddenHtml),
  url: "rundown.html?date=2026-12-01",
  anchor: "Hidden Contact Group"
};
index.push(hiddenEvent);
assert.deepEqual(titles("644111"), [hiddenEvent.title], "BEO number on a redacted card is still searchable");
assert.equal(titles("Laura").indexOf(hiddenEvent.title), -1, "client contact name is not searchable");
assert.equal(titles("512-555-1234").indexOf(hiddenEvent.title), -1, "personal phone is not searchable");
assert.equal(titles("jane@client.com").indexOf(hiddenEvent.title), -1, "personal email is not searchable");
assert.ok(titles("Lisa").indexOf(hiddenEvent.title) > -1 || titles("Hidden Contact Group").indexOf(hiddenEvent.title) > -1, "staff name or group name still finds the card");

console.log("PASS: site search finds events by BEO number, with or without a BEO or # prefix, including partial numbers.");
console.log("PASS: site search hides client contact names, phones, and emails.");
