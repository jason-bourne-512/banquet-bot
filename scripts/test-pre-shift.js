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
assert.ok(priced.script.some(function (l) { return l.text.indexOf(PreShift.ALLERGY_CAPTAIN_DROP) >= 0; }), "generic script includes allergy drop rule");
assert.ok((priced.packet.specials || []).some(function (s) { return s.text === PreShift.ALLERGY_CAPTAIN_DROP; }));
assert.ok(priced.script.some(function (l) { return /\[ask\].*wine needs to be chilled/i.test(l.text); }), "generic wine line asks if chilling is needed");
assert.equal(priced.script[0].text, PreShift.CORKBOARD_SCRIPT, "generic script starts by pinning the corkboard");
assert.ok(priced.script.some(function (l) { return /later slots/i.test(l.text); }), "generic script keeps later slots");
assert.equal(priced.packet.steps[0].label, "PIN THE CORKBOARD");
assert.ok(!priced.questions.some(function (q) { return /section/i.test(q.q); }), "do not ask section assignments now");
const pricedCue = priced.questions.find(function (q) { return /strictly on the timeline/i.test(q.q); });
assert.ok(pricedCue, "generic plated meal still asks the contact about timeline vs cue");
assert.equal(pricedCue.who, "the contact");
assert.ok(priced.script.some(function (l) { return /\[ask\].*strictly on the timeline/i.test(l.text); }));

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
  assert.equal(m.script[0].text, PreShift.CORKBOARD_SCRIPT, m.group + " script should start by pinning the corkboard");
  assert.match(m.script[0].text, /event order/);
  assert.match(m.script[0].text, /section diagram/);
  assert.match(m.script[0].text, /timeline/);
  assert.match(m.script[0].text, /server packet/);
  assert.equal(m.packet.steps[0].label, "PIN THE CORKBOARD");
  assert.equal(m.packet.steps[0].time, "Before pre-shift");
  assert.deepEqual(m.packet.steps[0].items, ["Event order", "Section diagram", "Timeline", "Server packet"]);
  const sec = m.lines.find(function (l) { return l.label === "Server sections"; });
  assert.ok(sec && sec.later, m.group + " server sections should be a later slot");
  assert.ok(/later/i.test(sec.text), m.group + " server sections text should say later");
  const duties = m.lines.find(function (l) { return l.label === "Named staffing / duties"; });
  assert.ok(duties && duties.later, m.group + " named staffing should be a later slot");
  m.questions.forEach(function (q) {
    const cueQ = /strictly on the timeline/i.test(q.q);
    if (cueQ) {
      const expect = /Emerson|TSAE/i.test(m.group) ? "the contact" : q.who;
      assert.equal(q.who, expect, "timeline-vs-cue question goes to the event contact, got " + q.who + " for " + m.group);
    } else {
      assert.equal(q.who, "Diana", "questions go to the event manager, got " + q.who + " for " + q.q);
    }
    assert.ok(q.q && q.q.length > 5, "empty question");
    assert.ok(!/how are server sections assigned/i.test(q.q), "no section-assignment question");
    assert(!/[\u2014\u2013]/.test(q.q), "no dashes in questions");
  });
  const cueAsk = m.questions.find(function (q) { return /strictly on the timeline/i.test(q.q); });
  assert.ok(cueAsk, m.group + " should ask the contact about timeline vs cue");
  assert.match(cueAsk.q, /waiting for a cue/);
  assert.match(cueAsk.q, /what cue, from who/);
  assert.ok(m.script.some(function (l) { return /\[ask\].*strictly on the timeline/i.test(l.text) || /strictly on the timeline, or waiting for a cue/i.test(l.text); }), m.group + " spoken script needs the course-calling cue [ask]");
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
  assert.equal(em.script[0].text, PreShift.CORKBOARD_SCRIPT);
  assert.equal(ts.script[0].text, PreShift.CORKBOARD_SCRIPT);
  assert.equal(em.packet.steps[0].label, "PIN THE CORKBOARD");
  assert.equal(ts.packet.steps[0].label, "PIN THE CORKBOARD");
  assert.ok(em.script.some(function (l) { return l.text.indexOf(PreShift.ALLERGY_CAPTAIN_DROP) >= 0; }));
  assert.ok(ts.script.some(function (l) { return l.text.indexOf(PreShift.ALLERGY_CAPTAIN_DROP) >= 0; }));
  assert.ok((em.packet.specials || []).some(function (s) { return s.text === PreShift.ALLERGY_CAPTAIN_DROP; }));
  const emOpen = em.packet.teams.reduce(function (a, tm) { return a.concat(tm.opening || []); }, []);
  assert.ok(emOpen.indexOf("Chill the white wine") >= 0, "live Emerson opening duties include chill the white wine");
  assert.ok(ts.script.some(function (l) { return /\[ask\].*wine needs to be chilled/i.test(l.text); }));
  const emCue = em.questions.find(function (q) { return /strictly on the timeline/i.test(q.q); });
  const tsCue = ts.questions.find(function (q) { return /strictly on the timeline/i.test(q.q); });
  assert.ok(emCue && emCue.who === "the contact", "live Emerson cue question goes to the contact, not the client name");
  assert.ok(tsCue && tsCue.who === "the contact", "live TSAE cue question goes to the contact, not the client name");
  assert.ok(em.script.some(function (l) { return /\[ask\].*strictly on the timeline/i.test(l.text); }));
  assert.ok(ts.script.some(function (l) { return /\[ask\].*strictly on the timeline/i.test(l.text); }));
  assert(!/\$\d/.test(allText(em) + allText(ts)), "no prices from live rundown");
  assert(!/cannot fail/i.test(allText(em)), "VIP pressure stays off the public script");
  assert.ok(em.packet && !em.packet.diagram.missing && ts.packet && !ts.packet.diagram.missing);
  assert.ok(em.packet.steps.some(function (s) { return s.label === "MOBILE COFFEE"; }));
  assert.ok(ts.packet.steps.some(function (s) { return s.label === "MOBILE COFFEE"; }));
  assert(!/[\u2014\u2013]/.test(JSON.stringify(em.packet) + JSON.stringify(ts.packet)), "no dashes in live packets");
  assert.equal(em.packet.teams.length, 2, "live Emerson 73 guests -> 2 teams");
  assert.equal(ts.packet.teams.length, 7, "live TSAE 300 guests -> 7 teams");
  assert.equal(em.packet.location, "", "live Emerson storage must not prefill breakdown/hotbox");
  assert.equal(ts.packet.location, "");
  assert.equal(em.packet.seatsPerTable, 9, "live Emerson seats from EO rounds of 9");
  assert.equal(ts.packet.seatsPerTable, 8, "live TSAE seats from EO rounds of 8");
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
assert.deepEqual(split2[0].opening.slice(0, 7), [
  "Coffee trays (4)", "Bread baskets", "Brew tea/coffee", "Fold napkins",
  "Coffee cart and table", "Fill regular and decaf urns", "Cups, cream, sugar, lemons"
]);
assert.deepEqual(split2[0].closing.slice(0, 3), ["Sweep/mop", "Beverage station", "Strike coffee cart"]);
assert.deepEqual(split2[1].opening.slice(0, 5), ["Breakdown stations", "Hotbox stations", "Dressings", "Butters", "Waters"]);
assert.deepEqual(split2[1].closing.slice(0, 2), ["Trash", "Plates to dish"]);
// Two teams still cover the whole master chart
assert.equal(split2[0].opening.length + split2[1].opening.length, PreShift.OPENING_DUTIES.length);
assert.equal(split2[0].closing.length + split2[1].closing.length, PreShift.CLOSING_DUTIES.length);
const split3 = PreShift.splitDuties(3);
assert.equal(split3.length, 3);
assert.equal(split3.map(function (t) { return t.opening.length; }).reduce(function (a, b) { return a + b; }, 0), PreShift.OPENING_DUTIES.length);
assert.ok(PreShift.OPENING_DUTIES.indexOf("Fold napkins") >= 0);

