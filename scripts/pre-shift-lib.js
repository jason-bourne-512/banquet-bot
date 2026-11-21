// Shared plated pre-shift script builder. Used by pre-shift.html (browser) and test-pre-shift.js (Node).
// No DOM dependency: pass plain meal objects in, get script lines + questions out.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PreShift = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clean(s) {
    return String(s || "")
      .replace(/\s*[\u2014\u2013]\s*/g, function (m) { return /\s/.test(m) ? " - " : "-"; })
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function stripPrices(s) {
    return clean(String(s || "")
      .replace(/\s*@?\s*\$[\d.,]+(?:\s*\/\s*\w+)?/gi, "")
      .replace(/\s{2,}/g, " "));
  }

  function firstName(s) {
    s = clean(s).replace(/^MGR:\s*/i, "").replace(/^IC:\s*/i, "");
    if (!s) return "";
    return s.split(/[\s,·/(]/)[0];
  }

  function isPlated(tag, menu) {
    tag = String(tag || "");
    menu = String(menu || "");
    if (/\bplated\b/i.test(tag)) return true;
    if (!/\bplated\b/i.test(menu)) return false;
    // buffet / break / reception rows often say "plated breakfasts are served with..." as boilerplate
    if (/\bbuffet\b|\bcoffee\s*break\b|\bbreak\b(?!\s*out)|\breception\b|\bno\s*f\s*&\s*b\b/i.test(tag) && !/\bplated\b/i.test(tag)) {
      return false;
    }
    return true;
  }

  function parseCounts(pill) {
    var t = clean(pill);
    var gtd = (t.match(/\bGTD\s+(\d+)/i) || [])[1] || null;
    var set = (t.match(/\bSET\s+(\d+)/i) || [])[1] || null;
    var exp = (t.match(/\bEXP\s+(\d+)/i) || [])[1] || null;
    if (!gtd && !set && !exp) {
      var n = (t.match(/\b(\d+)\b/) || [])[1];
      if (n) exp = n;
    }
    return { gtd: gtd, set: set, exp: exp, raw: t };
  }

  function has(blob, re) { return re.test(blob || ""); }

  function pickAsk(topic) {
    // Hector: floor calls / fire / sections / expo / gear
    // Diana: allergies / set / timing / program
    // Lisa: wine / bar / vendor-staff meals
    if (/wine|bar\b|beverage|pour|corkage/i.test(topic)) return "Lisa";
    if (/allerg|diet|set count|guarantee|doors|program|speech|seating|apps|timing|confirm/i.test(topic)) return "Diana";
    return "Hector";
  }

  // Build one script from a plated meal object.
  // meal: { group, date, room, time, mgr, contact, tag, menu, counts, foot:{NOTE,FOOD,ROOM,...}, extras:string }
  function buildPreShift(meal) {
    meal = meal || {};
    var foot = meal.foot || {};
    var menu = stripPrices(meal.menu || "");
    var note = stripPrices(foot.NOTE || "");
    var food = stripPrices(foot.FOOD || "");
    var room = stripPrices(foot.ROOM || meal.room || "");
    var extras = stripPrices(meal.extras || "");
    var blob = [menu, note, food, room, extras, meal.tag || "", meal.time || ""].join(" · ");
    var counts = meal.counts || parseCounts(meal.countPill || "");
    var mgr = firstName(meal.mgr) || "Hector";
    var lines = [];
    var questions = [];
    var asked = {};

    function say(label, text, askHint) {
      if (text) {
        lines.push({ label: label, text: text, known: true });
      } else {
        lines.push({ label: label, text: "[ask]", known: false });
        if (askHint && !asked[askHint]) {
          asked[askHint] = 1;
          questions.push({ who: pickAsk(askHint), q: askHint });
        }
      }
    }

    // 1. Guarantee / set
    var countLine = "";
    if (counts.gtd && counts.set) countLine = "Guarantee " + counts.gtd + ", set " + counts.set;
    else if (counts.gtd) countLine = "Guarantee " + counts.gtd + (counts.set ? "" : "");
    else if (counts.set) countLine = "Set " + counts.set;
    else if (counts.exp) countLine = "Expected " + counts.exp + " (no guarantee on the card)";
    if (countLine && !counts.set && counts.gtd) {
      say("Counts", countLine);
      questions.push({ who: "Diana", q: "What is the set count for " + (meal.group || "this plated meal") + "?" });
    } else if (countLine) {
      say("Counts", countLine);
    } else {
      say("Counts", "", "What are the guarantee and set counts?");
    }

    // 2. Entree / plate + marking
    var entreeText = "";
    var choice = has(blob, /\bentr[eé]e?\s*\(choice\)|\bchoice\b.*\bentr|\bmarked on place|place cards?|colored dot|star\s*=/i);
    var multi = (menu.match(/\bentr[eé]e?s?\b/gi) || []).length >= 1 && has(menu, /\(\d+\)/);
    var single = has(menu, /\bsecond course:|\bentree:|\bentr[eé]e:/i) && !has(menu, /\bchoice\b/i);
    if (has(menu, /chef'?s choice plated/i)) {
      entreeText = "Chef's choice plated - menu not itemized on the EO";
    } else if (menu) {
      // pull a short entree summary from menu without inventing
      var mChoice = menu.match(/Entr[eé]e\s*\(choice\):\s*([^.]+)/i);
      var mEntrees = menu.match(/Entr[eé]es?:\s*([^.]+?)(?:\s*·\s*Dessert|\s*·\s*Rolls|$)/i);
      var mSingle = menu.match(/(?:Second course|Entr[eé]e):\s*([^.]+?)(?:\s*·\s*Dessert|\s*·\s*Rolls|$)/i);
      if (mChoice) entreeText = "Entree choice: " + clean(mChoice[1]);
      else if (mEntrees) entreeText = "Entrees: " + clean(mEntrees[1]);
      else if (mSingle) entreeText = "Plate: " + clean(mSingle[1]);
      else if (/\bplated\b/i.test(menu)) entreeText = stripPrices(menu.split(/·/)[0]).replace(/^<[^>]+>/, "").slice(0, 180);
    }
    var mark = "";
    if (has(blob, /colored dot\s*=\s*entr/i)) mark = "Place cards: colored dot = entree, star = special meal";
    else if (has(blob, /place cards?/i)) mark = "Place cards mark the choice (see EO notes)";
    else if (has(blob, /by-table meal list|meal list/i)) mark = "Captain gets a by-table meal list";
    if (entreeText && mark) entreeText = entreeText + ". " + mark;
    else if (!entreeText && mark) entreeText = mark;
    if (entreeText && choice && !mark) {
      say("Entree", entreeText);
      questions.push({ who: "Diana", q: "How are entree choices marked (place cards, dots, list)?" });
    } else {
      say("Entree", entreeText || "", "Is this a choice or a single plate, and how are choices marked?");
    }

    // 3. Allergies / dietary by table
    var diet = "";
    if (food && /allerg|dietary|gluten|vegan|vegetarian|nut|shellfish|mushroom|clam/i.test(food)) diet = food;
    else {
      var dietBits = [];
      if (has(menu, /gluten-free|gluten free|\bGF\b/i)) dietBits.push("GF notes on the menu");
      if (has(menu, /NO mushroom|no mushroom|allergic/i)) {
        var am = menu.match(/1\s+NO\s+[^.·]+|1\s+gluten-free[^.·]+/gi);
        if (am) dietBits = dietBits.concat(am.map(clean));
      }
      if (has(note, /allerg|dietary|gluten/i)) {
        var nm = note.match(/[^·]*\b(?:allerg|dietary|gluten)[^·]*/i);
        if (nm) dietBits.push(clean(nm[0]));
      }
      if (dietBits.length) diet = dietBits.join("; ");
    }
    if (diet && !/by\s*table|table\s*\d/i.test(diet + note)) {
      say("Allergies / dietary", diet);
      questions.push({ who: "Diana", q: "Any allergies or dietary plates by table, with subs?" });
    } else {
      say("Allergies / dietary", diet || "", "Any allergies or dietary plates by table, with subs?");
    }

    // 4. Vendor / staff meals
    var staff = "";
    if (has(blob, /vendor\s*meal|staff\s*meal|crew\s*meal|employee\s*meal/i)) {
      var sm = blob.match(/[^·]*(?:vendor|staff|crew|employee)\s*meals?[^·]*/i);
      if (sm) staff = clean(sm[0]);
    }
    say("Vendor / staff meals", staff || "", "Any vendor or staff meals?");

    // 5. Doors / apps / seating
    var timing = [];
    if (meal.doors) timing.push("Doors " + meal.doors);
    else {
      var d = blob.match(/doors?\s*(?:open(?:s|ed)?|at)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i)
        || blob.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*doors?\s*open/i);
      if (d) timing.push("Doors " + clean(d[1] || d[0]));
    }
    if (meal.apps) timing.push("Apps " + meal.apps);
    else if (has(blob, /passed|hors\s*d|tray-passed|cocktail reception/i) && meal.appsTime) {
      timing.push("Apps " + meal.appsTime);
    } else if (meal.appsTime) timing.push("Apps " + meal.appsTime);
    if (meal.service) timing.push("Service " + meal.service);
    else {
      var sv = blob.match(/service\s*(?:starts?|begins?)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
      if (sv) timing.push("Service " + clean(sv[1]));
      else if (meal.time) timing.push("Plated window " + clean(meal.time));
    }
    if (meal.seating) timing.push("Seating " + meal.seating);
    say("Doors / apps / seating", timing.length ? timing.join(", ") : "", "Confirm doors, apps, and seating / service start times.");

    // 6. Program / speeches
    var prog = "";
    if (has(blob, /speech|program|welcome|award|sponsor recognition|musician|announcement/i)) {
      var bits = blob.match(/[^·]*(?:speech|program|welcome from|sponsor recognition|awards|musician|announcement|between courses)[^·]*/gi);
      if (bits) prog = bits.map(clean).filter(Boolean).slice(0, 3).join("; ");
    }
    say("Program / speeches", prog || "", "Any program or speeches between courses?");

    // 7. Who calls each course
    var calls = "";
    if (has(blob, /who calls|call(?:s|ing)?\s+(?:salad|entree|dessert|course)|captain calls|manager calls/i)) {
      var cm = blob.match(/[^·]*(?:calls?|calling)\s+(?:the\s+)?(?:salad|entree|dessert|course)[^·]*/i);
      if (cm) calls = clean(cm[0]);
    }
    say("Who calls courses", calls || "", "Who calls salad and entree?");

    // 8. Kitchen fire times
    var fire = "";
    if (has(blob, /fir(?:e|ing)\s+(?:entr|salad|dessert|times?)|kitchen\s+fire|check with .+ before fir/i)) {
      var fm = blob.match(/[^·]*(?:fir(?:e|ing)|kitchen fire)[^·]*/i);
      if (fm) fire = clean(fm[0]);
    }
    say("Kitchen fire times", fire || "", "What are the kitchen fire times for each course?");

    // 9. Pre-sets
    var preset = [];
    if (has(blob, /pre-?set:\s*[^·]+/i)) {
      var ps = blob.match(/pre-?set:\s*([^·]+)/i);
      if (ps) preset.push(clean(ps[1]));
    }
    if (has(blob, /pre-?set salads?\s*\+?\s*waters?|salads?\s*\+\s*waters?/i)) preset.push("Pre-set salad and water");
    if (has(blob, /artisan rolls?|rolls?\s*&\s*butter|bread/i)) preset.push("Rolls and butter");
    if (has(blob, /pre-?set silverware|water glasses|napkins by/i)) {
      var pr = blob.match(/[^·]*pre-?set silverware[^·]*/i);
      if (pr) preset.push(clean(pr[0]));
    }
    if (has(menu, /\bfirst course:|\bsalad:/i) && !preset.length) {
      var sc = menu.match(/(?:First course|Salad):\s*([^·]+)/i);
      if (sc) preset.push("Salad: " + clean(sc[1]));
    }
    if (has(menu, /\bdessert:/i)) {
      var ds = menu.match(/Dessert:\s*([^·]+)/i);
      if (ds) preset.push("Dessert: " + clean(ds[1]) + (has(blob, /do not clear dessert/i) ? " (do not clear dessert plates)" : ""));
    }
    say("Pre-sets", preset.length ? preset.join("; ") : "", "What is pre-set (salad, bread, butter, water, dessert)?");

    // 10. Wine pour vs bar
    var wine = "";
    if (has(blob, /wine is client-provided|client wine|servers pour .+ wine|corkage|no house wine|wine pour|hosted bar|cash bar/i)) {
      var wm = blob.match(/[^·]*(?:wine is client-provided|client wine|servers pour[^·]*wine|corkage|no house wine|wine pour|hosted\s+\w*\s*bar|cash bar)[^·]*/i);
      if (wm) wine = clean(wm[0]);
      else if (has(blob, /hosted bar|cash bar/i)) wine = has(blob, /hosted/i) ? "Hosted bar on the card" : "Cash bar on the card";
    }
    say("Wine / bar", wine || "", "Wine pour or bar only?");

    // 11. Server sections
    var sections = "";
    if (has(blob, /section|tables numbered|by-table/i)) {
      if (has(blob, /tables numbered/i)) sections = "Tables numbered";
      if (has(blob, /by-table meal list/i)) sections = (sections ? sections + "; " : "") + "By-table meal list from the contact";
    }
    say("Server sections", sections || "", "How are server sections assigned?");

    // 12. Head table first
    var head = "";
    if (has(blob, /head\s*table|vip table|serve (?:the )?head/i)) {
      var hm = blob.match(/[^·]*head\s*table[^·]*/i);
      if (hm) head = clean(hm[0]);
    }
    say("Head table", head || "", "Head table first?");

    // 13. Serve / clear direction (house standard reminder if unknown)
    var dir = "";
    if (has(blob, /serve left|clear right|serve from the left/i)) dir = "Serve left, clear right";
    if (dir) say("Serve / clear", dir);
    else {
      lines.push({ label: "Serve / clear", text: "House standard: serve left, clear right (confirm if EO says otherwise)", known: true, house: true });
    }

    // 14. Expo line order
    var expo = "";
    if (has(blob, /expo|line order|pass order/i)) {
      var em = blob.match(/[^·]*(?:expo|line order|pass order)[^·]*/i);
      if (em) expo = clean(em[0]);
    }
    say("Expo line order", expo || "", "What is the expo line order?");

    // 15. Covers / trays / jacks
    var gear = "";
    if (has(blob, /\bcovers?\b|\btrays?\b|\bjacks?\b|chargers?/i)) {
      var gm = blob.match(/[^·]*(?:\bcovers?\b|\btrays?\b|\bjacks?\b|chargers?)[^·]*/i);
      if (gm) gear = clean(gm[0]);
    }
    say("Covers / trays / jacks", gear || "", "Covers, trays, and jacks needed?");

    // 16. Coffee / decaf timing
    var coffee = "";
    if (has(blob, /coffee\/(?:hot )?tea|coffee\s*\+|coffee all night|decaf|tea service/i)) {
      var cm2 = blob.match(/[^·]*(?:coffee\/(?:hot )?tea|coffee\s*\+|coffee all night|decaf|tea service)[^·]*/i);
      if (cm2) coffee = clean(cm2[0]);
      else if (has(menu, /coffee/i)) coffee = "Coffee / hot tea on the menu";
    }
    say("Coffee / decaf", coffee || "", "When does coffee / decaf go out?");

    // Deduplicate questions by text
    var seenQ = {};
    questions = questions.filter(function (q) {
      var k = q.who + "|" + q.q;
      if (seenQ[k]) return false;
      seenQ[k] = 1;
      return true;
    });

    return {
      group: clean(meal.group || ""),
      date: meal.date || "",
      room: clean(meal.room || ""),
      time: clean(meal.time || ""),
      mgr: mgr,
      contact: firstName(meal.contact || foot.CONTACT || ""),
      tag: clean(meal.tag || ""),
      counts: counts,
      lines: lines,
      questions: questions
    };
  }

  // Collect plated meals from a document-like root using helpers.
  // helpers: { sections: Element[], txt(el), qs(el,sel), qsa(el,sel), attr(el,name), todayISO }
  function collectPlated(helpers) {
    var today = helpers.todayISO;
    var out = [];
    (helpers.sections || []).forEach(function (sec) {
      var date = helpers.attr(sec, "data-date") || "";
      if (today && date && date < today) return;
      helpers.qsa(sec, ".event-card").forEach(function (card) {
        var group = helpers.txt(helpers.qs(card, ".card-group"));
        var mgr = helpers.txt(helpers.qs(card, ".badge-mgr"));
        var foot = {};
        helpers.qsa(card, ".card-foot .foot-row").forEach(function (f) {
          var k = helpers.txt(helpers.qs(f, ".foot-key")).toUpperCase();
          var v = helpers.txt(helpers.qs(f, ".foot-val"));
          if (!k) return;
          foot[k] = foot[k] ? foot[k] + " · " + v : v;
        });
        var appsTime = "";
        var doors = "";
        var extras = [];
        helpers.qsa(card, ".svc-row").forEach(function (r) {
          var tag = helpers.txt(helpers.qs(r, ".svc-top .tag"));
          var menu = helpers.txt(helpers.qs(r, ".svc-menu"));
          var time = helpers.txt(helpers.qs(r, ".svc-time")).replace(/\s+/g, " ");
          if (/reception|passed|hors/i.test(tag) || /tray-passed|hors\s*d/i.test(menu)) {
            if (!appsTime) appsTime = time;
            extras.push(tag + ": " + menu);
          }
          if (/doors?|room ready|open doors/i.test(tag) || /doors?\s*open/i.test(menu)) {
            if (!doors) doors = time || menu;
            extras.push(tag + ": " + menu);
          }
          if (/hosted bar|cash bar|wine/i.test(tag) || /hosted.*bar|wine is client/i.test(menu)) {
            extras.push(tag + ": " + menu);
          }
        });
        helpers.qsa(card, ".svc-row").forEach(function (r) {
          var tag = helpers.txt(helpers.qs(r, ".svc-top .tag"));
          var menuEl = helpers.qs(r, ".svc-menu");
          var menu = helpers.txt(menuEl);
          // prefer data-en plain if present (still fine as textContent)
          if (!isPlated(tag, menu)) return;
          var room = helpers.txt(helpers.qs(r, ".room-pill"));
          var pill = helpers.txt(helpers.qs(r, ".gtd-pill"));
          var time = helpers.txt(helpers.qs(r, ".svc-time")).replace(/\s+/g, " ");
          out.push(buildPreShift({
            group: group,
            date: date,
            room: room || (foot.ROOM || "").split(/[·\n]/)[0],
            time: time,
            mgr: mgr,
            contact: foot.CONTACT || "",
            tag: tag,
            menu: menu,
            counts: parseCounts(pill),
            countPill: pill,
            foot: foot,
            extras: extras.join(" · "),
            appsTime: appsTime,
            doors: doors
          }));
        });
      });
    });
    return out;
  }

  return {
    clean: clean,
    stripPrices: stripPrices,
    firstName: firstName,
    isPlated: isPlated,
    parseCounts: parseCounts,
    buildPreShift: buildPreShift,
    collectPlated: collectPlated
  };
});
