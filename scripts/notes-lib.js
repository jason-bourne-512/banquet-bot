// Shared Notes tab helpers. Used by notes.html (browser) and test-notes.js (Node).
// Step 1 is read-only: sample notes only. No backend, no remote writes.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Notes = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TZ = "America/Chicago";
  var SAMPLE_BANNER = "Sample notes for demo. Nothing is saved yet.";
  var PAGE_SUB = "Side notes and FYIs. Anything critical still goes on the BEO or to your manager.";
  var INTRO_KEY = "bb-notes-intro-seen";
  var INTRO_COPY = "New: Notes. Pick a date to see each event's notes, grouped by person. Side notes and FYIs only. Anything critical still goes on the BEO or to your manager. Sample notes for now, saving comes soon.";

  // Pinned general notes: not tied to a date or event. Shown on every date. First names only.
  var SAMPLE_PINNED = [
    {
      name: "Hector",
      at: "2026-11-18T09:00:00-06:00",
      text: "China and glass extras live on the Camellia back wall. Ask before pulling from banquet store."
    },
    {
      name: "Jason",
      at: "2026-11-19T14:20:00-06:00",
      text: "If a client asks for a last-minute logo, flag it to Lisa. Do not promise a print time."
    },
    {
      name: "Jason",
      at: "2026-11-20T08:05:00-06:00",
      text: "Ice machine on 2 is slow in the afternoon. Start filling banquet wells earlier on big days."
    }
  ];

  // Sample threads keyed to real Rundown group names. First names only. No prices, PINs, or payment data.
  var SAMPLE_NOTES = [
    {
      date: "2026-11-20",
      group: "Emerson \u2014 Retirement Dinner (Primrose C)",
      name: "Jason",
      at: "2026-11-20T17:10:00-06:00",
      text: "Head table is 8, not 10. Diana confirmed after the walkthrough."
    },
    {
      date: "2026-11-20",
      group: "Emerson \u2014 Retirement Dinner (Primrose C)",
      name: "Hector",
      at: "2026-11-20T17:42:00-06:00",
      text: "Wine is already on the order. Chill it as opening side work."
    },
    {
      date: "2026-11-21",
      group: "Emerson \u2014 Storage Pickup (Camellia B)",
      name: "Diana",
      at: "2026-11-21T08:15:00-06:00",
      text: "Pickup window still TBD. Lynn will call the desk when the truck is on the way."
    },
    {
      date: "2026-11-21",
      group: "San Jose Barracuda \u2014 Meal Room (Plumeria)",
      name: "Lisa",
      at: "2026-11-21T07:05:00-06:00",
      text: "Meal room only, no F&B from us. They bring their own food. Set 36."
    },
    {
      date: "2026-11-21",
      group: "San Jose Barracuda \u2014 Meal Room (Plumeria)",
      name: "Jason",
      at: "2026-11-21T07:28:00-06:00",
      text: "Joe is IC. Doors at 8. Leave the corridor clear for the team bus."
    },
    {
      date: "2026-11-21",
      group: "San Jose Barracuda \u2014 Meal Room (Plumeria)",
      name: "Jason",
      at: "2026-11-21T09:15:00-06:00",
      text: "Bus is early. I told Joe we will open the meal room as soon as they get here."
    },
    {
      date: "2026-11-24",
      group: "Tucson Roadrunners \u2014 Team Meeting (Camellia)",
      name: "Lisa",
      at: "2026-11-23T16:40:00-06:00",
      text: "Same setup as last year's team meeting. Confirm water and notepads in the morning."
    }
  ];

  function clean(s) {
    return String(s || "").replace(/[ \t]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function firstName(s) {
    s = clean(s).replace(/^(MGR|IC|CONTACT):\s*/i, "");
    if (!s) return "";
    return s.split(/[\s,·/(]/)[0];
  }

  function normalizeGroup(s) {
    return clean(s)
      .replace(/&amp;/g, "&")
      .replace(/[\u2014\u2013]/g, "-")
      .toLowerCase();
  }

  function eventKey(date, group) {
    return String(date || "") + "\t" + normalizeGroup(group);
  }

  function todayISO(now) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now || new Date());
  }

  function isISODate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  }

  function shiftISODate(iso, days) {
    if (!isISODate(iso)) return iso;
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function formatDayLabel(iso) {
    if (!isISODate(iso)) return "";
    var d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric", timeZone: "UTC"});
  }

  function formatNoteTime(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {timeZone: TZ, hour: "numeric", minute: "2-digit"});
  }

  function formatPinnedTime(at) {
    var d = new Date(at);
    if (isNaN(d.getTime())) return "";
    var day = d.toLocaleDateString("en-US", {timeZone: TZ, weekday: "short", month: "short", day: "numeric"});
    var time = formatNoteTime(at);
    return time ? day + " · " + time : day;
  }

  function collectAllEvents(helpers) {
    var seen = {};
    var out = [];
    (helpers.sections || []).forEach(function (sec) {
      var date = helpers.attr(sec, "data-date") || "";
      if (!isISODate(date) || seen[date]) return;
      seen[date] = 1;
      helpers.qsa(sec, ".event-card").forEach(function (card) {
        var group = helpers.txt(helpers.qs(card, ".card-group"));
        if (!group) return;
        var rooms = [];
        helpers.qsa(card, ".room-pill").forEach(function (r) {
          var t = helpers.txt(r);
          if (t && rooms.indexOf(t) < 0) rooms.push(t);
        });
        var timeEl = helpers.qs(card, ".svc-time");
        var time = timeEl ? helpers.txt(timeEl).replace(/\s+/g, " ") : "";
        out.push({date: date, group: group, rooms: rooms, time: time});
      });
    });
    return out;
  }

  function collectEvents(helpers, dateISO) {
    return collectAllEvents(helpers).filter(function (ev) { return ev.date === dateISO; });
  }

  function notesFor(notes, date, group) {
    var key = eventKey(date, group);
    return (notes || []).filter(function (n) {
      return eventKey(n.date, n.group) === key;
    }).slice().sort(function (a, b) {
      return String(a.at || "").localeCompare(String(b.at || ""));
    }).map(function (n) {
      return {
        date: n.date,
        group: n.group,
        name: firstName(n.name),
        at: n.at,
        text: clean(n.text),
        timeLabel: formatNoteTime(n.at)
      };
    });
  }

  // One block per person, notes oldest first, blocks ordered by each person's earliest note.
  function groupNotesByAuthor(notes) {
    var map = {};
    var blocks = [];
    (notes || []).forEach(function (n) {
      var name = n.name || "";
      if (!map[name]) {
        map[name] = {name: name, notes: []};
        blocks.push(map[name]);
      }
      map[name].notes.push(n);
    });
    blocks.forEach(function (b) {
      b.notes = b.notes.slice().sort(function (a, c) {
        return String(a.at || "").localeCompare(String(c.at || ""));
      });
    });
    blocks.sort(function (a, c) {
      var atA = a.notes[0] && a.notes[0].at || "";
      var atC = c.notes[0] && c.notes[0].at || "";
      return String(atA).localeCompare(String(atC));
    });
    return blocks;
  }

  function pinnedNotes(notes) {
    return (notes || []).slice().sort(function (a, b) {
      return String(a.at || "").localeCompare(String(b.at || ""));
    }).map(function (n) {
      return {
        name: firstName(n.name),
        at: n.at,
        text: clean(n.text),
        timeLabel: formatPinnedTime(n.at)
      };
    });
  }

  function pinnedAuthors(notes) {
    return groupNotesByAuthor(pinnedNotes(notes));
  }

  function eventsWithNotes(events, notes) {
    return (events || []).map(function (ev) {
      var list = notesFor(notes, ev.date, ev.group);
      return {
        date: ev.date,
        group: ev.group,
        rooms: ev.rooms || [],
        time: ev.time || "",
        notes: list,
        authors: groupNotesByAuthor(list)
      };
    });
  }

  function storageOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (e) {}
    return null;
  }

  function introSeen(storage) {
    try {
      var s = storageOf(storage);
      return !!(s && s.getItem(INTRO_KEY) === "1");
    } catch (e) {
      return false;
    }
  }

  function markIntroSeen(storage) {
    try {
      var s = storageOf(storage);
      if (s) s.setItem(INTRO_KEY, "1");
    } catch (e) {}
  }

  function shouldShowIntro(storage) {
    return !introSeen(storage);
  }

  function injectIntroStyle(doc) {
    if (!doc || doc.getElementById("bb-notes-intro-style")) return;
    var style = doc.createElement("style");
    style.id = "bb-notes-intro-style";
    style.textContent =
      ".bb-notes-intro{position:fixed;z-index:2147483002;width:min(280px,calc(100vw - 24px));box-sizing:border-box;" +
        "background:#121c25;color:#e6eef4;border:1px solid #8bd1ff66;border-left:3px solid #8bd1ff;border-radius:10px;" +
        "box-shadow:0 12px 40px #000a,0 0 0 1px #8bd1ff22;font:13px/1.45 Manrope,'Segoe UI',sans-serif;" +
        "padding:12px 12px 10px}" +
      ".bb-notes-intro .bb-notes-intro-text{margin:0 0 10px;color:#d6e3ee}" +
      ".bb-notes-intro .bb-notes-intro-got{background:#1d3344;color:#8bd1ff;border:1px solid #8bd1ff66;border-radius:8px;" +
        "font:700 12px Manrope,sans-serif;padding:6px 12px;cursor:pointer}" +
      ".bb-notes-intro .bb-notes-intro-got:hover{border-color:#8bd1ff;color:#fff}" +
      ".bb-notes-intro .bb-notes-intro-arrow{position:absolute;width:10px;height:10px;background:#121c25;" +
        "border:1px solid #8bd1ff66;transform:rotate(45deg);pointer-events:none}" +
      ".bb-notes-intro.arrow-left .bb-notes-intro-arrow{left:-6px;top:var(--bb-arrow-pos,50%);margin-top:-5px;border-right:0;border-top:0}" +
      ".bb-notes-intro.arrow-top .bb-notes-intro-arrow{top:-6px;left:var(--bb-arrow-pos,24px);border-bottom:0;border-right:0}" +
      ".bb-notes-intro.arrow-bottom .bb-notes-intro-arrow{bottom:-6px;left:var(--bb-arrow-pos,24px);border-top:0;border-left:0}" +
      "@media (max-width:700px){.bb-notes-intro{width:min(300px,calc(100vw - 20px))}}";
    doc.head.appendChild(style);
  }

  function showNotesIntro(opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (typeof window !== "undefined" ? window : null);
    var storage = opts.storage;
    if (!doc || !win || introSeen(storage)) return null;

    var sideLink = doc.querySelector('.bbd-side a[href="notes.html"]');
    var homeLink = doc.querySelector("a.destination.notes");
    var anchor = sideLink || homeLink;
    if (!anchor) return null;

    var old = doc.querySelector(".bb-notes-intro");
    if (old) {
      if (old._bbAnchor === anchor) return old;
      if (typeof old._bbCleanup === "function") old._bbCleanup();
      else if (old.parentNode) old.parentNode.removeChild(old);
    }

    injectIntroStyle(doc);
    var bubble = doc.createElement("div");
    bubble.className = "bb-notes-intro";
    bubble.setAttribute("role", "dialog");
    bubble.setAttribute("aria-label", "About Notes");
    bubble.innerHTML = '<p class="bb-notes-intro-text"></p><button type="button" class="bb-notes-intro-got">Got it</button>' +
      '<span class="bb-notes-intro-arrow" aria-hidden="true"></span>';
    bubble.querySelector(".bb-notes-intro-text").textContent = INTRO_COPY;
    doc.body.appendChild(bubble);
    bubble._bbAnchor = anchor;

    function cleanup() {
      win.removeEventListener("resize", place);
      win.removeEventListener("scroll", place, true);
      anchor.removeEventListener("click", dismiss);
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }
    function dismiss() {
      markIntroSeen(storage);
      cleanup();
    }
    bubble._bbCleanup = cleanup;

    function place() {
      if (!bubble.parentNode) return;
      var r = anchor.getBoundingClientRect();
      var bw = bubble.offsetWidth;
      var bh = bubble.offsetHeight;
      var gap = 14;
      var pad = 10;
      var left, top, side = "left";
      var canRight = r.right + gap + bw <= win.innerWidth - pad;
      if (sideLink || canRight) {
        left = r.right + gap;
        top = r.top + r.height / 2 - bh / 2;
        side = "left";
      } else if (r.bottom + gap + bh <= win.innerHeight - pad) {
        left = r.left;
        top = r.bottom + gap;
        side = "top";
      } else {
        left = r.left;
        top = r.top - gap - bh;
        side = "bottom";
      }
      left = Math.max(pad, Math.min(left, win.innerWidth - bw - pad));
      top = Math.max(pad, Math.min(top, win.innerHeight - bh - pad));
      bubble.style.left = left + "px";
      bubble.style.top = top + "px";
      bubble.classList.remove("arrow-left", "arrow-top", "arrow-bottom");
      bubble.classList.add("arrow-" + side);
      var ax, ay;
      if (side === "left") {
        ay = r.top + r.height / 2 - top;
        bubble.style.setProperty("--bb-arrow-pos", Math.max(14, Math.min(ay, bh - 14)) + "px");
      } else {
        ax = r.left + r.width / 2 - left;
        bubble.style.setProperty("--bb-arrow-pos", Math.max(14, Math.min(ax, bw - 14)) + "px");
      }
    }

    bubble.querySelector(".bb-notes-intro-got").addEventListener("click", function (e) {
      e.preventDefault();
      dismiss();
    });
    anchor.addEventListener("click", dismiss);
    win.addEventListener("resize", place);
    win.addEventListener("scroll", place, true);
    place();
    return bubble;
  }

  return {
    TZ: TZ,
    SAMPLE_BANNER: SAMPLE_BANNER,
    SAMPLE_NOTES: SAMPLE_NOTES,
    SAMPLE_PINNED: SAMPLE_PINNED,
    PAGE_SUB: PAGE_SUB,
    INTRO_KEY: INTRO_KEY,
    INTRO_COPY: INTRO_COPY,
    clean: clean,
    firstName: firstName,
    normalizeGroup: normalizeGroup,
    eventKey: eventKey,
    todayISO: todayISO,
    isISODate: isISODate,
    shiftISODate: shiftISODate,
    formatDayLabel: formatDayLabel,
    formatNoteTime: formatNoteTime,
    formatPinnedTime: formatPinnedTime,
    collectAllEvents: collectAllEvents,
    collectEvents: collectEvents,
    notesFor: notesFor,
    groupNotesByAuthor: groupNotesByAuthor,
    pinnedNotes: pinnedNotes,
    pinnedAuthors: pinnedAuthors,
    eventsWithNotes: eventsWithNotes,
    introSeen: introSeen,
    markIntroSeen: markIntroSeen,
    shouldShowIntro: shouldShowIntro,
    showNotesIntro: showNotesIntro
  };
});
