// Shared Notes tab helpers. Used by notes.html (browser) and test-notes.js (Node).
// Step 1 is read-only: sample notes only. No backend, no remote writes.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Notes = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TZ = "America/Chicago";
  var SAMPLE_BANNER = "Sample notes for demo. Nothing is saved yet.";

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

  function eventsWithNotes(events, notes) {
    return (events || []).map(function (ev) {
      return {
        date: ev.date,
        group: ev.group,
        rooms: ev.rooms || [],
        time: ev.time || "",
        notes: notesFor(notes, ev.date, ev.group)
      };
    });
  }

  return {
    TZ: TZ,
    SAMPLE_BANNER: SAMPLE_BANNER,
    SAMPLE_NOTES: SAMPLE_NOTES,
    clean: clean,
    firstName: firstName,
    normalizeGroup: normalizeGroup,
    eventKey: eventKey,
    todayISO: todayISO,
    isISODate: isISODate,
    shiftISODate: shiftISODate,
    formatDayLabel: formatDayLabel,
    formatNoteTime: formatNoteTime,
    collectAllEvents: collectAllEvents,
    collectEvents: collectEvents,
    notesFor: notesFor,
    eventsWithNotes: eventsWithNotes
  };
});