meals.forEach(function (m) {
  const p = m.packet;
  assert.ok(p, m.group + " missing server packet");
  assert.ok(p.teams.every(function (t) { return t.names.length === 2 && t.names.every(function (n) { return !n; }); }), m.group + " must have two empty name blanks");
  assert.ok(!/Maricruz|Carlos|Tomas|Francisco/.test(JSON.stringify(p)));
  const coffee = p.steps.find(function (s) { return s.label === "MOBILE COFFEE"; });
  assert.ok(coffee, m.group + " missing mobile coffee step");
  assert.equal(coffee.time, "By dessert");
  assert.ok(coffee.items.some(function (it) { return /regular and decaf/i.test(it); }));
  assert.ok(coffee.items.some(function (it) { return /cups, cream, sugar/i.test(it); }));
  assert.ok(coffee.items.some(function (it) { return /not from the back/i.test(it); }));
  assert.ok(coffee.owners && coffee.owners.length && coffee.owners.every(function (o) { return !o; }), "who runs coffee stays blank");
  assert.ok(!m.script.some(function (l) { return /Mobile coffee/i.test(l.text); }), "coffee cart is an opening duty, not pre-shift talk");
  assert.ok(m.script.some(function (l) { return l.text.indexOf(PreShift.ALLERGY_CAPTAIN_DROP) >= 0; }), m.group + " script should say Jason drops severe allergy plates");
  assert.ok(!/Bourne/.test(allText(m)), "first names only");
  assert.ok((m.packet.specials || []).some(function (s) { return s.text === PreShift.ALLERGY_CAPTAIN_DROP; }), m.group + " packet should include the allergy drop rule");
  const openings = (m.packet.teams || []).reduce(function (arr, tm) { return arr.concat(tm.opening || []); }, []);
  if (/Emerson/i.test(m.group)) {
    assert.ok(openings.indexOf("Chill the white wine") >= 0, "Emerson opening duties include chilling the white wine");
    assert.ok(m.script.some(function (l) { return /White wine needs to be chilled/i.test(l.text) && /side work/i.test(l.text) && !/\[ask\].*chill/i.test(l.text); }));
  }
  if (/TSAE/i.test(m.group)) {
    assert.ok(openings.every(function (d) { return !/^Chill the /i.test(d); }), "TSAE has no wine on the EO, so no chill duty yet");
    assert.ok(m.script.some(function (l) { return /\[ask\].*wine needs to be chilled/i.test(l.text); }));
  }
  assert(!/[\u2014\u2013]/.test(JSON.stringify(p)), "no dashes in packet for " + m.group);
});

