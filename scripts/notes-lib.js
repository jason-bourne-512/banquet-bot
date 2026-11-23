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
  var TESTER_KEY = "bb-notes-tester";
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
        id: n.id,
        deviceId: n.deviceId,
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
        id: n.id,
        deviceId: n.deviceId,
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

  function isNotesPath(pathname) {
    if (pathname == null) {
      try {
        if (typeof location !== "undefined") pathname = location.pathname || "";
      } catch (e) {
        pathname = "";
      }
    }
    return /(^|\/)notes\.html$/i.test(String(pathname || ""));
  }

  function notesQueryValue(search) {
    if (search == null) {
      try {
        if (typeof location !== "undefined") search = location.search || "";
      } catch (e) {
        search = "";
      }
    }
    try {
      return new URLSearchParams(String(search || "")).get("notes");
    } catch (e) {
      return null;
    }
  }

  function isNotesTester(storage) {
    try {
      var s = storageOf(storage);
      return !!(s && s.getItem(TESTER_KEY) === "1");
    } catch (e) {
      return false;
    }
  }

  function setNotesTester(on, storage) {
    try {
      var s = storageOf(storage);
      if (!s) return;
      if (on) s.setItem(TESTER_KEY, "1");
      else s.removeItem(TESTER_KEY);
    } catch (e) {}
  }

  // Opt in with ?notes=on on any page, or by opening notes.html. ?notes=off clears it.
  function applyNotesTester(opts) {
    opts = opts || {};
    var q = notesQueryValue(opts.search);
    if (q === "on") setNotesTester(true, opts.storage);
    else if (q === "off") setNotesTester(false, opts.storage);
    else if (opts.onNotesPage || isNotesPath(opts.pathname)) setNotesTester(true, opts.storage);
    return isNotesTester(opts.storage);
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
    return isNotesTester(storage) && !introSeen(storage);
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
    if (!doc || !win || !shouldShowIntro(storage)) return null;

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

  // ---- Step 2: Firestore saving, behind Firebase Auth (Banquet Bot Firebase only, not The Wire) ----
  var NAME_KEY = "bb-notes-name";
  var DEVICE_KEY = "bb-notes-device";
  var COLLECTION = "notes";
  var BEO_NOTES = "beoNotes";
  var BEO_HIGHLIGHTS = "beoHighlights";
  var MAX_TEXT = 500;
  var MAX_NAME = 24;
  var MAX_HIGHLIGHTS = 50;
  var MIN_HIGHLIGHT_PCT = 1;
  var DELETE_WINDOW_MS = 15 * 60 * 1000;
  var OWNER_NAME = "Jason";
  var FIREBASE_BASE = "https://www.gstatic.com/firebasejs/10.14.1/";
  var OPS_REMINDER = "Ops notes only. Do not post guest payment details, card numbers, or PINs.";
  var LIVE_BANNER = "Live notes. Saved to Banquet Bot. Your first name shows on each note.";
  var SIGN_IN_BANNER = "Sign in with Google to load and save notes.";
  var NO_ACCESS = "This Google account does not have access to notes.";

  function configValue(cfg, k) {
    var v = cfg && cfg[k];
    return typeof v === "string" && v.length > 0 && !/^(YOUR_|REPLACE|PASTE|TODO)/i.test(v) ? v : "";
  }

  // Firebase web config is public by design. Ready means the keys the SDK needs are all present.
  function firebaseConfigReady(cfg) {
    if (!cfg || typeof cfg !== "object" || cfg.disabled) return false;
    return ["apiKey", "projectId", "appId"].every(function (k) { return !!configValue(cfg, k); });
  }

  // App Check is optional until a site key exists. No key means it is skipped.
  function appCheckSiteKey(cfg) {
    return firebaseConfigReady(cfg) ? configValue(cfg, "appCheckSiteKey") : "";
  }

  // Signed in means a real Firebase user. The rules still decide whether that user is the owner.
  function isSignedIn(user) {
    return !!(user && typeof user.uid === "string" && user.uid);
  }

  // Load the SDK pieces only once config is ready. loadModule("firebase-app") returns the module (dynamic import in the page).
  // Order matters: App Check starts right after initializeApp and before Firestore is used.
  function connectFirebase(cfg, loadModule) {
    if (!firebaseConfigReady(cfg)) return Promise.reject(new Error("Firebase is not configured."));
    var siteKey = appCheckSiteKey(cfg);
    return Promise.all([loadModule("firebase-app"), loadModule("firebase-firestore"), loadModule("firebase-auth")]).then(function (m) {
      var app = m[0].initializeApp(cfg);
      var ready = Promise.resolve(false);
      if (siteKey) {
        ready = loadModule("firebase-app-check").then(function (ac) {
          ac.initializeAppCheck(app, {provider: new ac.ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true});
          return true;
        }).catch(function () { return false; });
      }
      return ready.then(function (appCheck) {
        return {app: app, db: m[1].getFirestore(app), fs: m[1], auth: m[2].getAuth(app), authApi: m[2], appCheck: appCheck};
      });
    });
  }

  function signInWithGoogle(ctx) {
    var provider = new ctx.authApi.GoogleAuthProvider();
    return ctx.authApi.signInWithPopup(ctx.auth, provider).catch(function (err) {
      var msg = String((err && err.code) || "") + " " + String((err && err.message) || "");
      if (/popup|cancelled|canceled|internal-error|operation-not-supported|web-storage/i.test(msg)) {
        return ctx.authApi.signInWithRedirect(ctx.auth, provider);
      }
      return Promise.reject(err);
    });
  }

  function signOutUser(ctx) {
    return ctx.authApi.signOut(ctx.auth);
  }

  // cb(user or null). Returns the unsubscribe function.
  function watchAuth(ctx, cb) {
    return ctx.authApi.onAuthStateChanged(ctx.auth, function (user) { cb(isSignedIn(user) ? user : null); });
  }

  function isPermissionError(err) {
    return !!(err && (err.code === "permission-denied" || /permission|insufficient/i.test(String(err.message || ""))));
  }

  // Blocks things that look like card numbers, PINs, CVVs, or passwords. Notes are ops-only.
  function looksLikePayment(text) {
    var t = String(text || "");
    if (/\b(?:\d[ -]?){13,19}\b/.test(t)) return true;
    return /\b(cvv|cvc|card number|credit card|pin|passcode|password)\b\s*(is|:|#|=)?\s*\S*\d/i.test(t);
  }

  function validateNoteText(text) {
    var t = clean(text);
    if (!t) return {ok: false, reason: "Write a note first."};
    if (t.length > MAX_TEXT) return {ok: false, reason: "Keep it under " + MAX_TEXT + " characters."};
    if (looksLikePayment(t)) return {ok: false, reason: OPS_REMINDER};
    return {ok: true, text: t};
  }

  function authorFirstName(s) {
    return firstName(s).slice(0, MAX_NAME);
  }

  function newDeviceId() {
    var r = "";
    for (var i = 0; i < 12; i++) r += Math.floor(Math.random() * 36).toString(36);
    return "d-" + r;
  }

  function getDeviceId(storage) {
    var s = storageOf(storage);
    try {
      var id = s && s.getItem(DEVICE_KEY);
      if (id) return id;
      id = newDeviceId();
      if (s) s.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) {
      return newDeviceId();
    }
  }

  function getSavedName(storage) {
    try {
      var s = storageOf(storage);
      return s ? authorFirstName(s.getItem(NAME_KEY) || "") : "";
    } catch (e) {
      return "";
    }
  }

  function saveName(name, storage) {
    var n = authorFirstName(name);
    try {
      var s = storageOf(storage);
      if (s && n) s.setItem(NAME_KEY, n);
    } catch (e) {}
    return n;
  }

  // Build the Firestore document. Event notes need date + group; pinned notes carry neither.
  function buildNoteDoc(o) {
    o = o || {};
    var v = validateNoteText(o.text);
    if (!v.ok) throw new Error(v.reason);
    var name = authorFirstName(o.authorFirstName);
    if (!name) throw new Error("Pick your first name first.");
    var pinned = !!o.pinned;
    var doc = {
      text: v.text,
      authorFirstName: name,
      createdAt: o.createdAt || new Date().toISOString(),
      createdByDeviceId: String(o.createdByDeviceId || ""),
      pinned: pinned
    };
    if (!pinned) {
      if (!isISODate(o.date)) throw new Error("Missing date.");
      var group = clean(o.group);
      if (!group) throw new Error("Missing event.");
      doc.date = o.date;
      doc.group = group;
      if (o.eventId) doc.eventId = String(o.eventId);
    }
    return doc;
  }

  // Firestore doc -> the shape notesFor/pinnedNotes already use.
  function fromDoc(id, d) {
    d = d || {};
    return {
      id: id,
      date: d.date,
      group: d.group,
      eventId: d.eventId,
      name: d.authorFirstName || "",
      at: d.createdAt || "",
      text: d.text || "",
      pinned: !!d.pinned,
      deviceId: d.createdByDeviceId || ""
    };
  }

  // Author deletes own note within 15 minutes (same name and device). Jason can delete any.
  // This is a UI convenience. The rules allow only the signed-in owner to delete.
  function canDelete(note, who, now) {
    if (!note || !who) return false;
    var name = authorFirstName(who.name);
    if (!name) return false;
    if (name === OWNER_NAME) return true;
    if (authorFirstName(note.name) !== name) return false;
    if (note.deviceId && who.deviceId && note.deviceId !== who.deviceId) return false;
    var t = new Date(note.at).getTime();
    if (isNaN(t)) return false;
    var age = (now ? new Date(now).getTime() : Date.now()) - t;
    return age >= 0 && age <= DELETE_WINDOW_MS;
  }

  // Backend adapter over the Firestore modular SDK functions (passed in so Node tests can fake them).
  // fsApi: {collection, query, where, getDocs, addDoc, deleteDoc, doc}
  function createFirestoreBackend(fsApi, db) {
    function run(field, value) {
      var q = fsApi.query(fsApi.collection(db, COLLECTION), fsApi.where(field, "==", value));
      return fsApi.getDocs(q).then(function (snap) {
        var out = [];
        snap.forEach(function (d) { out.push(fromDoc(d.id, d.data())); });
        return out;
      });
    }
    return {
      byDate: function (date) { return run("date", date); },
      pinned: function () { return run("pinned", true); },
      add: function (data) {
        return fsApi.addDoc(fsApi.collection(db, COLLECTION), data).then(function (ref) { return ref.id; });
      },
      remove: function (id) { return fsApi.deleteDoc(fsApi.doc(db, COLLECTION, id)); }
    };
  }

  // Store with the API the page uses. backend: {byDate, pinned, add, remove}. Null backend = sample mode.
  function createNotesStore(backend, opts) {
    opts = opts || {};
    var live = !!backend;
    function sortAt(list) {
      return list.slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    }
    return {
      live: live,
      listNotes: function (args) {
        var date = args && args.date;
        if (!live) return Promise.resolve(SAMPLE_NOTES.filter(function (n) { return n.date === date; }));
        return backend.byDate(date).then(function (l) {
          return sortAt(l.filter(function (n) { return !n.pinned; }));
        });
      },
      listPinned: function () {
        if (!live) return Promise.resolve(SAMPLE_PINNED.slice());
        return backend.pinned().then(sortAt);
      },
      addNote: function (o) {
        if (!live) return Promise.reject(new Error("Saving is not set up yet."));
        var doc;
        try { doc = buildNoteDoc(o); } catch (e) { return Promise.reject(e); }
        return backend.add(doc).then(function (id) { return fromDoc(id, doc); });
      },
      deleteNote: function (note, who, now) {
        if (!live) return Promise.reject(new Error("Saving is not set up yet."));
        if (!note || !note.id) return Promise.reject(new Error("Note has no id."));
        if (!canDelete(note, who, now)) return Promise.reject(new Error("You can delete your own note for 15 minutes."));
        return backend.remove(note.id);
      }
    };
  }

  // ---- BEO notes and highlights ----
  // A BEO is identified by service date, EO number, and the print it came from (the latest version's printed date).
  // beo-originals/index.json shape: {eo, printed, pages[], versions[{printed, source}]}.
  function beoIdentity(date, eo) {
    eo = eo || {};
    var v = eo.versions || [];
    var last = v.length ? v[v.length - 1] : null;
    return {
      date: date,
      eo: String(eo.eo || ""),
      printed: (last && last.printed) || eo.printed || "",
      revision: Math.max(1, v.length),
      source: String((last && last.source) || "").slice(0, 120)
    };
  }

  function beoIdentityOk(id) {
    return !!(id && isISODate(id.date) && /^\d{1,12}$/.test(id.eo) && isISODate(id.printed) && id.revision >= 1 && id.revision <= 99);
  }

  function beoIdentityFields(id) {
    if (!beoIdentityOk(id)) throw new Error("Missing BEO date, EO number, or print date.");
    return {date: id.date, eo: id.eo, printed: id.printed, revision: id.revision, source: String(id.source || "").slice(0, 120)};
  }

  function beoNoteDoc(o) {
    o = o || {};
    var v = validateNoteText(o.text);
    if (!v.ok) throw new Error(v.reason);
    var doc = beoIdentityFields(o);
    doc.text = v.text;
    doc.createdAt = o.createdAt || new Date().toISOString();
    return doc;
  }

  function beoNoteFromDoc(id, d) {
    d = d || {};
    return {id: id, date: d.date, eo: d.eo, printed: d.printed, revision: d.revision, source: d.source || "", at: d.createdAt || "", text: d.text || ""};
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // Box in 0-100% of the page image. Accepts negative width/height (drag up or left), clamps into the page,
  // and drops anything smaller than MIN_HIGHLIGHT_PCT. Same math idea as PreShift.sectionBoxFromDrag.
  function normalizeHighlight(box) {
    if (!box) return null;
    var x = Number(box.x), y = Number(box.y), w = Number(box.w), h = Number(box.h);
    if (![x, y, w, h].every(function (n) { return isFinite(n); })) return null;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 100) w = 100 - x;
    if (y + h > 100) h = 100 - y;
    // A swipe along one axis is a thin band, not a discarded zero-height line.
    if (w >= MIN_HIGHLIGHT_PCT && h < MIN_HIGHLIGHT_PCT) {
      var midY = y + h / 2;
      h = MIN_HIGHLIGHT_PCT;
      y = midY - h / 2;
      if (y < 0) y = 0;
      if (y + h > 100) y = 100 - h;
    } else if (h >= MIN_HIGHLIGHT_PCT && w < MIN_HIGHLIGHT_PCT) {
      var midX = x + w / 2;
      w = MIN_HIGHLIGHT_PCT;
      x = midX - w / 2;
      if (x < 0) x = 0;
      if (x + w > 100) x = 100 - w;
    }
    if (x >= 100 || y >= 100 || w < MIN_HIGHLIGHT_PCT || h < MIN_HIGHLIGHT_PCT) return null;
    var out = {x: round2(x), y: round2(y), w: round2(w), h: round2(h)};
    if (box.id != null) out.id = String(box.id);
    return out;
  }

  // Client pixels to percent of the image rect (from getBoundingClientRect).
  function pointPct(px, py, rect) {
    rect = rect || {};
    var width = Number(rect.width), height = Number(rect.height);
    if (!width || !height) return null;
    return {
      x: Math.max(0, Math.min(100, ((Number(px) - (Number(rect.left) || 0)) / width) * 100)),
      y: Math.max(0, Math.min(100, ((Number(py) - (Number(rect.top) || 0)) / height) * 100))
    };
  }

  function highlightFromDrag(x1, y1, x2, y2, rect, id) {
    var a = pointPct(x1, y1, rect), b = pointPct(x2, y2, rect);
    if (!a || !b) return null;
    return normalizeHighlight({id: id, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y});
  }

  // Topmost (latest drawn) highlight under the point, or null.
  function hitHighlight(list, x, y) {
    var hit = null;
    (list || []).forEach(function (b) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) hit = b;
    });
    return hit;
  }

  function removeHighlight(list, id) {
    return (list || []).filter(function (b) { return b.id !== id; });
  }

  // Smallest free slot 1..MAX_HIGHLIGHTS on a page, or 0 when the page is full.
  function nextHighlightSlot(list) {
    var used = {};
    (list || []).forEach(function (b) { if (b.slot) used[b.slot] = 1; });
    for (var i = 1; i <= MAX_HIGHLIGHTS; i++) if (!used[i]) return i;
    return 0;
  }

  // Doc id doubles as the page key plus slot, so the rules can cap highlights per page.
  function beoPageKey(id, page) {
    return id.date + "_" + id.eo + "_" + id.printed + "_r" + id.revision + "_p" + (Number(page) + 1);
  }

  function highlightDocId(id, page, slot) {
    return beoPageKey(id, page) + "_h" + slot;
  }

  // o: BEO identity + {page (0-based index), slot, x, y, w, h}. Returns {id, data}.
  function highlightDoc(o) {
    o = o || {};
    var data = beoIdentityFields(o);
    var page = Number(o.page), slot = Number(o.slot);
    if (!(page >= 0 && page < 99 && Math.floor(page) === page)) throw new Error("Missing BEO page.");
    if (!(slot >= 1 && slot <= MAX_HIGHLIGHTS && Math.floor(slot) === slot)) throw new Error("Too many highlights on this page.");
    var box = normalizeHighlight(o);
    if (!box) throw new Error("Highlight is too small.");
    data.page = page;
    data.slot = slot;
    data.x = box.x; data.y = box.y; data.w = box.w; data.h = box.h;
    data.createdAt = o.createdAt || new Date().toISOString();
    return {id: highlightDocId(o, page, slot), data: data};
  }

  function highlightFromDoc(id, d) {
    d = d || {};
    return {id: id, date: d.date, eo: d.eo, printed: d.printed, revision: d.revision, page: d.page, slot: d.slot, x: d.x, y: d.y, w: d.w, h: d.h};
  }

  // Highlights that belong to this BEO print and page.
  function highlightsFor(list, id, page) {
    return (list || []).filter(function (h) {
      return h.date === id.date && h.eo === id.eo && h.printed === id.printed && Number(h.revision) === Number(id.revision) && h.page === page;
    });
  }

  // Notes for this BEO across every print; each carries its own printed date.
  function beoNotesFor(list, date, eo) {
    return (list || []).filter(function (n) { return n.date === date && n.eo === String(eo); })
      .slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }

  // fsApi: {collection, query, where, getDocs, addDoc, setDoc, deleteDoc, doc}
  function createBeoBackend(fsApi, db) {
    function byDate(coll, map, date) {
      var q = fsApi.query(fsApi.collection(db, coll), fsApi.where("date", "==", date));
      return fsApi.getDocs(q).then(function (snap) {
        var out = [];
        snap.forEach(function (d) { out.push(map(d.id, d.data())); });
        return out;
      });
    }
    return {
      notesByDate: function (date) { return byDate(BEO_NOTES, beoNoteFromDoc, date); },
      highlightsByDate: function (date) { return byDate(BEO_HIGHLIGHTS, highlightFromDoc, date); },
      addNote: function (data) { return fsApi.addDoc(fsApi.collection(db, BEO_NOTES), data).then(function (ref) { return ref.id; }); },
      removeNote: function (id) { return fsApi.deleteDoc(fsApi.doc(db, BEO_NOTES, id)); },
      putHighlight: function (id, data) { return fsApi.setDoc(fsApi.doc(db, BEO_HIGHLIGHTS, id), data); },
      removeHighlight: function (id) { return fsApi.deleteDoc(fsApi.doc(db, BEO_HIGHLIGHTS, id)); }
    };
  }

  // Null backend = not signed in: every call rejects and nothing touches Firestore.
  function createBeoStore(backend) {
    var live = !!backend;
    function locked() { return Promise.reject(new Error(SIGN_IN_BANNER)); }
    return {
      live: live,
      listNotes: function (date) { return live ? backend.notesByDate(date) : locked(); },
      listHighlights: function (date) { return live ? backend.highlightsByDate(date) : locked(); },
      addNote: function (o) {
        if (!live) return locked();
        var data;
        try { data = beoNoteDoc(o); } catch (e) { return Promise.reject(e); }
        return backend.addNote(data).then(function (id) { return beoNoteFromDoc(id, data); });
      },
      deleteNote: function (id) { return live && id ? backend.removeNote(id) : locked(); },
      addHighlight: function (o) {
        if (!live) return locked();
        var built;
        try { built = highlightDoc(o); } catch (e) { return Promise.reject(e); }
        return backend.putHighlight(built.id, built.data).then(function () { return highlightFromDoc(built.id, built.data); });
      },
      deleteHighlight: function (id) { return live && id ? backend.removeHighlight(id) : locked(); }
    };
  }

  return {
    NAME_KEY: NAME_KEY,
    DEVICE_KEY: DEVICE_KEY,
    COLLECTION: COLLECTION,
    BEO_NOTES: BEO_NOTES,
    BEO_HIGHLIGHTS: BEO_HIGHLIGHTS,
    MAX_TEXT: MAX_TEXT,
    MAX_NAME: MAX_NAME,
    MAX_HIGHLIGHTS: MAX_HIGHLIGHTS,
    MIN_HIGHLIGHT_PCT: MIN_HIGHLIGHT_PCT,
    DELETE_WINDOW_MS: DELETE_WINDOW_MS,
    FIREBASE_BASE: FIREBASE_BASE,
    OPS_REMINDER: OPS_REMINDER,
    LIVE_BANNER: LIVE_BANNER,
    SIGN_IN_BANNER: SIGN_IN_BANNER,
    NO_ACCESS: NO_ACCESS,
    firebaseConfigReady: firebaseConfigReady,
    appCheckSiteKey: appCheckSiteKey,
    isSignedIn: isSignedIn,
    connectFirebase: connectFirebase,
    signInWithGoogle: signInWithGoogle,
    signOutUser: signOutUser,
    watchAuth: watchAuth,
    isPermissionError: isPermissionError,
    looksLikePayment: looksLikePayment,
    validateNoteText: validateNoteText,
    authorFirstName: authorFirstName,
    getDeviceId: getDeviceId,
    getSavedName: getSavedName,
    saveName: saveName,
    buildNoteDoc: buildNoteDoc,
    fromDoc: fromDoc,
    canDelete: canDelete,
    createFirestoreBackend: createFirestoreBackend,
    createNotesStore: createNotesStore,
    beoIdentity: beoIdentity,
    beoNoteDoc: beoNoteDoc,
    beoNoteFromDoc: beoNoteFromDoc,
    beoNotesFor: beoNotesFor,
    normalizeHighlight: normalizeHighlight,
    pointPct: pointPct,
    highlightFromDrag: highlightFromDrag,
    hitHighlight: hitHighlight,
    removeHighlight: removeHighlight,
    nextHighlightSlot: nextHighlightSlot,
    beoPageKey: beoPageKey,
    highlightDoc: highlightDoc,
    highlightFromDoc: highlightFromDoc,
    highlightsFor: highlightsFor,
    createBeoBackend: createBeoBackend,
    createBeoStore: createBeoStore,
    TZ: TZ,
    SAMPLE_BANNER: SAMPLE_BANNER,
    SAMPLE_NOTES: SAMPLE_NOTES,
    SAMPLE_PINNED: SAMPLE_PINNED,
    PAGE_SUB: PAGE_SUB,
    INTRO_KEY: INTRO_KEY,
    TESTER_KEY: TESTER_KEY,
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
    isNotesPath: isNotesPath,
    isNotesTester: isNotesTester,
    setNotesTester: setNotesTester,
    applyNotesTester: applyNotesTester,
    introSeen: introSeen,
    markIntroSeen: markIntroSeen,
    shouldShowIntro: shouldShowIntro,
    showNotesIntro: showNotesIntro
  };
});
