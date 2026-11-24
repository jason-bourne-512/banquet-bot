// Water towers are required in Bonnell, Barton, and Zilker only.
var assert = require("assert");
var WT = require("./water-towers.js");
var PreShift = require("./pre-shift-lib.js");

assert.equal(WT.FLAG, "Water towers needed");

["Bonnell", "bonnell", "Barton", "BARTON", "Zilker", "zilker",
  "Barton Creek", "Barton & PDR Foyer", "Barton and PDR Foyer",
  "Zilker 1/2", "Zilker 1 / 2", "Barton (Corinne)", "Zilker (Corinne)",
  "Bonnell / Conference", "Bonnell · Conference"
].forEach(function (room) {
  assert.ok(WT.needsWaterTowers(room), "should flag " + room);
});

["Primrose C", "Primrose CD", "Camellia A", "Plumeria", "Verbena",
  "Bluebell", "Buttercup", "Lantana", "PDR Foyer", "Pre-Function",
  "Bay II", "Lobby", "Corinne", "Room TBD", "", null
].forEach(function (room) {
  assert.ok(!WT.needsWaterTowers(room), "should not flag " + room);
});

assert.ok(!WT.needsWaterTowers("Bartonella"), "word boundary: Bartonella is not Barton");
assert.ok(WT.anyNeedWaterTowers(["Primrose C", "Barton", "Verbena"]), "any room in the list");
assert.ok(!WT.anyNeedWaterTowers(["Primrose C", "Verbena"]), "no matching room");
assert.ok(WT.anyNeedWaterTowers("Zilker 1/2"), "string form");

assert.ok(WT.mealNeedsWaterTowers({ room: "Barton", services: [] }), "meal.room");
assert.ok(WT.mealNeedsWaterTowers({
  room: "Verbena",
  services: [{ room: "Verbena" }, { room: "Barton" }]
}), "a service in Barton");
assert.ok(!WT.mealNeedsWaterTowers({
  room: "Primrose C",
  services: [{ room: "Primrose C" }],
  foot: { ROOM: "Primrose C (moved from Bonnell)", NOTE: "was in Zilker last year" }
}), "do not flag from historical notes when current rooms are elsewhere");

var barton = PreShift.buildPreShift({
  group: "Test Group",
  date: "2026-12-04",
  room: "Barton",
  tag: "Dinner",
  time: "6:00–9:00 PM",
  menu: "Plated dinner",
  services: [{ tag: "Dinner", room: "Barton", time: "6:00–9:00 PM", menu: "Plated dinner" }],
  foot: { ROOM: "Barton · Rounds of 8", NOTE: "event order 644111" }
});
assert.ok(barton.analysis.some(function (a) {
  return a.kind === "flag" && a.text === WT.FLAG;
}), "pre-shift analysis flags water towers for Barton");
assert.ok(barton.packet.specials.some(function (s) {
  return s.text === WT.FLAG;
}), "pre-shift packet reminder for Barton");

var primrose = PreShift.buildPreShift({
  group: "Other Group",
  date: "2026-12-04",
  room: "Primrose C",
  tag: "Dinner",
  time: "6:00–9:00 PM",
  menu: "Plated dinner",
  services: [{ tag: "Dinner", room: "Primrose C", time: "6:00–9:00 PM", menu: "Plated dinner" }],
  foot: { ROOM: "Primrose C · Rounds of 10", NOTE: "event order 644112" }
});
assert.ok(!primrose.analysis.some(function (a) { return a.text === WT.FLAG; }), "no flag for Primrose");
assert.ok(!primrose.packet.specials.some(function (s) { return s.text === WT.FLAG; }), "no reminder for Primrose");


var savedIn = PreShift.mergePacket(
  PreShift.buildServerPacket({
    group: "Test Group", date: "2026-12-04", room: "Barton",
    services: [{ tag: "Dinner", room: "Barton" }],
    foot: { ROOM: "Barton" }
  }),
  { specials: [{ table: "", text: "Check wine temps" }] }
);
assert.ok(savedIn.specials.some(function (s) { return s.text === WT.FLAG; }), "saved packet still gets the water-tower reminder");
assert.ok(savedIn.specials.some(function (s) { return s.text === "Check wine temps"; }), "staff reminder kept when adding the flag");

var savedOut = PreShift.mergePacket(
  PreShift.buildServerPacket({
    group: "Other Group", date: "2026-12-04", room: "Primrose C",
    services: [{ tag: "Dinner", room: "Primrose C" }],
    foot: { ROOM: "Primrose C" }
  }),
  { specials: [{ table: "", text: WT.FLAG }, { table: "", text: "Check wine temps" }] }
);
assert.ok(!savedOut.specials.some(function (s) { return s.text === WT.FLAG; }), "stale water-tower reminder dropped after a room move");
assert.ok(savedOut.specials.some(function (s) { return s.text === "Check wine temps"; }), "staff reminder kept when dropping the flag");

var edited = PreShift.mergePacket(
  PreShift.buildServerPacket({
    group: "Test Group", date: "2026-12-04", room: "Barton",
    services: [{ tag: "Dinner", room: "Barton" }],
    foot: { ROOM: "Barton" }
  }),
  { specials: [{ table: "", text: "Water towers needed, stage by the doors", key: "water-towers" }, { table: "", text: "Check wine temps" }] }
);
assert.equal(edited.specials.filter(function (s) { return s.key === "water-towers" || s.text === WT.FLAG; }).length, 1, "edited generated reminder is refreshed, not duplicated");
assert.equal(edited.specials.filter(function (s) { return s.key === "water-towers"; })[0].text, WT.FLAG, "generated reminder text is reset from the booking");
assert.ok(edited.specials.some(function (s) { return s.text === "Check wine temps"; }), "staff reminder kept when refreshing the flag");


console.log("PASS: water towers needed only for Bonnell, Barton, and Zilker");