assert.equal(rich.packet.location, "", "storage room must not prefill breakdown/hotbox");
assert.ok(!/Camellia A/i.test(rich.packet.location || ""), "do not hardcode Camellia A");
assert.ok(rich.packet.steps.some(function (s) { return s.label === "PASS APPS" && /6:00/.test(s.time); }));
assert.ok(rich.packet.steps.some(function (s) { return /GUESTS ENTER/i.test(s.label) && /6:45/.test(s.time); }));
assert.ok(rich.packet.diagram && !rich.packet.diagram.missing);
assert.ok(rich.packet.diagram.images.some(function (img) { return /g_PrimroseCfromEmerson/.test(img); }));
assert.equal(rich.packet.tableCount, 9);
assert.equal(rich.packet.teams.length, 2, "Emerson GTD 73 -> 2 teams");
assert.equal(rich.packet.seatsPerTable, 9, "Emerson seats from event order rounds of 9, not diagram rounds of 8");
assert.ok(rich.packet.teams.every(function (t) { return t.names.length === 2; }));

assert.ok(sparse.packet.diagram && !sparse.packet.diagram.missing);
assert.match(sparse.packet.diagram.path, /PRIMROSEBALLROOMfromTSAE/);
assert.ok(!/PREFUNCTION/i.test(sparse.packet.diagram.path));
assert.equal(sparse.packet.tableCount, 38);
assert.equal(sparse.packet.teams.length, 7, "TSAE EXP 300 -> 7 teams");
assert.equal(sparse.packet.location, "");
assert.equal(sparse.packet.seatsPerTable, 8, "TSAE seats from event order rounds of 8, not setup line 10 or diagram 7");
assert.ok(sparse.packet.teams.every(function (t) { return t.names.length === 2; }));
const open7 = sparse.packet.teams.reduce(function (n, t) { return n + t.opening.length; }, 0);
const close7 = sparse.packet.teams.reduce(function (n, t) { return n + t.closing.length; }, 0);
assert.equal(open7, PreShift.OPENING_DUTIES.length);
assert.equal(close7, PreShift.CLOSING_DUTIES.length);

