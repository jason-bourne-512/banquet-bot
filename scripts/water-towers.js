// Bonnell, Barton, and Zilker have no built-in water dispensers.
// Events in those rooms need water towers. Other rooms do not.
// Works in the browser and in Node tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBWaterTowers = factory();
})(typeof window !== "undefined" ? window : this, function () {
  var FLAG = "Water towers needed";
  // Room-name tokens, case-insensitive. Matches "Barton Creek", "Zilker 1/2",
  // "Barton (Corinne)", and combined labels like "Barton & PDR Foyer".
  var ROOM_RE = /\b(bonnell|barton|zilker)\b/i;

  function needsWaterTowers(room) {
    return ROOM_RE.test(String(room || ""));
  }

  function anyNeedWaterTowers(rooms) {
    if (rooms == null) return false;
    if (typeof rooms === "string") return needsWaterTowers(rooms);
    var list = Array.isArray(rooms) ? rooms : [];
    if (!list.length && rooms && typeof rooms.forEach === "function") {
      var hit = false;
      rooms.forEach(function (r) { if (needsWaterTowers(r)) hit = true; });
      return hit;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      if (needsWaterTowers(list[i])) return true;
    }
    return false;
  }

  function mealNeedsWaterTowers(meal) {
    meal = meal || {};
    if (needsWaterTowers(meal.room)) return true;
    var services = meal.services || [];
    var i;
    for (i = 0; i < services.length; i++) {
      if (needsWaterTowers(services[i] && services[i].room)) return true;
    }
    return false;
  }

  return {
    FLAG: FLAG,
    needsWaterTowers: needsWaterTowers,
    anyNeedWaterTowers: anyNeedWaterTowers,
    mealNeedsWaterTowers: mealNeedsWaterTowers
  };
});
