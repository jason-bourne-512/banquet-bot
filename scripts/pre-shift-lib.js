// Shared plated pre-shift builder. Used by pre-shift.html (browser) and test-pre-shift.js (Node).
// No DOM dependency: pass plain meal objects in, get analysis, spoken script, and questions out.

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
    s = clean(s).replace(/^MGR:\s*/i, "").replace(/^IC:\s*/i, "").replace(/^CONTACT:\s*/i, "");
    if (!s) return "";
    return s.split(/[\s,·/(]/)[0];
  }

  function isPlated(tag, menu) {
    tag = String(tag || "");
    menu = String(menu || "");
    if (/\bplated\b/i.test(tag)) return true;
    if (!/\bplated\b/i.test(menu)) return false;
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

  function publicText(s) {
    s = stripPrices(s);
    s = s.replace(/VIP[^.·]*cannot fail[^.·]*/ig, "");
    s = s.replace(/client says it\s*["\u201c]?cannot fail["\u201d]?[^.·]*/ig, "");
    s = s.replace(/\s*·\s*·+/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "");
    return clean(s);
  }

  function extractFlags(text) {
    var s = publicText(text);
    if (!s) return [];
    var out = [];
    String(text || "").split(/[\u2691\u26A0]/).slice(1).forEach(function (part) {
      var line = publicText(part.replace(/^UPDATED[^:]{0,40}:\s*/i, "").split(/\s*\/\s*(?=\u2691|event orders?)/i)[0]);
      line = line.replace(/\s*event orders?\s+[\d\s,/]+.*$/i, "").replace(/\s*\(\d{1,2}\/\d{1,2} email[^)]*\)/ig, "");
      line = clean(line);
      if (line && !/missed in packet/i.test(line) && out.indexOf(line) < 0) out.push(line);
    });
    return out;
  }

  function startMinutes(s) {
    s = String(s || "");
    var m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!m) return 9999;
    var h = +m[1], min = +(m[2] || 0);
    var mer = m[3] || (s.match(/\b(AM|PM)\b/i) || [])[1];
    if (mer) {
      mer = mer.toUpperCase();
      if (mer === "PM" && h < 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
    }
    return h * 60 + min;
  }

  function countLine(counts) {
    counts = counts || {};
    if (counts.gtd && counts.set) return "Guarantee " + counts.gtd + ", set " + counts.set;
    if (counts.gtd) return "Guarantee " + counts.gtd;
    if (counts.set) return "Set " + counts.set;
    if (counts.exp) return "Expected " + counts.exp + " (no guarantee on the card)";
    return "";
  }

  function addQ(questions, asked, who, q) {
    if (!q) return;
    var k = (who || "") + "|" + q;
    if (asked[k]) return;
    asked[k] = 1;
    questions.push({ who: who, q: q });
  }

  var CUE_QUESTION = "Before service: are we serving strictly on the timeline, or waiting for a cue, and what cue, from who?";

  function serviceCueFromEO(blob) {
    var s = clean(blob);
    if (!s) return { text: "", known: false };
    var tl = s.match(/[^·]*serv(?:e|ing|ice)\s+strictly on(?: the)? timeline[^·]*/i)
      || s.match(/[^·]*strictly on(?: the)? timeline[^·]*/i);
    if (tl) return { text: clean(tl[0]), known: true };
    var cue = s.match(/[^·]*wait(?:ing)? for (?:a |the )?cue from [A-Za-z][A-Za-z'-]*[^·]*/i)
      || s.match(/[^·]*wait(?:ing)? for [A-Za-z][A-Za-z'-]*(?:'s)? cue[^·]*/i)
      || s.match(/[^·]*(?:on|at)\s+[A-Za-z][A-Za-z'-]*(?:'s)? cue[^·]*/i);
    if (cue) return { text: clean(cue[0]), known: true };
    return { text: "", known: false };
  }

  function serviceCueScriptLine(blob) {
    var found = serviceCueFromEO(blob);
    if (found.known && found.text) {
      return { text: "Service cue: " + found.text + ".", known: true };
    }
    return { text: "[ask] " + CUE_QUESTION, known: false };
  }

  function briefingFor(meal) {
    var g = meal.group || "";
    var d = meal.date || "";
    if (/Emerson/i.test(g) && (!d || d === "2026-11-20")) return "emerson";
    if (/TSAE/i.test(g) && (!d || d === "2026-12-04")) return "tsae";
    return "";
  }

  function buildPreShift(meal) {
    meal = meal || {};
    var foot = meal.foot || {};
    var menu = publicText(meal.menu || "");
    var note = publicText(foot.NOTE || "");
    var food = publicText(foot.FOOD || "");
    var roomFoot = publicText(foot.ROOM || meal.room || "");
    var extras = publicText(meal.extras || "");
    var diagrams = publicText(meal.diagrams || foot.DIAGRAM || "");
    var services = meal.services || [];
    var flags = extractFlags(foot.NOTE || "");
    (meal.services || []).forEach(function (sv) {
      extractFlags(sv.menu || "").forEach(function (fl) {
        if (flags.indexOf(fl) < 0) flags.push(fl);
      });
    });
    extractFlags(meal.flagText || "").forEach(function (fl) {
      if (flags.indexOf(fl) < 0) flags.push(fl);
    });
    flags = flags.filter(function (fl) {
      if (/missed in packet/i.test(fl)) return false;
      if (/^counts from\b/i.test(fl) && /\bEO\b|event order/i.test(fl)) return false;
      if (/^UPDATED\b/i.test(fl)) return false;
      return fl.length < 280;
    });
    var blob = [menu, note, food, roomFoot, extras, diagrams, meal.tag || "", meal.time || ""].join(" · ");
    var counts = meal.counts || parseCounts(meal.countPill || "");
    if (!counts.set && (meal.services || []).length) {
      (meal.services || []).forEach(function (sv) {
        if (counts.set) return;
        if (/set up/i.test(sv.tag || "") || /storage/i.test(sv.tag || "")) {
          var sc = parseCounts(sv.pill || "");
          if (sc.set) counts.set = sc.set;
        }
      });
    }
    var mgr = firstName(meal.mgr) || "Hector";
    var kind = briefingFor(meal);
    var contact = firstName(meal.contact || foot.CONTACT || "");
    var lines = [];
    var analysis = [];
    var questions = [];
    var asked = {};

    function fact(label, text, kind) {
      analysis.push({ label: label, text: text, kind: kind || "fact" });
    }
    function say(label, text, askHint) {
      if (text) {
        lines.push({ label: label, text: text, known: true });
      } else {
        lines.push({ label: label, text: "[ask]", known: false });
        if (askHint) addQ(questions, asked, mgr, askHint);
      }
    }
    function later(label, text) {
      var t = text || "Later: fill in day-of";
      lines.push({ label: label, text: t, known: true, later: true });
      analysis.push({ label: label, text: t, kind: "later" });
    }

    // Counts
    var countsText = countLine(counts);
    if (countsText && !counts.set && counts.gtd) {
      say("Counts", countsText);
      addQ(questions, asked, mgr, "What is the set count for " + (meal.group || "this plated meal") + "?");
    } else if (countsText) {
      say("Counts", countsText);
    } else {
      say("Counts", "", "What are the guarantee and set counts?");
    }
    if (countsText) fact("Counts", countsText);

    // Entree / marking
    var entreeText = "";
    var choice = has(blob, /\bentr[eé]e?\s*\(choice\)|\bchoice\b.*\bentr|\bmarked on place|place cards?|colored dot|star\s*=/i);
    if (has(menu, /chef'?s choice plated/i)) {
      entreeText = "Chef's choice plated - menu not itemized on the EO";
    } else if (menu) {
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
      addQ(questions, asked, mgr, "How are entree choices marked (place cards, dots, list)?");
    } else {
      say("Entree", entreeText || "", "Is this a choice or a single plate, and how are choices marked?");
    }
    if (entreeText) fact("Menu and marking", entreeText);

    // Dietary
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
      addQ(questions, asked, mgr, "Any allergies or dietary plates by table, with subs?");
    } else {
      say("Allergies / dietary", diet || "", "Any allergies or dietary plates by table, with subs?");
    }
    if (diet) fact("Dietary", diet);
    else fact("Dietary", "[ask]", "ask");

    // Vendor / staff
    var staff = "";
    if (has(blob, /vendor\s*meal|staff\s*meal|crew\s*meal|employee\s*meal/i)) {
      var sm = blob.match(/[^·]*(?:vendor|staff|crew|employee)\s*meals?[^·]*/i);
      if (sm) staff = clean(sm[0]);
    }
    say("Vendor / staff meals", staff || "", "Any vendor or staff meals?");
    fact("Vendor / staff meals", staff || "[ask]", staff ? "fact" : "ask");

    // Timeline from services + doors/apps
    var timing = [];
    var timelineBits = [];
    services.slice().sort(function (a, b) { return startMinutes(a.time) - startMinutes(b.time); }).forEach(function (sv) {
      var tag = clean(sv.tag || "");
      var time = clean(sv.time || "");
      var bit = clean((time ? time + " " : "") + tag + (sv.room ? " in " + clean(sv.room) : ""));
      var detail = publicText(sv.menu || "");
      if (detail && detail.length < 180) bit = bit + " - " + detail;
      if (bit) timelineBits.push(bit);
    });
    if (meal.doors) timing.push("Doors " + meal.doors);
    else {
      var dmatch = blob.match(/doors?\s*(?:open(?:s|ed)?|at)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i)
        || blob.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*doors?\s*open/i);
      if (dmatch) timing.push("Doors " + clean(dmatch[1] || dmatch[0]));
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
    if (timelineBits.length) fact("Timeline", timelineBits.join("; "));
    else if (timing.length) fact("Timeline", timing.join(", "));

    // Program
    var prog = "";
    if (has(blob, /speech|program|welcome|award|sponsor recognition|musician|announcement/i)) {
      var bits = blob.match(/[^·]*(?:speech|program|welcome from|sponsor recognition|awards|musician|announcement|between courses)[^·]*/gi);
      if (bits) prog = bits.map(clean).filter(Boolean).slice(0, 4).join("; ");
    }
    say("Program / speeches", prog || "", "Any program or speeches between courses?");
    if (prog) fact("Program", prog);

    // Who calls
    var calls = "";
    if (has(blob, /who calls|call(?:s|ing)?\s+(?:salad|entree|dessert|course)|captain calls|manager calls/i)) {
      var cm = blob.match(/[^·]*(?:calls?|calling)\s+(?:the\s+)?(?:salad|entree|dessert|course)[^·]*/i);
      if (cm) calls = clean(cm[0]);
    }
    say("Who calls courses", calls || "", "Who calls salad and entree?");
    var cue = serviceCueFromEO(blob);
    if (!cue.known) addQ(questions, asked, contact || "the contact", CUE_QUESTION);

    // Fire
    var fire = "";
    if (has(blob, /fir(?:e|ing)\s+(?:entr|salad|dessert|times?)|kitchen\s+fire|check with .+ before fir/i)) {
      var fm = blob.match(/[^·]*(?:fir(?:e|ing)|kitchen fire)[^·]*/i);
      if (fm) fire = clean(fm[0]);
    }
    say("Kitchen fire times", fire || "", fire ? "" : "What are the kitchen fire times for each course?");
    if (fire && /check with/i.test(fire) && !/clock|:\d{2}/.test(fire)) {
      addQ(questions, asked, mgr, "Any clock fire times, or do we only check with " + (contact || "the contact") + " before firing?");
    }
    if (fire) fact("Fire times", fire);

    // Pre-sets
    var preset = [];
    if (has(blob, /pre-?set:\s*[^·]+/i)) {
      var ps = blob.match(/pre-?set:\s*([^·]+)/i);
      if (ps) preset.push(clean(ps[1]));
    }
    if (has(blob, /pre-?set salads?\s*\+?\s*waters?|salads?\s*\+\s*waters?/i)) preset.push("Pre-set salad and water");
    if (has(blob, /artisan rolls?|rolls?\s*&\s*butter|rolls and butter|bread/i)) preset.push("Rolls and butter");
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
    if (preset.length) fact("Pre-sets", preset.join("; "));

    // Wine / bar
    var wine = "";
    if (has(blob, /wine is client-provided|client wine|servers pour .+ wine|corkage|no house wine|wine pour|hosted bar|cash bar/i)) {
      var wm = blob.match(/[^·]*(?:wine is client-provided|client wine|servers pour[^·]*wine|corkage|no house wine|wine pour|hosted\s+\w*\s*bar|cash bar)[^·]*/gi);
      if (wm) wine = wm.map(clean).filter(Boolean).slice(0, 3).join("; ");
      else if (has(blob, /hosted bar|cash bar/i)) wine = has(blob, /hosted/i) ? "Hosted bar on the card" : "Cash bar on the card";
    }
    if (has(blob, /chill the white|wine is delivered/i)) {
      var wd = blob.match(/[^·]*(?:wine is delivered|chill the white)[^·]*/i);
      if (wd) wine = (wine ? wine + "; " : "") + clean(wd[0]);
    }
    say("Wine / bar", wine || "", "Wine pour or bar only?");
    if (wine) fact("Wine / bar", wine);

    // Later slots: sections and named duties. Do not ask these now.
    var sections = "";
    if (has(blob, /tables numbered/i)) sections = "Tables are numbered. ";
    sections += "Later: fill in day-of";
    later("Server sections", sections);
    later("Named staffing / duties", "Later: opening and closing duties and server assignments can be added later.");

    // Head table
    var head = "";
    if (has(blob, /head\s*table|vip table|serve (?:the )?head/i)) {
      var hm = blob.match(/[^·]*head\s*table[^·]*/i);
      if (hm) head = clean(hm[0]);
    }
    say("Head table", head || "", "Head table first?");

    // Serve / clear
    var dir = "";
    if (has(blob, /serve left|clear right|serve from the left/i)) dir = "Serve left, clear right";
    if (dir) {
      say("Serve / clear", dir);
      fact("Serve / clear", dir);
    } else {
      lines.push({ label: "Serve / clear", text: "House standard: serve left, clear right (confirm if EO says otherwise)", known: true, house: true });
      fact("Serve / clear", "House standard: serve left, clear right (confirm if EO says otherwise)");
    }

    // Expo
    var expo = "";
    if (has(blob, /expo|line order|pass order/i)) {
      var em = blob.match(/[^·]*(?:expo|line order|pass order)[^·]*/i);
      if (em) expo = clean(em[0]);
    }
    say("Expo line order", expo || "", "What is the expo line order?");

    // Gear
    var gear = "";
    if (has(blob, /\bcovers?\b|\btrays?\b|\bjacks?\b|chargers?/i)) {
      var gm = blob.match(/[^·]*(?:\bcovers?\b|\btrays?\b|\bjacks?\b|chargers?)[^·]*/i);
      if (gm) gear = clean(gm[0]);
    }
    say("Covers / trays / jacks", gear || "", "Covers, trays, and jacks needed?");
    if (gear) fact("Covers / trays / jacks", gear);

    // Coffee
    var coffee = "";
    if (has(blob, /coffee\/(?:hot )?tea|coffee\s*\+|coffee all night|decaf|tea service/i)) {
      var cm2 = blob.match(/[^·]*(?:coffee\/(?:hot )?tea|coffee\s*\+|coffee all night|decaf|tea service)[^·]*/i);
      if (cm2) coffee = clean(cm2[0]);
      else if (has(menu, /coffee/i)) coffee = "Coffee / hot tea on the menu";
    }
    say("Coffee / decaf", coffee || "", "When does coffee / decaf go out?");
    if (coffee) fact("Coffee / decaf", coffee);
    var cartPlace = coffeeCartPlacement(blob);
    if (cartPlace) fact("Mobile coffee", "Cart rolls in by dessert. Placement: " + cartPlace + ". Urns filled regular and decaf. Cups, cream, sugar, and lemons on the cart.");
    else {
      fact("Mobile coffee", "Urns go on a cart and a table in or near the room, not from the back. Rolls in by dessert. Regular and decaf, with cups, cream, sugar, and lemons. [ask] where the cart goes.", "ask");
      addQ(questions, asked, mgr, "Where does the mobile coffee cart go? The event order does not say.");
    }

    // Set / diagram, AV, storage
    var setBits = [];
    if (roomFoot) setBits.push(roomFoot);
    if (diagrams) setBits.push("Diagram: " + diagrams);
    if (setBits.length) fact("Set / diagram", setBits.join(" · "));
    var av = "";
    if (has(blob, /\bAV\b|podium|screen|stage/i)) {
      var avm = blob.match(/[^·]*(?:8x\d{2} stage|\bAV\b[^·]*|acrylic podium|cocktail table on stage|\d+\s*screens?)[^·]*/gi);
      if (avm) av = avm.map(clean).filter(Boolean).slice(0, 4).join("; ");
    }
    if (av) fact("AV", av);
    var storage = "";
    services.forEach(function (sv) {
      if (/storage|workroom/i.test(sv.tag || "") || /storage|workroom|Camellia B/i.test(sv.menu || "")) {
        storage = clean((sv.time ? sv.time + " " : "") + (sv.tag || "Storage") + (sv.room ? " in " + sv.room : "") + (sv.menu ? " - " + publicText(sv.menu) : ""));
      }
    });
    if (!storage && has(blob, /Camellia B|storage from noon|pickup time/i)) {
      var stm = blob.match(/[^·]*(?:Camellia B|storage from noon|pickup time)[^·]*/i);
      if (stm) storage = clean(stm[0]);
    }
    if (storage) fact("Storage", storage);

    // Conflicts: flags on the card, BEO wins until the manager confirms
    flags.forEach(function (fl) {
      var clipped = fl.replace(/,?\s*confirm(?: the \w+ set)? with \w+\.?/i, "").replace(/[. ]+$/, "").trim();
      fact("Conflict", clipped + ". The event order wins until " + mgr + " confirms.", "flag");
      if (/rounds|bar plan|bartender|diagram|window|7 to 11|7 to 9|set is|mismatch/i.test(fl)) {
        if (clipped && clipped.length < 220) addQ(questions, asked, mgr, clipped + "?");
      }
    });

    // Event-specific BEO notes that already appear as timing, menu, or conflicts on the public Rundown,
    // plus a few operational gaps that belong on a captain script (no prices, no payment data).
    if (kind === "emerson") {
      fact("BEO notes", "Nov 17 event order: dinner 7:00 to 11:00 PM, (9) rounds of 9, filet 43 medium, sea bass 21, chicken 5, tofu 4. One gluten-free filet requested medium rare. One mushroom and clam allergy on chicken. Client wine, hotel pours. Chime at 6:45. Check with Lynn before firing. Do not clear dessert plates.");
      addQ(questions, asked, mgr, "Chicken sides are not listed on the Nov 17 event order (an earlier packet had smashed rosemary fingerlings and chicken demi). What sides go with the chicken?");
      addQ(questions, asked, mgr, "The card calls for 1 passer per 25 guests (3 for 73) and the event order lists 2 passers. How many passers tonight?");
      addQ(questions, asked, mgr, "Should the bar be ready if guests arrive around 5:30, before the 6:00 cocktail start?");
      if (storage) addQ(questions, asked, mgr, "When is Saturday pickup from Camellia B?");
    }
    if (kind === "tsae") {
      fact("BEO notes", "Lunch event order 12:00 to 2:00 PM: (300) chef's choice plated lunch. Pre-set silverware, water glasses, and napkins by 11:00. Doors 12:00, service 12:20 after a short announcement. Welcome from Visit Austin at 12:30, awards at 12:55, program ends at 2:00. No courses, dietaries, or beverage are listed on the lunch event order.");
      addQ(questions, asked, mgr, "What is the actual chef's-choice menu: courses, pre-sets versus walked, bread and butter, dessert, coffee or iced tea?");
      addQ(questions, asked, mgr, "Is 300 the guarantee or only expected, and what should we set?");
      addQ(questions, asked, mgr, "Any bar or wine, or is this water and tea only?");
      addQ(questions, asked, mgr, "Who calls service at 12:20, and who calls any later course around the 12:30 welcome and 12:55 awards?");
      addQ(questions, asked, mgr, "Kitchen fire times, and is dessert pre-set or served after 12:55?");
    }

    if (kind === "tsae") {
      questions = questions.filter(function (q) {
        if (/Who calls salad and entree/i.test(q.q)) return false;
        if (/What are the kitchen fire times for each course/i.test(q.q)) return false;
        if (/Wine pour or bar only/i.test(q.q)) return false;
        if (/When does coffee \/ decaf go out/i.test(q.q)) return false;
        if (/Covers, trays, and jacks needed/i.test(q.q)) return false;
        if (/What is the expo line order/i.test(q.q)) return false;
        return true;
      });
    }

    var script = buildSpokenScript({
      kind: kind,
      group: clean(meal.group || ""),
      room: clean(meal.room || ""),
      time: clean(meal.time || ""),
      mgr: mgr,
      contact: contact,
      counts: counts,
      countsText: countsText,
      menu: menu,
      entreeText: entreeText,
      diet: diet,
      staff: staff,
      timing: timing,
      timelineBits: timelineBits,
      prog: prog,
      calls: calls,
      fire: fire,
      preset: preset,
      wine: wine,
      head: head,
      coffee: coffee,
      setBits: setBits,
      av: av,
      storage: storage,
      flags: flags,
      blob: blob,
      doors: meal.doors,
      appsTime: meal.appsTime
    });

    return {
      group: clean(meal.group || ""),
      date: meal.date || "",
      room: clean(meal.room || ""),
      time: clean(meal.time || ""),
      mgr: mgr,
      contact: contact,
      tag: clean(meal.tag || ""),
      counts: counts,
      lines: lines,
      analysis: analysis,
      script: script,
      questions: questions,
      packet: buildServerPacket({
        group: meal.group,
        date: meal.date,
        room: meal.room,
        time: meal.time,
        menu: meal.menu,
        tag: meal.tag,
        foot: foot,
        extras: meal.extras,
        services: meal.services || [],
        diagrams: meal.diagrams,
        diagramLinks: meal.diagramLinks || [],
        counts: counts,
        doors: meal.doors,
        appsTime: meal.appsTime,
        contact: contact
      })
    };
  }

  var CORKBOARD_SCRIPT = "Before we go over the script, pin all the sheets on the corkboard so they are easy to see: the event order, the section diagram, the timeline, and the server packet.";

  function corkboardPacketStep() {
    return {
      time: "Before pre-shift",
      label: "PIN THE CORKBOARD",
      items: ["Event order", "Section diagram", "Timeline", "Server packet"],
      owners: []
    };
  }

  function speak(parts, text, known) {
    parts.push({ text: text, known: known !== false });
  }

  function buildSpokenScript(f) {
    var lines = [];
    var who = f.mgr || "the manager";
    var contact = f.contact || "the contact";
    speak(lines, CORKBOARD_SCRIPT);
    if (f.kind === "emerson") {
      speak(lines, "This is the Emerson retirement dinner in Primrose C. Guarantee is 73. " + who + " is the manager." + (f.contact ? " " + f.contact + " is the on-site contact." : ""));
      speak(lines, "The table set is not settled. The event order says 9 rounds of 9. The card says 8 tables of 8 plus 1 of 9. " + who + "'s November 18 diagram is 9 rounds of 8, which is 72 seats, one short of the guarantee. The event order wins until " + who + " confirms. [ask]", false);
      speak(lines, "Be ready for the 4:00 client rehearsal. Tables should have client linen, chargers, and silverware by then. Highboys start in the back of Primrose for the florist at 4:00, then move to Pre-Function at 5:00.");
      speak(lines, "We come back around 5:00 to pre-set the roasted pear and pecan salads and waters. Pre-Function should be ready by 5:00. Guests may arrive around 5:30, but the cocktail start on the event order is 6:00. [ask] if the bar should be ready early.", false);
      speak(lines, "Cocktail reception is in Pre-Function from 6:00 to 6:45. Tray-pass hors d'oeuvres: beef tenderloin en croute, crab cake, antipasto skewer, and fig and goat cheese flatbread, 73 of each, plus 50 jackfruit cakes that are vegan and gluten free. The card calls for 1 passer per 25 guests. The event order lists 2 passers. [ask]", false);
      speak(lines, "Chime at 6:45 and open the doors. One hosted-bar plan puts a bar and one bartender inside Primrose C until 11:00. The diagram shows a bar in the hallway by Verbena A and also a bar along the Primrose C side wall. [ask] " + who + " which bar plan is live.", false);
      speak(lines, "Place cards: colored dot is the entree, star is a special meal. Tables are numbered. " + contact + " hands the captain a by-table meal list.");
      speak(lines, "Entree counts: 43 filets cooked medium, 21 sea bass, 5 chicken, 4 tofu. That is 73. One gluten-free guest is on filet and wants it medium rare, not medium. One guest is allergic to mushrooms and clams and is on chicken. Do not send that guest the tofu. It has mushroom risotto.");
      speak(lines, "Salad is pre-set. Rolls and butter go with dinner. Check with " + contact + " before you fire the entrees. [ask] who calls each course. " + serviceCueScriptLine(f.blob).text, false);
      speak(lines, "We pour the client's wine and coffee all night, including during speeches. There is no house wine. White wine should already be chilled from the morning delivery.");
      speak(lines, "Do not clear dessert plates. Dessert is Chocolate Decadence, which is already gluten free. Coffee and hot tea stay through speeches. [ask] when decaf goes out if it is not with the regular coffee.", false);
      speak(lines, "The event order books dinner from 7:00 to 11:00. The rundown card still says 7:00 to 9:00. [ask] which window is live.", false);
      speak(lines, "After service, client linen, florals, and chargers go back to Camellia B. That storage is held Saturday morning. Pickup time is still to be confirmed. [ask]", false);
      speak(lines, coffeeCartScriptLine(f.blob).text, false);
      speak(lines, "Server sections, named staffing, and opening and closing duties are later slots. We will fill those in day-of.");
      return lines;
    }
    if (f.kind === "tsae") {
      speak(lines, "This is the TSAE luncheon in the Primrose Ballroom. Expected count is 300. There is no guarantee on the card yet. " + who + " is the manager." + (f.contact ? " " + f.contact + " is the contact." : ""));
      speak(lines, "The set is not settled. Thursday's event order is 38 rounds of 8 with black linen. The Friday lunch line says rounds of 10. " + who + "'s November 18 diagram shows 44 rounds of 7 and 2 screens. The event order wins until " + who + " confirms. [ask]", false);
      speak(lines, "From 8:00 to 11:00 we pre-set silverware, water glasses, and napkins. Sponsors set activations and help decorate from 8:00. Activations and registration open at 11:00 in the foyer, Lantana, and Plumeria.");
      speak(lines, "Ballroom doors open at 12:00. At 12:20 the musician pauses, there is a short announcement, and lunch service begins. At 12:30 there is a welcome from Visit Austin, during service. At 12:40 guests keep eating with music. At 12:55 the musician pauses for sponsor recognition, awards, and a TSAE recap. The program ends at 2:00 and the band plays as guests leave. Teardown is 2:00 to 3:30.");
      speak(lines, "The meal is chef's choice plated lunch. The event order does not list courses, entrees, dessert, bread, or coffee. [ask] " + who + " for the actual menu, how many courses, and what is pre-set versus walked.", false);
      speak(lines, "[ask] how entree choices are marked, and whether there are allergies or dietary plates by table.", false);
      speak(lines, "No bar or wine is listed on the lunch event order. [ask] if this is water and tea only, and when coffee or decaf goes out.", false);
      speak(lines, "[ask] who calls service at 12:20, and who calls any later course around the 12:30 welcome and the 12:55 awards. " + serviceCueScriptLine(f.blob).text + " [ask] kitchen fire times, and whether dessert is pre-set or held until after 12:55.", false);
      speak(lines, "House standard is serve left, clear right, unless " + who + " says otherwise. [ask] if there is a head table or stage tables first.", false);
      speak(lines, "[ask] any vendor, sponsor, or staff meals, and where they eat.", false);
      speak(lines, coffeeCartScriptLine(f.blob).text, false);
      speak(lines, "Server sections, named staffing, and opening and closing duties are later slots. We will fill those in day-of.");
      return lines;
    }

    // Generic future plated meal, built only from the Rundown card.
    var open = "This is " + (f.group || "the plated meal") + (f.room ? " in " + f.room : "") + ".";
    if (f.countsText) open += " " + f.countsText + ".";
    open += " " + who + " is the manager.";
    if (f.contact) open += " " + f.contact + " is the contact.";
    speak(lines, open);
    if (f.flags && f.flags.length) {
      f.flags.forEach(function (fl) {
        speak(lines, fl + " The event order wins until " + who + " confirms. [ask]", false);
      });
    } else if (f.setBits && f.setBits.length) {
      speak(lines, "Room set: " + f.setBits.join(". ") + ".");
    }
    if (f.timing && f.timing.length) speak(lines, f.timing.join(". ") + ".");
    else speak(lines, "Doors, apps, and seating times: [ask].", false);
    if (f.preset && f.preset.length) speak(lines, "Pre-sets: " + f.preset.join("; ") + ".");
    else speak(lines, "What is pre-set (salad, bread, butter, water, dessert): [ask].", false);
    if (f.entreeText) speak(lines, f.entreeText + (/\b\[ask\]/.test("") ? "" : "."));
    else speak(lines, "Entree and how choices are marked: [ask].", false);
    if (f.diet) speak(lines, "Dietary: " + f.diet + ".");
    else speak(lines, "Allergies or dietary plates by table: [ask].", false);
    if (f.wine) speak(lines, f.wine + ".");
    else speak(lines, "Wine pour or bar only: [ask].", false);
    if (f.prog) speak(lines, "Program: " + f.prog + ".");
    if (f.fire) speak(lines, f.fire + ".");
    else speak(lines, "Kitchen fire times: [ask].", false);
    var cueLine = serviceCueScriptLine(f.blob);
    if (f.calls) speak(lines, f.calls + " " + cueLine.text, cueLine.known);
    else speak(lines, "Who calls each course: [ask]. " + cueLine.text, false);
    if (f.coffee) speak(lines, f.coffee + ".");
    else speak(lines, "Coffee and decaf timing: [ask].", false);
    if (f.head) speak(lines, f.head + ".");
    else speak(lines, "Head table first: [ask].", false);
    speak(lines, "House standard is serve left, clear right, unless the event order says otherwise.");
    if (f.staff) speak(lines, f.staff + ".");
    else speak(lines, "Vendor or staff meals: [ask].", false);
    if (f.storage) speak(lines, "Storage: " + f.storage + ".");
    speak(lines, coffeeCartScriptLine(f.blob || (f.coffee || "")).text, false);
    speak(lines, "Server sections, named staffing, and opening and closing duties are later slots. We will fill those in day-of.");
    return lines;
  }



  function coffeeCartPlacement(blob) {
    var s = String(blob || "");
    var m = s.match(/[^·]*(?:coffee cart|mobile coffee|coffee station)[^·]*/i);
    if (m && /\b(in|near|at|by|outside|foyer|pre-function|hallway|room)\b/i.test(m[0])) return clean(m[0]);
    return "";
  }

  function coffeeCartScriptLine(blob) {
    var place = coffeeCartPlacement(blob);
    var t = "Mobile coffee: urns go on a cart and a table in or near the room, not from the back. Fill regular and decaf, and stock cups, cream, sugar, and lemons on the cart. It rolls in by dessert.";
    if (place) t += " Cart placement: " + place + ".";
    else t += " [ask] where the cart goes; the event order does not say.";
    t += " [ask] who runs it.";
    return { text: t, placement: place, known: !!place };
  }

  var OPENING_DUTIES = [
    "Coffee trays (4)",
    "Bread baskets",
    "Brew tea/coffee",
    "Fold napkins",
    "Coffee cart and table",
    "Fill regular and decaf urns",
    "Cups, cream, sugar, lemons",
    "Breakdown stations",
    "Hotbox stations",
    "Dressings",
    "Butters",
    "Waters"
  ];
  var CLOSING_DUTIES = [
    "Sweep/mop",
    "Beverage station",
    "Strike coffee cart",
    "Trash",
    "Plates to dish"
  ];
  var TEAM_COLORS = ["Yellow", "Green", "Blue", "Red", "Orange", "Purple", "Pink", "Teal", "Brown", "Gray", "Gold", "White"];
  var GUESTS_PER_TEAM = 45;
  var TEAM_GUEST_FLAG = 60;

  function splitDuties(teamCount) {
    var n = Math.max(1, teamCount || 2);
    if (n === 2) {
      return [
        {
          color: "Yellow",
          opening: ["Coffee trays (4)", "Bread baskets", "Brew tea/coffee", "Fold napkins", "Coffee cart and table", "Fill regular and decaf urns", "Cups, cream, sugar, lemons"],
          closing: ["Sweep/mop", "Beverage station", "Strike coffee cart"]
        },
        {
          color: "Green",
          opening: ["Breakdown stations", "Hotbox stations", "Dressings", "Butters", "Waters"],
          closing: ["Trash", "Plates to dish"]
        }
      ];
    }
    var teams = [];
    var i;
    for (i = 0; i < n; i++) {
      teams.push({ color: TEAM_COLORS[i] || ("Team " + (i + 1)), opening: [], closing: [] });
    }
    OPENING_DUTIES.forEach(function (d, idx) { teams[idx % n].opening.push(d); });
    CLOSING_DUTIES.forEach(function (d, idx) { teams[idx % n].closing.push(d); });
    return teams;
  }

  function defaultTeams(teamCount) {
    return splitDuties(teamCount).map(function (t) {
      return { color: t.color, names: ["", ""], opening: t.opening.slice(), closing: t.closing.slice() };
    });
  }

  function headcount(counts) {
    counts = counts || {};
    if (counts.gtd) return parseInt(counts.gtd, 10) || 0;
    if (counts.set) return parseInt(counts.set, 10) || 0;
    if (counts.exp) return parseInt(counts.exp, 10) || 0;
    return 0;
  }

  function defaultTeamCount(counts) {
    var n = headcount(counts);
    if (!n) return 2;
    return Math.max(1, Math.ceil(n / GUESTS_PER_TEAM));
  }

  function parseSeatsPerTable(text) {
    var s = String(text || "").replace(/diagram[^·]{0,160}/gi, " ");
    var eo = s.match(/event order[^·]{0,160}?rounds?\s+of\s+(\d+)/i)
      || s.match(/\bEO\b(?!\s+setup)[^·]{0,120}?rounds?\s+of\s+(\d+)/i);
    if (eo) return parseInt(eo[1], 10);
    var m = s.match(/\(?\d+\)?\s+rounds?\s+of\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    m = s.match(/tables?\s+of\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    return 0;
  }

  function teamLoads(teams, assignments, seatsPerTable) {
    var seats = parseInt(seatsPerTable, 10) || 0;
    return (teams || []).map(function (t) {
      var tables = 0;
      Object.keys(assignments || {}).forEach(function (k) {
        if (assignments[k] === t.color) tables += 1;
      });
      var guests = seats ? tables * seats : 0;
      return { color: t.color, tables: tables, guests: guests, over: seats > 0 && guests > TEAM_GUEST_FLAG };
    });
  }

  function hasNamedServers(teams) {
    return (teams || []).some(function (t) {
      return (t.names || []).some(function (n) { return String(n || "").trim(); });
    });
  }

  function packetKey(date, group) {
    return String(date || "") + "|" + clean(group || "");
  }

  function firstClock(s) {
    s = clean(s);
    if (!s) return "";
    var mer = (s.match(/\b(AM|PM)\b/i) || [])[1] || "";
    var m = s.match(/~?\s*(\d{1,2})(?::(\d{2}))?/);
    if (!m) return "";
    var t = m[1] + ":" + (m[2] || "00");
    if (!mer) {
      var all = s.match(/\b(AM|PM)\b/i);
      if (all) mer = all[1];
    }
    return mer ? (t + " " + mer.toUpperCase()) : t;
  }

  function parseTableCount(text, counts) {
    var s = String(text || "");
    var plus = s.match(/(\d+)\s+tables?\s+of\s+\d+\s*(?:\+|plus)\s*1\s+of\s+\d+/i);
    if (plus) return parseInt(plus[1], 10) + 1;
    var rounds = s.match(/\(?(\d+)\)?\s+rounds?\b/i);
    if (rounds) return parseInt(rounds[1], 10);
    if (counts && counts.set && +counts.set > 3 && +counts.set < 80) return parseInt(counts.set, 10);
    return 0;
  }

  var ROOM_KEYS = [
    "PrimroseBallroom", "PrimroseABC", "PrimroseAB", "PrimroseA", "PrimroseB",
    "PrimroseC", "PrimroseD", "PreFunction", "Pre-Function", "CamelliaAB",
    "CamelliaA", "CamelliaB", "Camellia", "Plumeria", "Lantana", "Barton",
    "Verbena", "Bonnell", "Bluebell", "Buttercup"
  ];

  function softenDiagramName(base) {
    var s = String(base || "");
    ROOM_KEYS.sort(function (a, b) { return b.length - a.length; }).forEach(function (r) {
      var compact = r.replace(/[-\s]/g, "");
      s = s.replace(new RegExp("^" + compact + "(?=from)", "i"), r.replace(/[-\s]/g, ""));
    });
    return s;
  }

  function diagramImageCandidates(pdfPath) {
    if (!pdfPath) return [];
    var file = String(pdfPath).replace(/^.*\//, "").replace(/\.pdf$/i, "");
    var variants = [file, file.replace(/_\d{3,4}$/, "")];
    var more = [];
    variants.forEach(function (v) {
      more.push(v, v.replace(/Dinner/g, ""), v.replace(/Luncheon/g, ""), v.replace(/Activation/g, ""));
    });
    var out = [];
    more.forEach(function (raw) {
      var name = softenDiagramName(raw);
      ["livemap/g_", "livemap/bg_"].forEach(function (pre) {
        var p = pre + name + ".png";
        if (out.indexOf(p) < 0) out.push(p);
      });
    });
    return out;
  }

  function diagramMatchesRoom(room, path, caption) {
    var roomN = clean(room).toLowerCase().replace(/\s+/g, " ");
    if (!roomN) return false;
    var hay = (clean(path) + " " + clean(caption)).toLowerCase();
    var compact = roomN.replace(/[\s-]/g, "");
    var hayC = hay.replace(/[\s-]/g, "");
    if (hayC.indexOf(compact) < 0) return false;
    // Don't let Primrose C match Primrose ABC / Ballroom / D
    if (/^primrose c$/.test(roomN) && /primrose\s*(a|b|ab|abc|d|ballroom)\b/.test(hay) && !/primrose\s*c\b/.test(hay)) return false;
    if (/^primrose ballroom$/.test(roomN) && /primrose\s*d\b/.test(hay) && !/ballroom/.test(hay)) return false;
    return true;
  }

  function pickDiagram(room, links) {
    links = links || [];
    var i, hit = null;
    for (i = 0; i < links.length; i++) {
      if (diagramMatchesRoom(room, links[i].path, links[i].caption)) { hit = links[i]; break; }
    }
    if (!hit && links.length === 1) hit = links[0];
    if (!hit) return { missing: true, images: [], path: "", caption: "" };
    return {
      missing: false,
      path: hit.path || "",
      caption: clean(hit.caption || ""),
      images: diagramImageCandidates(hit.path)
    };
  }

  function collectDiagramLinks(card, helpers) {
    var links = [];
    helpers.qsa(card, "button.diag-link, [onclick*='openDiagram']").forEach(function (btn) {
      var oc = helpers.attr(btn, "onclick") || "";
      var m = oc.match(/openDiagram\('([^']+)'(?:\s*,\s*'([^']*)')?/);
      if (m) links.push({ path: m[1], caption: clean(m[2] || helpers.txt(btn)) });
    });
    return links;
  }

  function breakdownHotboxLocation(services, blob) {
    var location = "";
    (services || []).forEach(function (sv) {
      var tag = sv.tag || "";
      var menu = sv.menu || "";
      if (!/breakdown|hotbox/i.test(tag) && !/breakdown|hotbox/i.test(menu)) return;
      if (/storage|workroom/i.test(tag) && !/breakdown|hotbox/i.test(tag)) return;
      if (sv.room) location = clean(sv.room);
      var named = (tag + " " + menu).match(/(?:breakdown|hotbox)\s*(?:and|&)?\s*(?:hotbox|breakdown)?\s*[-:]\s*([^·]+)/i);
      if (named) location = clean(named[1]);
    });
    if (!location) {
      var loc = String(blob || "").match(/breakdown\s*(?:and|&)?\s*hotbox\s*[-:]\s*([^·]+)/i)
        || String(blob || "").match(/hotbox\s*(?:and|&)?\s*breakdown\s*[-:]\s*([^·]+)/i)
        || String(blob || "").match(/(?:breakdown|hotbox)\s+(?:in|at)\s+([^·,]+)/i);
      if (loc) location = clean(loc[1]);
    }
    return location;
  }

  function buildPacketSteps(meal) {
    meal = meal || {};
    var foot = meal.foot || {};
    var services = meal.services || [];
    var svcText = services.map(function (sv) {
      return [sv.tag, sv.time, sv.menu, sv.room].join(" ");
    }).join(" · ");
    var linkText = (meal.diagramLinks || []).map(function (l) { return (l.caption || "") + " " + (l.path || ""); }).join(" · ");
    var blob = [meal.menu, foot.NOTE, foot.FOOD, foot.ROOM, meal.extras, meal.diagrams, meal.tag, meal.time, svcText, linkText].join(" · ");
    var steps = [corkboardPacketStep()];
    var location = breakdownHotboxLocation(services, blob);

    var setTime = "";
    var setItems = [];
    services.forEach(function (sv) {
      if (/set up/i.test(sv.tag || "")) {
        if (!setTime) {
          var by = (sv.menu || "").match(/set by\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
          setTime = by ? firstClock(by[1]) : firstClock(sv.time || "");
        }
        if (/linen|charger|silverware/i.test(sv.menu || "") || /linen|charger|silverware/i.test(blob)) {
          ["linen", "chargers", "silverware"].forEach(function (w) {
            if (new RegExp(w, "i").test(sv.menu + blob) && setItems.indexOf(w.charAt(0).toUpperCase() + w.slice(1)) < 0) {
              setItems.push(w.charAt(0).toUpperCase() + w.slice(1));
            }
          });
        }
        if (/pre-?set silverware|water glasses and napkins|napkins/i.test(sv.menu || "") || /pre-?set silverware/i.test(blob)) {
          ["Silverware", "Water glasses", "Napkins"].forEach(function (w) {
            if (setItems.indexOf(w) < 0) setItems.push(w);
          });
        }
      }
    });
    if (setTime || setItems.length) {
      steps.push({ time: setTime, label: "SET INSIDE ROOM", items: setItems.length ? setItems : [], owners: [] });
    }

    var swTime = "";
    var sw = blob.match(/back\s*~?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*to pre-set salads?\s*\+?\s*waters?/i)
      || blob.match(/pre-set salads?\s*\+?\s*waters?[^·]*?(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (sw) swTime = firstClock(sw[1]);
    if (!swTime && /pre-set salads?\s*\+?\s*waters?|salads?\s+and\s+waters?/i.test(blob)) {
      // leave time blank if we only know the action
    }
    if (sw || /pre-set salads?\s*\+?\s*waters?|salad and water/i.test(blob)) {
      steps.push({ time: swTime, label: "SET", items: ["Water", "Salad"], owners: [] });
    }

    if (meal.appsTime || /tray-passed|hors\s*d|cocktail reception|pass apps/i.test(blob)) {
      steps.push({ time: firstClock(meal.appsTime || ""), label: "PASS APPS", items: [], owners: ["", ""] });
    }

    steps.push({ time: "", label: "SERVERS AT TABLES", items: [], owners: [] });

    var doorTime = firstClock(meal.doors || "");
    if (!doorTime) {
      var dm = blob.match(/doors?\s*(?:open(?:s|ed)?|at)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i)
        || blob.match(/chime at\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
      if (dm) doorTime = firstClock(dm[1]);
    }
    var enterItems = [];
    if (/rolls?|bread baskets|drop bread/i.test(blob)) enterItems.push("Drop bread");
    steps.push({ time: doorTime, label: "GUESTS ENTER THE ROOM", items: enterItems, owners: [] });

    var specials = [];
    var food = publicText(foot.FOOD || "");
    var dietBits = [];
    if (food && /allerg|dietary|gluten|mushroom|clam/i.test(food)) dietBits.push(food);
    if (/gluten-free who wants it medium rare|NO mushroom/i.test(meal.menu || "")) {
      dietBits.push(publicText((meal.menu || "").match(/1\s+gluten-free[^·]+|1\s+NO\s+[^·]+/gi) ? (meal.menu.match(/1\s+gluten-free[^·]+|1\s+NO\s+[^·]+/gi) || []).join("; ") : ""));
    }
    dietBits = dietBits.filter(Boolean);
    if (dietBits.length) {
      specials.push({ table: "", text: dietBits.join("; ") });
    }

    steps.push({ time: "", label: "WAIT FOR CUE TO DROP ENTREES", items: [], owners: [] });

    var cart = coffeeCartPlacement(blob);
    var cartItems = [
      "Cart and table in or near the room, not from the back",
      "Urns filled, regular and decaf",
      "Cups, cream, sugar, and lemons on the cart"
    ];
    if (cart) cartItems.push("Placement: " + cart);
    else cartItems.push("[ask] where the cart goes");
    steps.push({ time: "By dessert", label: "MOBILE COFFEE", items: cartItems, owners: [""] });

    return { location: location, steps: steps, specials: specials };
  }

  var MIN_SECTION_PCT = 0.5;

  function roundPct(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function newSectionId() {
    return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
  }

  function normalizeSectionBox(box, id) {
    if (!box || !box.team) return null;
    var team = String(box.team || "").trim();
    if (!team) return null;
    var x = Number(box.x);
    var y = Number(box.y);
    var w = Number(box.w);
    var h = Number(box.h);
    if (![x, y, w, h].every(function (n) { return isFinite(n); })) return null;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 100) w = 100 - x;
    if (y + h > 100) h = 100 - y;
    if (x >= 100 || y >= 100 || w < MIN_SECTION_PCT || h < MIN_SECTION_PCT) return null;
    return {
      id: String(box.id || id || newSectionId()),
      team: team,
      x: roundPct(x),
      y: roundPct(y),
      w: roundPct(w),
      h: roundPct(h)
    };
  }

  function sectionBoxFromDrag(x1, y1, x2, y2, rect, team, id) {
    rect = rect || {};
    var width = Number(rect.width);
    var height = Number(rect.height);
    if (!width || !height) return null;
    var left = Number(rect.left) || 0;
    var top = Number(rect.top) || 0;
    return normalizeSectionBox({
      team: team,
      id: id,
      x: ((Number(x1) - left) / width) * 100,
      y: ((Number(y1) - top) / height) * 100,
      w: ((Number(x2) - Number(x1)) / width) * 100,
      h: ((Number(y2) - Number(y1)) / height) * 100
    }, id);
  }

  function normalizeSections(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (box, i) {
      var n = normalizeSectionBox(box, box && box.id ? box.id : "s" + (i + 1));
      if (n) out.push(n);
    });
    return out;
  }

  function hitSection(list, x, y) {
    var i, box, hit = null;
    for (i = 0; i < (list || []).length; i++) {
      box = list[i];
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) hit = box;
    }
    return hit;
  }

  function buildServerPacket(meal) {
    meal = meal || {};
    var room = clean(meal.room || "");
    var foot = meal.foot || {};
    var svcText = (meal.services || []).map(function (sv) {
      return [sv.tag, sv.time, sv.menu, sv.room].join(" ");
    }).join(" · ");
    var duties = defaultTeams(defaultTeamCount(meal.counts));
    var built = buildPacketSteps(meal);
    var tableSource = [meal.diagrams, foot.ROOM, foot.NOTE, (meal.packetNotes || "")].concat(
      (meal.diagramLinks || []).map(function (l) { return l.caption || ""; })
    ).join(" · ");
    var tables = parseTableCount(tableSource, meal.counts);
    var seatSource = [foot.NOTE, meal.menu, meal.extras, svcText, foot.ROOM, foot.FOOD].join(" · ");
    var diagramSeats = [meal.diagrams].concat((meal.diagramLinks || []).map(function (l) { return l.caption || ""; })).join(" · ");
    var seats = parseSeatsPerTable(seatSource) || parseSeatsPerTable(diagramSeats);
    var assignments = {};
    var i;
    for (i = 1; i <= tables; i++) assignments[String(i)] = "";
    return {
      key: packetKey(meal.date, meal.group),
      group: clean(meal.group || ""),
      date: meal.date || "",
      room: room,
      teams: duties,
      location: built.location,
      steps: built.steps,
      specials: built.specials,
      tableCount: tables,
      seatsPerTable: seats,
      assignments: assignments,
      sections: [],
      diagram: pickDiagram(room, meal.diagramLinks || [])
    };
  }

  function mergePacket(base, saved) {
    if (!saved) return base;
    var out = buildServerPacket({ group: base.group, date: base.date, room: base.room });
    // start from freshly built base, then overlay saved editable fields
    out = JSON.parse(JSON.stringify(base));
    var keepTeams = Array.isArray(saved.teams) && saved.teams.length && (saved.teamCount || hasNamedServers(saved.teams));
    if (keepTeams) {
      out.teams = saved.teams.map(function (t, i) {
        var def = base.teams[i] || { color: t.color || TEAM_COLORS[i] || ("Team " + (i + 1)), names: ["", ""], opening: [], closing: [] };
        var names = Array.isArray(t.names) ? t.names.map(function (n) { return String(n || ""); }) : def.names.slice();
        while (names.length < 2) names.push("");
        return {
          color: t.color || def.color,
          names: names.slice(0, Math.max(2, names.length)),
          opening: Array.isArray(t.opening) ? t.opening.slice() : def.opening.slice(),
          closing: Array.isArray(t.closing) ? t.closing.slice() : def.closing.slice()
        };
      });
    }
    if (saved.location != null) out.location = String(saved.location);
    if (Array.isArray(saved.steps)) {
      out.steps = saved.steps.map(function (s, i) {
        var def = base.steps[i] || { time: "", label: "", items: [], owners: [] };
        return {
          time: s.time != null ? String(s.time) : def.time,
          label: s.label != null ? String(s.label) : def.label,
          items: Array.isArray(s.items) ? s.items.map(String) : (def.items || []).slice(),
          owners: Array.isArray(s.owners) ? s.owners.map(String) : (def.owners || []).slice()
        };
      });
      if (!out.steps.some(function (s) { return /PIN THE CORKBOARD/i.test(s.label); })) {
        out.steps = [corkboardPacketStep()].concat(out.steps);
      }
    }
    if (Array.isArray(saved.specials)) {
      out.specials = saved.specials.map(function (s) {
        return { table: String(s.table || ""), text: String(s.text || "") };
      });
    }
    if (saved.assignments && typeof saved.assignments === "object") {
      out.assignments = saved.assignments;
    }
    if (saved.tableCount && +saved.tableCount > 0) out.tableCount = +saved.tableCount;
    if (saved.seatsPerTable != null && +saved.seatsPerTable > 0) out.seatsPerTable = +saved.seatsPerTable;
    if (saved.teamCount && +saved.teamCount > 0) out.teamCount = +saved.teamCount;
    if (Array.isArray(saved.sections)) out.sections = normalizeSections(saved.sections);
    return out;
  }

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
          var k = helpers.txt(helpers.qs(f, ".foot-key") || helpers.qs(f, ".foot-lab")).toUpperCase();
          var v = helpers.txt(helpers.qs(f, ".foot-val"));
          if (!k || k === "BILLING") return;
          foot[k] = foot[k] ? foot[k] + " · " + v : v;
        });
        var appsTime = "";
        var doors = "";
        var extras = [];
        var services = [];
        var diagrams = foot.DIAGRAM || "";
        helpers.qsa(card, ".svc-row").forEach(function (r) {
          var tag = helpers.txt(helpers.qs(r, ".svc-top .tag"));
          var menu = helpers.txt(helpers.qs(r, ".svc-menu"));
          var time = helpers.txt(helpers.qs(r, ".svc-time")).replace(/\s+/g, " ");
          var room = helpers.txt(helpers.qs(r, ".room-pill"));
          var pill = helpers.txt(helpers.qs(r, ".gtd-pill"));
          services.push({ tag: tag, time: time, room: room, pill: pill, menu: menu });
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
          if (!isPlated(tag, menu)) return;
          var room = helpers.txt(helpers.qs(r, ".room-pill"));
          var pill = helpers.txt(helpers.qs(r, ".gtd-pill"));
          var time = helpers.txt(helpers.qs(r, ".svc-time")).replace(/\s+/g, " ");
          var diagramLinks = collectDiagramLinks(card, helpers);
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
            services: services,
            diagrams: diagrams,
            diagramLinks: diagramLinks,
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
    publicText: publicText,
    extractFlags: extractFlags,
    buildPreShift: buildPreShift,
    CORKBOARD_SCRIPT: CORKBOARD_SCRIPT,
    corkboardPacketStep: corkboardPacketStep,
    serviceCueFromEO: serviceCueFromEO,
    CUE_QUESTION: CUE_QUESTION,
    collectPlated: collectPlated,
    OPENING_DUTIES: OPENING_DUTIES,
    CLOSING_DUTIES: CLOSING_DUTIES,
    splitDuties: splitDuties,
    defaultTeams: defaultTeams,
    headcount: headcount,
    defaultTeamCount: defaultTeamCount,
    parseSeatsPerTable: parseSeatsPerTable,
    teamLoads: teamLoads,
    packetKey: packetKey,
    parseTableCount: parseTableCount,
    breakdownHotboxLocation: breakdownHotboxLocation,
    diagramImageCandidates: diagramImageCandidates,
    pickDiagram: pickDiagram,
    buildServerPacket: buildServerPacket,
    mergePacket: mergePacket,
    normalizeSectionBox: normalizeSectionBox,
    sectionBoxFromDrag: sectionBoxFromDrag,
    normalizeSections: normalizeSections,
    hitSection: hitSection
  };
});