assert.equal(PreShift.defaultTeamCount({ gtd: "73" }), 2);
assert.equal(PreShift.defaultTeamCount({ gtd: null, set: "73" }), 2);
assert.equal(PreShift.defaultTeamCount({ gtd: null, set: null, exp: "300" }), 7);
assert.equal(PreShift.defaultTeamCount({}), 2);
assert.equal(PreShift.headcount({ gtd: "73", set: "80", exp: "100" }), 73);

const loadsOk = PreShift.teamLoads(rich.packet.teams, { "1": "Yellow", "2": "Yellow", "3": "Yellow", "4": "Yellow", "5": "Yellow" }, 9);
assert.equal(loadsOk[0].guests, 45);
assert.equal(loadsOk[0].over, false);
const loadsOver = PreShift.teamLoads(rich.packet.teams, { "1": "Yellow", "2": "Yellow", "3": "Yellow", "4": "Yellow", "5": "Yellow", "6": "Yellow", "7": "Yellow" }, 9);
assert.equal(loadsOver[0].guests, 63);
assert.equal(loadsOver[0].over, true);

const namedHotbox = PreShift.buildServerPacket({
  group: "Sample",
  tag: "Plated Lunch",
  counts: { gtd: "90" },
  services: [{ tag: "Workroom / Storage", room: "Camellia B", menu: "Storage from noon" }],
  foot: { NOTE: "BREAKDOWN & HOTBOX - Primrose B" }
});
assert.equal(namedHotbox.location, "Primrose B", "fill breakdown/hotbox only when the EO names it");
assert.equal(namedHotbox.teams.length, 2, "GTD 90 -> 2 teams");
const storageOnly = PreShift.buildServerPacket({
  group: "Sample 2",
  tag: "Plated Lunch",
  counts: { gtd: "73" },
  services: [{ tag: "Workroom / Storage", room: "Camellia B", menu: "Camellia B storage from noon" }],
  foot: { NOTE: "After service, client linen goes back to Camellia B storage." }
});
assert.equal(storageOnly.location, "", "storage line alone must leave breakdown/hotbox blank");
assert.ok(!/Camellia A/i.test(JSON.stringify(namedHotbox.location) + JSON.stringify(storageOnly.location)));

const stale = PreShift.mergePacket(sparse.packet, { teams: PreShift.defaultTeams(2) });
assert.equal(stale.teams.length, 7, "empty stale 2-team save must not override headcount default");
const kept = PreShift.mergePacket(sparse.packet, { teamCount: 3, teams: PreShift.defaultTeams(3).map(function (t, i) { if (i === 0) t.names = ["Alex", ""]; return t; }) });
assert.equal(kept.teams.length, 3);
assert.equal(kept.teams[0].names[0], "Alex");

const bare = PreShift.buildPreShift({ group: "Future Lunch", tag: "Plated Lunch", menu: "Plated Lunch", foot: {}, counts: { gtd: "20" } });
assert.ok(bare.packet.diagram.missing, "no diagram should be a placeholder, not an invented layout");
assert.ok(!bare.script.some(function (l) { return /Mobile coffee/i.test(l.text); }));
assert.equal(bare.packet.teams.length, 1, "GTD 20 -> 1 team");


