// Pre-shift scripts: analysis, spoken server script, questions for the manager.
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

function allText(m) {
  return [
    (m.lines || []).map(function (l) { return l.text; }).join(" "),
    (m.analysis || []).map(function (l) { return l.text; }).join(" "),
    (m.script || []).map(function (l) { return l.text; }).join(" "),
    (m.questions || []).map(function (q) { return q.who + " " + q.q; }).join(" "),
    JSON.stringify(m)
  ].join(" ");
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
assert.ok(priced.script && priced.script.length, "generic meal gets a spoken script");
assert.ok(priced.analysis && priced.analysis.length, "generic meal gets analysis");
const pricedText = allText(priced);
assert(!/\$\d/.test(pricedText), "prices must not appear in script");
assert(!/[\u2014\u2013]/.test(pricedText), "em/en dashes must not appear");
assert.ok(priced.script.some(function (l) { return /later slots/i.test(l.text); }), "generic script keeps later slots");
assert.ok(!priced.questions.some(function (q) { return /section/i.test(q.q); }), "do not ask section assignments now");

// Collect from fixture as of Nov 20
const meals = PreShift.collectPlated(helpers("2026-11-20"));
assert.equal(meals.length, 2, "expect rich Emerson + sparse TSAE; skip buffet boilerplate and past day");

const rich = meals.find(function (m) { return /Emerson/i.test(m.group); });
const sparse = meals.find(function (m) { return /TSAE/i.test(m.group); });
assert.ok(rich, "rich plated meal present");
assert.ok(sparse, "sparse plated meal present");

// Required section labels present on every script inventory
const REQUIRED = [
  "Counts", "Entree", "Allergies / dietary", "Vendor / staff meals",
  "Doors / apps / seating", "Program / speeches", "Who calls courses",
  "Kitchen fire times", "Pre-sets", "Wine / bar", "Server sections",
  "Named staffing / duties",
  "Head table", "Serve / clear", "Expo line order", "Covers / trays / jacks",
  "Coffee / decaf"
];
meals.forEach(function (m) {
  const labels = m.lines.map(function (l) { return l.label; });
  REQUIRED.forEach(function (lab) {
    assert.ok(labels.indexOf(lab) >= 0, m.group + " missing section: " + lab);
  });
  assert.equal(m.mgr, "Diana");
  const blob = allText(m);
  assert(!/\$\d/.test(blob), "no prices in " + m.group);
  assert(!/[\u2014\u2013]/.test(blob), "no dashes in " + m.group);
  assert(!/cannot fail/i.test(blob), "do not put the VIP pressure note on the public page");
  assert.ok(m.analysis && m.analysis.length, m.group + " needs analysis");
  assert.ok(m.script && m.script.length, m.group + " needs a spoken script");
  assert.ok(m.script.some(function (l) { return /later slots/i.test(l.text); }), m.group + " script should mark later slots");
  const sec = m.lines.find(function (l) { return l.label === "Server sections"; });
  assert.ok(sec && sec.later, m.group + " server sections should be a later slot");
  assert.ok(/later/i.test(sec.text), m.group + " server sections text should say later");
  const duties = m.lines.find(function (l) { return l.label === "Named staffing / duties"; });
  assert.ok(duties && duties.later, m.group + " named staffing should be a later slot");
  m.questions.forEach(function (q) {
    assert.equal(q.who, "Diana", "questions go to the event manager, got " + q.who + " for " + q.q);
    assert.ok(q.q && q.q.length > 5, "empty question");
    assert.ok(!/how are server sections assigned/i.test(q.q), "no section-assignment question");
  });
});

// Rich: known facts filled
assert.match(rich.lines.find(function (l) { return l.label === "Counts"; }).text, /Guarantee 73/);
assert.match(rich.lines.find(function (l) { return l.label === "Entree"; }).text, /Filet|Entrees/i);
assert.match(rich.lines.find(function (l) { return l.label === "Allergies \/ dietary"; }).text, /gluten|mushroom/i);
assert.match(rich.lines.find(function (l) { return l.label === "Wine \/ bar"; }).text, /wine|client/i);
assert.ok(rich.lines.find(function (l) { return l.label === "Pre-sets"; }).known);
assert.equal(rich.contact, "Lynn");

// Analysis covers timeline, set, conflicts, storage, AV
const anal = rich.analysis.map(function (a) { return a.label + ": " + a.text; }).join(" | ");
assert.match(anal, /Timeline|4:00|6:45/);
assert.match(anal, /Set \/ diagram|rounds/);
assert.ok(rich.analysis.some(function (a) { return a.kind === "flag" && /rounds of 9|7 to 11/i.test(a.text); }), "dinner window or set conflict flagged");
assert.ok(rich.analysis.some(function (a) { return a.kind === "flag" && /event order wins/i.test(a.text); }), "conflicts say EO wins");
assert.match(anal, /Camellia B|Storage|pickup/i);
assert.match(anal, /podium|stage|AV/i);

// Spoken Emerson script
const richScript = rich.script.map(function (l) { return l.text; }).join(" ");
assert.match(richScript, /Guarantee is 73/);
assert.match(richScript, /9 rounds of 9/);
assert.match(richScript, /colored dot/);
assert.match(richScript, /medium rare/);
assert.match(richScript, /Do not clear dessert/);
assert.match(richScript, /\[ask\]/);
assert.match(richScript, /later slots/);
assert.ok(rich.questions.some(function (q) { return /passer/i.test(q.q); }));
assert.ok(rich.questions.some(function (q) { return /chicken sides/i.test(q.q); }));

// Sparse TSAE
assert.ok(sparse.questions.length >= 3, "sparse meal should ask several questions, got " + sparse.questions.length);
const doors = sparse.lines.find(function (l) { return l.label === "Doors / apps / seating"; });
assert.ok(doors && doors.known, "sparse should know doors/service from EO");
assert.match(doors.text, /12/);
const head = sparse.lines.find(function (l) { return l.label === "Head table"; });
assert.equal(head.text, "[ask]");
assert.ok(sparse.questions.some(function (q) { return /head table/i.test(q.q); }));
const calls = sparse.lines.find(function (l) { return l.label === "Who calls courses"; });
assert.equal(calls.text, "[ask]");
assert.ok(sparse.questions.some(function (q) { return /calls/i.test(q.q); }));
const sparseScript = sparse.script.map(function (l) { return l.text; }).join(" ");
assert.match(sparseScript, /chef's choice/i);
assert.match(sparseScript, /12:20/);
assert.match(sparseScript, /38 rounds of 8/);
assert.match(sparseScript, /\[ask\]/);
assert.match(sparseScript, /later slots/);
assert.ok(sparse.analysis.some(function (a) { return a.kind === "flag" && /rounds of 10|rounds of 7/i.test(a.text); }), "TSAE set conflict flagged");
assert.ok(sparse.questions.some(function (q) { return /chef'?s-?choice|actual/i.test(q.q); }));

// Past day excluded
assert.ok(!meals.some(function (m) { return /Old Plated/i.test(m.group); }));

// Live rundown, if present: both upcoming plated meals build three-part output
const rundownPath = path.join(__dirname, "..", "rundown.html");
if (fs.existsSync(rundownPath)) {
  const rhtml = fs.readFileSync(rundownPath, "utf8");
  const $r = load(rhtml);
  const live = PreShift.collectPlated({
    todayISO: "2026-11-20",
    sections: $r(".day-section").toArray(),
    txt: function (el) { return el ? PreShift.clean($r(el).text().replace(/\s+/g, " ")) : ""; },
    qs: function (el, sel) { const n = $r(el).find(sel).first(); return n.length ? n.get(0) : null; },
    qsa: function (el, sel) { return $r(el).find(sel).toArray(); },
    attr: function (el, name) { return $r(el).attr(name) || ""; }
  });
  const em = live.find(function (m) { return /Emerson/i.test(m.group); });
  const ts = live.find(function (m) { return /TSAE/i.test(m.group); });
  assert.ok(em, "live rundown should include Emerson from Nov 20");
  assert.ok(ts, "live rundown should include TSAE from Dec 4");
  assert.ok(em.script.length && em.analysis.length && em.questions.length, "live Emerson is complete");
  assert.ok(ts.script.length && ts.analysis.length && ts.questions.length, "live TSAE is complete");
  assert(!/\$\d/.test(allText(em) + allText(ts)), "no prices from live rundown");
  assert(!/cannot fail/i.test(allText(em)), "VIP pressure stays off the public script");
  assert.ok(em.packet && !em.packet.diagram.missing && ts.packet && !ts.packet.diagram.missing);
  assert.ok(em.packet.steps.some(function (s) { return s.label === "MOBILE COFFEE"; }));
  assert.ok(ts.packet.steps.some(function (s) { return s.label === "MOBILE COFFEE"; }));
  assert(!/[\u2014\u2013]/.test(JSON.stringify(em.packet) + JSON.stringify(ts.packet)), "no dashes in live packets");
}

// Syntax-check the page script if present
const pagePath = path.join(__dirname, "..", "pre-shift.html");
if (fs.existsSync(pagePath)) {
  const html = fs.readFileSync(pagePath, "utf8");
  const m = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  if (m) new Function(m[1]);
}


// Server packet, duty split, mobile coffee
const split2 = PreShift.splitDuties(2);
assert.deepEqual(split2[0].opening, [
  "Coffee trays (4)", "Bread baskets", "Brew tea/coffee", "Fold napkins",
  "Coffee cart and table", "Fill regular and decaf urns", "Cups, cream, sugar, lemons"
]);
assert.deepEqual(split2[0].closing, ["Sweep/mop", "Beverage station", "Strike coffee cart"]);
assert.deepEqual(split2[1].opening, ["Breakdown stations", "Hotbox stations", "Dressings", "Butters", "Waters"]);
assert.deepEqual(split2[1].closing, ["Trash", "Plates to dish"]);
const split3 = PreShift.splitDuties(3);
assert.equal(split3.length, 3);
assert.equal(split3.map(function (t) { return t.opening.length; }).reduce(function (a, b) { return a + b; }, 0), PreShift.OPENING_DUTIES.length);
assert.ok(PreShift.OPENING_DUTIES.indexOf("Fold napkins") >= 0);

meals.forEach(function (m) {
  const p = m.packet;
  assert.ok(p, m.group + " missing server packet");
  assert.ok(p.teams.every(function (t) { return t.names.every(function (n) { return !n; }); }), m.group + " must not hardcode staff names");
  assert.ok(!/Maricruz|Carlos|Tomas|Francisco/.test(JSON.stringify(p)));
  const coffee = p.steps.find(function (s) { return s.label === "MOBILE COFFEE"; });
  assert.ok(coffee, m.group + " missing mobile coffee step");
  assert.equal(coffee.time, "By dessert");
  assert.ok(coffee.items.some(function (it) { return /regular and decaf/i.test(it); }));
  assert.ok(coffee.items.some(function (it) { return /cups, cream, sugar/i.test(it); }));
  assert.ok(coffee.items.some(function (it) { return /not from the back/i.test(it); }));
  assert.ok(coffee.owners && coffee.owners.length && coffee.owners.every(function (o) { return !o; }), "who runs coffee stays blank");
  assert.ok(m.script.some(function (l) { return /Mobile coffee/i.test(l.text); }));
  assert.ok(m.script.some(function (l) { return /where the cart goes/i.test(l.text); }));
  assert(!/[\u2014\u2013]/.test(JSON.stringify(p)), "no dashes in packet for " + m.group);
});

assert.equal(rich.packet.location, "Camellia B");
assert.ok(rich.packet.steps.some(function (s) { return s.label === "PASS APPS" && /6:00/.test(s.time); }));
assert.ok(rich.packet.steps.some(function (s) { return /GUESTS ENTER/i.test(s.label) && /6:45/.test(s.time); }));
assert.ok(rich.packet.diagram && !rich.packet.diagram.missing);
assert.ok(rich.packet.diagram.images.some(function (img) { return /g_PrimroseCfromEmerson/.test(img); }));
assert.equal(rich.packet.tableCount, 9);

assert.ok(sparse.packet.diagram && !sparse.packet.diagram.missing);
assert.match(sparse.packet.diagram.path, /PRIMROSEBALLROOMfromTSAE/);
assert.ok(!/PREFUNCTION/i.test(sparse.packet.diagram.path));
assert.equal(sparse.packet.tableCount, 38);

const bare = PreShift.buildPreShift({ group: "Future Lunch", tag: "Plated Lunch", menu: "Plated Lunch", foot: {}, counts: { gtd: "20" } });
assert.ok(bare.packet.diagram.missing, "no diagram should be a placeholder, not an invented layout");
assert.ok(bare.script.some(function (l) { return /Mobile coffee/i.test(l.text); }));

console.log("PASS: analysis, spoken scripts, later slots, questions for the manager, no prices or dashes. Meals:", meals.map(function (m) { return m.group; }).join(" | "));
