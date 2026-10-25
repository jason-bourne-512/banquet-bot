// Banquet Bot site search (Jason, 2026-10-25): events from today on, menus, and the reference docs.
// Everything is read from the site's own pages on first use and searched on the phone, so results always match
// the pages. Loaded on every page by theme.js. On the page a result links to, ?find= opens and highlights the spot.
// No prices and no phone numbers ever show in results.
(function () {
  if (window.bbSearch) return;
  var TZ = "America/Chicago";

  // Reference documents. To add one (e.g. the plated meal guide), build its page with the same card layout and add a line here.
  var DOCS = [
    {url: "handbook.html", name: "Associate Handbook", card: ".hb-card", title: ".hb-title", sub: ".hb-sub", subTitle: ".hb-sub-title"},
    {url: "training.html", name: "Server Training", card: ".tr-card", title: ".tr-title", sub: ".tr-sub", subTitle: ".tr-sub-title"},
    {url: "playbook.html", name: "Captain Playbook", card: ".tr-card", title: ".tr-title", sub: ".tr-sub", subTitle: ".tr-sub-title"},
    {url: "bar.html", name: "Bar Reference", card: ".tr-card", title: ".tr-title", sub: ".tr-sub", subTitle: ".tr-sub-title"},
    {url: "rooms.html", name: "Room Specs", card: ".room-card", title: ".room-name"},
    {url: "info.html", name: "Property Info", card: ".card", title: ".card-title, .card-label, .section-label"}
  ];

  function today() { return new Intl.DateTimeFormat("en-CA", {timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date()); }
  function clean(s) {
    return String(s || "").replace(/\s*\+?\$[\d,.]+(?:\s*\/\s*\w+)?(?:\s+(?:ea|each)\b)?/gi, "")
      .replace(/\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, "").replace(/\s+/g, " ").trim();
  }
  // Element text with a space between pieces, so side-by-side labels don't run together.
  function txt(el) {
    if (!el) return "";
    var out = [], it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (it.nextNode()) out.push(it.currentNode.nodeValue);
    return clean(out.join(" "));
  }
  // lower case, accents dropped: "crudite" finds "Crudité" (same length for precomposed letters)
  function fold(s) { return String(s).normalize("NFC").replace(/[\u00C0-\u024F]/g, function (c) { return c.normalize("NFD")[0]; }).toLowerCase(); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function page(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (h) { return new DOMParser().parseFromString(h, "text/html"); });
  }
  function dayLabel(iso) {
    var d = new Date(iso + "T12:00:00Z");
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + " " + (d.getUTCMonth() + 1) + "/" + d.getUTCDate();
  }

  var built = null;
  function build() {
    if (built) return built;
    var T = today();
    var events = page("rundown.html").then(function (doc) {
      var seen = {}, out = [];
      doc.querySelectorAll(".day-section[data-date]").forEach(function (day) {
        var d = day.getAttribute("data-date");
        if (d < T || seen[d]) return;   // past days never show; the page repeats each day for the Overview, keep the first
        seen[d] = 1;
        day.querySelectorAll(".event-card").forEach(function (c) {
          var g = c.querySelector(".card-group"), title = g ? clean(g.textContent) : "";
          if (!title) return;
          var rooms = [];
          c.querySelectorAll(".room-pill").forEach(function (r) { var t = clean(r.textContent); if (t && rooms.indexOf(t) < 0) rooms.push(t); });
          var t = c.querySelector(".svc-time");
          out.push({type: "event", date: d, title: title, meta: rooms.join(" · "), time: t ? clean(t.textContent) : "",
                    text: txt(c), url: "rundown.html?date=" + d, anchor: title});
        });
      });
      return out;
    });
    var menus = page("menu.html").then(function (doc) {
      return Array.prototype.map.call(doc.querySelectorAll(".menu-sub"), function (sub) {
        var t = sub.querySelector(".sub-title"), items = [];
        sub.querySelectorAll(".menu-item").forEach(function (it) {
          [".item-name", ".item-desc"].forEach(function (sel) { var e = it.querySelector(sel), x = e ? clean(e.textContent) : ""; if (x) items.push(x); });
        });
        var title = t ? clean(t.textContent) : "";
        return {type: "menu", title: title, items: items, text: title + " " + items.join(" "), url: "menu.html", anchor: title};
      }).filter(function (m) { return m.title; });
    });
    var docs = DOCS.map(function (p) {
      return page(p.url).then(function (doc) {
        var out = [];
        doc.querySelectorAll(p.card).forEach(function (card) {
          var ct = card.querySelector(p.title), ctitle = ct ? clean(ct.textContent) : p.name;
          var subs = p.sub ? card.querySelectorAll(p.sub) : [];
          out.push({type: "doc", page: p.name, title: ctitle, text: subs.length ? ctitle : txt(card), url: p.url, anchor: ctitle});
          subs.forEach(function (s) {
            var st = s.querySelector(p.subTitle), stitle = st ? clean(st.textContent) : "";
            out.push({type: "doc", page: p.name, title: ctitle + (stitle ? " › " + stitle : ""), text: txt(s), url: p.url, anchor: stitle || ctitle});
          });
        });
        return out;
      });
    });
    built = Promise.all([events, menus].concat(docs).map(function (p) { return p.catch(function () { return []; }); }))
      .then(function (all) { return [].concat.apply([], all); });
    return built;
  }

  function words(q) { return fold(q).split(/\s+/).filter(Boolean); }
  function hits(index, q) {
    var w = words(q);
    if (!w.length) return [];
    // short words (like the "d" in "primrose d") must be whole words; longer ones can match inside a word
    var tests = w.map(function (k) { var e = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return k.length < 3 ? new RegExp("(^|[^a-z0-9])" + e + "($|[^a-z0-9])") : null; });
    return index.filter(function (x) {
      var hay = fold(x.title + " " + x.text);
      return w.every(function (k, i) { return tests[i] ? tests[i].test(hay) : hay.indexOf(k) > -1; });
    }).map(function (x) {
      var t = fold(x.title);
      return {x: x, s: w.filter(function (k) { return t.indexOf(k) > -1; }).length};
    }).sort(function (a, b) {
      if (a.x.type == "event" && b.x.type == "event") return a.x.date < b.x.date ? -1 : a.x.date > b.x.date ? 1 : b.s - a.s;
      return b.s - a.s;
    }).map(function (h) { return h.x; });
  }
  // A short piece of text around the first match, with the search words marked.
  function snippet(text, q) {
    var w = words(q), low = fold(text), at = low.indexOf(w[0]);
    if (at < 0) at = 0;
    var a = Math.max(0, at - 50), b = Math.min(text.length, at + 110);
    var s = (a ? "…" : "") + text.slice(a, b) + (b < text.length ? "…" : ""), h = esc(s);
    w.forEach(function (k) { h = markFold(h, k); });
    return h;
  }
  function markFold(h, k) {
    var f = fold(h), out = "", i = 0, at;
    while ((at = f.indexOf(k, i)) > -1) {
      var amp = h.lastIndexOf("&", at);
      if (h.lastIndexOf("<", at) > h.lastIndexOf(">", at) || (amp > -1 && amp > h.lastIndexOf(";", at) && at - amp < 8)) { out += h.slice(i, at + 1); i = at + 1; continue; }   // inside a tag or an &entity;
      out += h.slice(i, at) + "<mark>" + h.slice(at, at + k.length) + "</mark>"; i = at + k.length;
    }
    return out + h.slice(i);
  }
  function link(x, q) {
    return x.url + (x.url.indexOf("?") > -1 ? "&" : "?") + "find=" + encodeURIComponent(q) +
      (x.anchor ? "&in=" + encodeURIComponent(x.anchor) : "") + (x.type == "event" ? "#rundown" : "");
  }

  var css = document.createElement("style");
  css.textContent =
    ".bbs-group{margin:12px 0 4px;font:800 10px Manrope,Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#8fcfff}" +
    ".bbs-hit{display:block;text-decoration:none;border:1px solid #3a566a;background:#192d3b;border-radius:8px;padding:10px 12px;margin:6px 0;color:#deeffb;font:12px/1.45 Manrope,Arial,sans-serif}" +
    ".bbs-hit:hover,.bbs-hit:focus{border-color:#89cdff;outline:0}" +
    ".bbs-hit small{display:block;font-size:10px;letter-spacing:.4px;color:#9fbdd1;margin-bottom:2px}" +
    ".bbs-hit b{display:block;font-size:13px;color:#eaf6ff}" +
    ".bbs-hit span{display:block;font-size:11px;color:#b5cbdb;margin-top:3px}" +
    ".bbs-hit mark,mark.bb-find{background:#ffd76a55;color:inherit;border-radius:3px;padding:0 1px}" +
    "mark.bb-find{background:#ffd76a;color:#1b1406;box-shadow:0 0 0 3px #ffd76a66;animation:bbFind 2.6s ease-out 1}" +
    "@keyframes bbFind{0%,40%{box-shadow:0 0 0 6px #ffd76aaa}100%{box-shadow:0 0 0 3px #ffd76a33}}" +
    ".bbs-more{font:11px Manrope,Arial,sans-serif;color:#9fbdd1;margin:4px 2px 0}";
  document.head.appendChild(css);

  var GROUPS = [["event", "📅 Events", 8], ["menu", "🍽 Menus", 6], ["doc", "📄 Documents", 8]];
  // Wires a search box: input element, results container, optional status line.
  function attach(input, box, status) {
    var timer = null;
    function say(t) { if (status) status.textContent = t; }
    function run() {
      var q = input.value.trim();
      box.replaceChildren(); say("");
      if (!q) { box.dispatchEvent(new Event("bbs-empty")); return; }
      build().then(function (index) {
        if (input.value.trim() !== q) return;   // a newer keystroke owns the results
        var all = hits(index, q);
        box.replaceChildren();
        if (!all.length) { say("Nothing found for “" + q + "”."); box.dispatchEvent(new Event("bbs-results")); return; }
        say(all.length + (all.length == 1 ? " result" : " results"));
        GROUPS.forEach(function (g) {
          var list = all.filter(function (x) { return x.type == g[0]; });
          if (!list.length) return;
          var h = document.createElement("div"); h.className = "bbs-group"; h.textContent = g[1]; box.append(h);
          list.slice(0, g[2]).forEach(function (x) {
            var a = document.createElement("a"); a.className = "bbs-hit"; a.href = link(x, q);
            if (x.type == "event") a.innerHTML = "<small>" + esc(dayLabel(x.date) + (x.time ? " · " + x.time : "")) + "</small><b>" + esc(x.title) + "</b>" + (x.meta ? "<span>" + esc(x.meta) + "</span>" : "");
            else if (x.type == "menu") a.innerHTML = "<small>Menu</small><b>" + esc(x.title) + "</b><span>" + snippet(x.items.join(" · "), q) + "</span>";
            else a.innerHTML = "<small>" + esc(x.page) + "</small><b>" + esc(x.title) + "</b><span>" + snippet(x.text, q) + "</span>";
            box.append(a);
          });
          if (list.length > g[2]) { var m = document.createElement("p"); m.className = "bbs-more"; m.textContent = "+" + (list.length - g[2]) + " more; type more to narrow it down."; box.append(m); }
        });
        box.dispatchEvent(new Event("bbs-results"));
      }).catch(function () { say("Search couldn't load. Check your signal and try again."); });
    }
    input.addEventListener("focus", function () { build(); }, {once: true});
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 120); });
  }

  // Landing: a result links here with ?find=<search>&in=<card or section title>. Open that spot and highlight it.
  function land() {
    var p = new URLSearchParams(location.search), q = p.get("find");
    if (!q) return;
    var w = words(q), hint = p.get("in"), tries = 0;
    var cfg = DOCS.filter(function (d) { return location.pathname.slice(-d.url.length) == d.url; })[0];
    function textNodes(root) {
      var out = [], it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: function (n) {
        var e = n.parentElement;
        if (!e || e.closest("script,style,input,textarea,.bbd-top,.bbd-side,#bb-demo-tag")) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }});
      while (it.nextNode()) out.push(it.currentNode);
      return out;
    }
    function attempt() {
      var root = document.getElementById("rdScreen") || document.body, scope = root;
      if (hint) {
        var title = textNodes(root).filter(function (n) { return clean(n.nodeValue) == hint; })[0];
        if (title) {
          var e = title.parentElement;
          scope = (cfg && cfg.sub && e.closest(cfg.sub)) || (cfg && e.closest(cfg.card)) || e.closest("[class*=card],[class*=block],section,details") || e.parentElement;
        }
      }
      var node = null;
      [scope, root].some(function (r) {
        node = textNodes(r).filter(function (n) { return fold(n.nodeValue).indexOf(w[0]) > -1; })[0] || null;
        return node;
      });
      if (!node) { if (++tries < 16) setTimeout(attempt, 250); return; }
      // open every collapsed card or <details> around the match
      for (var e = node.parentElement; e; e = e.parentElement) {
        if (e.tagName == "DETAILS") e.open = true;
        if (cfg && e.matches(cfg.card) && !e.classList.contains("open")) {
          if (typeof window.toggleCard == "function") window.toggleCard(e); else e.classList.add("open");
        }
      }
      var at = fold(node.nodeValue).indexOf(w[0]), r = document.createRange(), m = document.createElement("mark");
      m.className = "bb-find";
      r.setStart(node, at); r.setEnd(node, at + w[0].length);
      try { r.surroundContents(m); } catch (err) { m = node.parentElement; }
      setTimeout(function () { m.scrollIntoView({block: "center", behavior: "smooth"}); }, 60);
    }
    if (document.readyState == "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(attempt, 150); });
    else setTimeout(attempt, 150);
  }

  window.bbSearch = {attach: attach, build: build, docs: DOCS};
  window.dispatchEvent(new Event("bb-search-ready"));
  land();
})();