// Section boxes: percent coordinates and packet persistence
assert.deepEqual(rich.packet.sections, []);
assert.deepEqual(sparse.packet.sections, []);

const flipped = PreShift.normalizeSectionBox({ team: "Yellow", x: 40, y: 40, w: -20, h: -10 });
assert.equal(flipped.team, "Yellow");
assert.equal(flipped.x, 20);
assert.equal(flipped.y, 30);
assert.equal(flipped.w, 20);
assert.equal(flipped.h, 10);

const clamped = PreShift.normalizeSectionBox({ team: "Green", x: -5, y: 90, w: 20, h: 30 });
assert.equal(clamped.x, 0);
assert.equal(clamped.y, 90);
assert.equal(clamped.w, 15);
assert.equal(clamped.h, 10);

assert.equal(PreShift.normalizeSectionBox({ team: "Blue", x: 10, y: 10, w: 0.2, h: 10 }), null);
assert.equal(PreShift.normalizeSectionBox({ x: 10, y: 10, w: 20, h: 20 }), null);

const dragged = PreShift.sectionBoxFromDrag(150, 80, 50, 180, { left: 50, top: 30, width: 200, height: 300 }, "Red", "s-drag");
assert.equal(dragged.id, "s-drag");
assert.equal(dragged.team, "Red");
assert.equal(dragged.x, 0);
assert.equal(dragged.y, 16.67);
assert.equal(dragged.w, 50);
assert.equal(dragged.h, 33.33);

const scale = PreShift.sectionBoxFromDrag(0, 0, 50, 25, { left: 0, top: 0, width: 100, height: 50 }, "Yellow", "s-scale");
assert.deepEqual([scale.x, scale.y, scale.w, scale.h], [0, 0, 50, 50]);
const scale2 = PreShift.sectionBoxFromDrag(0, 0, 100, 50, { left: 0, top: 0, width: 200, height: 100 }, "Yellow", "s-scale2");
assert.deepEqual([scale2.x, scale2.y, scale2.w, scale2.h], [0, 0, 50, 50]);

const persisted = PreShift.mergePacket(sparse.packet, {
  sections: [
    { id: "a", team: "Yellow", x: 5, y: 10, w: 20, h: 15, icon: "station", kind: "freehand" },
    { id: "b", team: "Yellow", x: 40, y: 40, w: 10, h: 10 },
    { id: "c", team: "Pink", x: 60, y: 20, w: 25, h: 30, station: "coffee" },
    { team: "", x: 1, y: 1, w: 10, h: 10 }
  ]
});
assert.equal(persisted.sections.length, 3, "keep one or more valid boxes, including two for Yellow");
assert.equal(persisted.sections[0].id, "a");
assert.equal(persisted.sections[0].team, "Yellow");
assert.ok(!("icon" in persisted.sections[0]) && !("kind" in persisted.sections[0]) && !("station" in persisted.sections[2]));
assert.equal(persisted.sections.filter(function (b) { return b.team === "Yellow"; }).length, 2);
const hit = PreShift.hitSection(persisted.sections, 45, 45);
assert.equal(hit && hit.id, "b");
assert.equal(PreShift.hitSection(persisted.sections, 0, 0), null);
assert.ok(!/\$\d/.test(JSON.stringify(persisted.sections)));
assert(!/[\u2014\u2013]/.test(JSON.stringify(persisted.sections)));


// Timeline vs cue: ask the contact unless the event order already says
assert.equal(PreShift.serviceCueFromEO("Serve strictly on the timeline.").known, true);
assert.equal(PreShift.serviceCueFromEO("Wait for a cue from Alex before dropping entrees.").known, true);
assert.equal(PreShift.serviceCueFromEO("Check with Lynn before firing entrees.").known, false);
assert.equal(PreShift.serviceCueFromEO("Lunch service begins at 12:20 after a short announcement.").known, false);

