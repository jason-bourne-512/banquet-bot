// Pre-shift scripts: plated detection, script sections, questions for missing fields.
// No server, browser, or network. Fixture under scripts/fixtures/.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { load } = require("cheerio");
const PreShift = require("./pre-shift-lib.js");

const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "pre-shift-plated.html"), "utf8");
const $ = load(fixture);

function helpers(todayISO) {
  return {
    todayISO: todayISO,
    sections: $(".day-section").toArray(),
    txt: function (el) { return el ? PreShift.clean($(el).text().replace(/\s+/g, " ")) : ""; },
    qs: function (el, sel) { const n = $(el).find(sel).first(); return n.length ? n.get(0) : null; },
    qsa: function (el, sel) { return $(el).find(sel).toArray(); },
    attr: function (el, name) { return $(el).attr(name) || ""; }
  };
}

// Unit: isPlated
assert.equal(PreShift.isPlated("Plated Dinner", "anything"), true);
assert.equal(PreShift.isPlated("Lunch", "Chef's Choice Plated Lunch"), true);
assert.equal(PreShift.isPlated("Breakfast Buffet", "All plated breakfasts served with pastries"), false);
assert.equal(PreShift.isPlated("Coffee Break", "snacks"), false);
assert.equal(PreShift.isPlated("Lunch Buffet", "buffet only"), false);

// Unit: no prices / no em dashes in builder
const priced = PreShift.buildPreShift({
  group: "Test",
  tag: "Plated Lunch",
  menu: "Plated Lunch $49.50/pp \u2014 chicken @ $12",
  counts: { gtd: "10", set: "12" },
  foot: {}
});
const allText = priced.lines.map(function (l) { return l.text; }).join(" ");
assert(!/\$\d/.test(allText), "prices must not appear in script");
assert(!/[\u2014\u2013]/.test(allText), "em/en dashes must not appear");

// Collect from fixture as of Nov 20
const meals = PreShift.collectPlated(helpers("2026-11-20"));
assert.equal(meals.length, 2, "expect rich Emerson + sparse TSAE; skip buffet boilerplate and past day");

const rich = meals.find(function (m) { return /Emerson/i.test(m.group); });
const sparse = meals.find(function (m) { return /TSAE/i.test(m.group); });
assert.ok(rich, "rich plated meal present");
assert.ok(sparse, "sparse plated meal present");

// Required section labels present on every script
const REQUIRED = [
  "Counts", "Entree", "Allergies / dietary", "Vendor / staff meals",
  "Doors / apps / seating", "Program / speeches", "Who calls courses",
  "Kitchen fire times", "Pre-sets", "Wine / bar", "Server sections",
  "Head table", "Serve / clear", "Expo line order", "Covers / trays / jacks",
  "Coffee / decaf"
];
meals.forEach(function (m) {
  const labels = m.lines.map(function (l) { return l.label; });
  REQUIRED.forEach(function (lab) {
    assert.ok(labels.indexOf(lab) >= 0, m.group + " missing section: " + lab);
  });
  assert.equal(m.mgr, "Diana");
  assert(!/\$\d/.test(JSON.stringify(m)), "no prices in " + m.group);
  assert(!/[\u2014\u2013]/.test(JSON.stringify(m)), "no dashes in " + m.group);
});

// Rich: known facts filled
assert.match(rich.lines.find(function (l) { return l.label === "Counts"; }).text, /Guarantee 73/);
assert.match(rich.lines.find(function (l) { return l.label === "Entree"; }).text, /Filet|Entrees/i);
assert.match(rich.lines.find(function (l) { return l.label === "Allergies \/ dietary"; }).text, /gluten|mushroom/i);
assert.match(rich.lines.find(function (l) { return l.label === "Wine \/ bar"; }).text, /wine|client/i);
assert.ok(rich.lines.find(function (l) { return l.label === "Pre-sets"; }).known);

// Sparse: missing fields produce questions addressed to Hector / Diana / Lisa
assert.ok(sparse.questions.length >= 3, "sparse meal should ask several questions, got " + sparse.questions.length);
const whos = {};
sparse.questions.forEach(function (q) {
  assert.ok(/^(Hector|Diana|Lisa)$/.test(q.who), "bad ask target: " + q.who);
  whos[q.who] = 1;
  assert.ok(q.q && q.q.length > 5, "empty question");
});
assert.ok(whos.Hector || whos.Diana || whos.Lisa, "questions must name Hector, Diana, or Lisa");

// Sparse chef's choice known doors/service from menu/note
const doors = sparse.lines.find(function (l) { return l.label === "Doors / apps / seating"; });
assert.ok(doors && doors.known, "sparse should know doors/service from EO");
assert.match(doors.text, /12/);

// Unknown head table / who calls on sparse -> [ask] + question
const head = sparse.lines.find(function (l) { return l.label === "Head table"; });
assert.equal(head.text, "[ask]");
assert.ok(sparse.questions.some(function (q) { return /head table/i.test(q.q); }));
const calls = sparse.lines.find(function (l) { return l.label === "Who calls courses"; });
assert.equal(calls.text, "[ask]");
assert.ok(sparse.questions.some(function (q) { return /calls/i.test(q.q); }));

// Past day excluded
assert.ok(!meals.some(function (m) { return /Old Plated/i.test(m.group); }));

// Syntax-check the page script if present
const pagePath = path.join(__dirname, "..", "pre-shift.html");
if (fs.existsSync(pagePath)) {
  const html = fs.readFileSync(pagePath, "utf8");
  const m = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  if (m) new Function(m[1]);
}

console.log("PASS: plated detection, script sections, questions for missing fields, no prices or dashes. Meals:", meals.map(function (m) { return m.group; }).join(" | "));