const alreadyCue = PreShift.buildPreShift({
  group: "Cue Lunch",
  tag: "Plated Lunch",
  menu: "Plated Lunch",
  contact: "Alex Rivera",
  foot: { NOTE: "Wait for a cue from Alex before dropping entrees.", CONTACT: "Alex Rivera" },
  counts: { gtd: "40" }
});
assert.ok(alreadyCue.script.some(function (l) { return /wait for a cue from the contact/i.test(l.text); }));
assert.ok(!alreadyCue.script.some(function (l) { return /\[ask\].*strictly on the timeline/i.test(l.text); }), "do not [ask] when the event order already names the cue and who");
assert.ok(!alreadyCue.questions.some(function (q) { return /strictly on the timeline/i.test(q.q); }));
assert.equal(alreadyCue.contact, "Alex");

const alreadyTime = PreShift.buildPreShift({
  group: "Clock Lunch",
  tag: "Plated Lunch",
  menu: "Plated Lunch",
  contact: "Pat Lee",
  foot: { NOTE: "Serve strictly on the timeline.", CONTACT: "Pat Lee" },
  counts: { gtd: "40" }
});
assert.ok(alreadyTime.script.some(function (l) { return /Service cue:.*strictly on the timeline/i.test(l.text); }));
assert.ok(!alreadyTime.script.some(function (l) { return /\[ask\].*waiting for a cue/i.test(l.text); }), "do not [ask] when the event order already says strictly on the timeline");
assert.ok(!alreadyTime.questions.some(function (q) { return /waiting for a cue/i.test(q.q); }));


const staleSteps = PreShift.mergePacket(sparse.packet, {
  steps: [{ time: "8:00 AM", label: "SET INSIDE ROOM", items: ["Silverware"], owners: [] }]
});
assert.equal(staleSteps.steps[0].label, "PIN THE CORKBOARD", "saved packets without the corkboard step still get it first");
assert.equal(staleSteps.steps[1].label, "SET INSIDE ROOM");
assert(!/[\u2014\u2013]/.test(PreShift.CORKBOARD_SCRIPT));


assert.equal(PreShift.wineChillFromEO("Wine is delivered in the morning, chill the white right away.").status, "yes");
assert.equal(PreShift.wineChillFromEO("Wine is delivered in the morning, chill the white right away.").duty, "Chill the white wine");
assert.equal(PreShift.wineChillFromEO("No bar or wine is listed on the lunch event order.").status, "ask");
assert.equal(PreShift.wineChillFromEO("No bar or wine is listed on the lunch event order.").duty, "");
assert.equal(PreShift.wineChillFromEO("Client wine, hotel pours. Corkage applies.").duty, "Chill the wine [ask]");

const wineAsk = PreShift.buildPreShift({
  group: "Wine Lunch",
  tag: "Plated Lunch",
  menu: "Plated Lunch",
  foot: { NOTE: "Client wine, hotel pours." },
  counts: { gtd: "40" }
});
assert.ok(wineAsk.script.some(function (l) { return /\[ask\].*wine needs to be chilled/i.test(l.text); }));
assert.ok(wineAsk.packet.teams.some(function (tm) { return (tm.opening || []).indexOf("Chill the wine [ask]") >= 0; }));

const staleAllergy = PreShift.mergePacket(sparse.packet, { specials: [{ table: "3", text: "Nut allergy" }] });
assert.ok(staleAllergy.specials.some(function (s) { return s.text === PreShift.ALLERGY_CAPTAIN_DROP; }), "saved packets still get the allergy drop rule");
assert(!/[\u2014\u2013]/.test(PreShift.ALLERGY_CAPTAIN_DROP));
assert.ok(!/Bourne/.test(PreShift.ALLERGY_CAPTAIN_DROP));

console.log("PASS: analysis, spoken scripts, later slots, questions for the manager, no prices or dashes. Meals:", meals.map(function (m) { return m.group; }).join(" | "));
