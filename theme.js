// Personal looks for Banquet Bot. Open any page once with ?me=<name> and this phone keeps that look
// (?me=off clears it). The Housemen page also switches it on when that person signs in.
// Includes team logo (hotlinked from ESPN) and the Venezuelan flag (img/flag-venezuela.svg).
(function () {
  function vars(v) {
    return "html:root,html body{" + Object.keys(v).map(function (k) { return "--" + k + ":" + v[k] + "!important"; }).join(";") + "}";
  }
  function palette(accent, accentDim, bg, card, card2, line, line2) {
    return vars({
      "accent": accent, "accent-dim": accentDim, "accent-d": accentDim, "blue": accent, "blue-dim": accentDim,
      "set": accent, "set-d": accentDim, "bg": bg, "bg-card": card, "card": card, "bg-active": card2, "card2": card2,
      "line": line, "line2": line2, "border": line, "border-h": line2, "glow": accentDim
    }) + "html body{background-color:" + bg + "!important}";
  }
  var BADGE = ".bb-me-badge{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:9999;" +
    "padding:6px 14px;border-radius:30px;font:800 10px/1.2 Manrope,Arial,sans-serif;letter-spacing:1.8px;pointer-events:none;white-space:nowrap;box-shadow:0 4px 18px #0008}";
  var THEMES = {
    // Baltimore Ravens: purple, black, gold
    dylan: {
      label: "DYLAN · RAVENS FLOCK",
      img: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
      mark: {src: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png", opacity: .07},
      tint: {color: "#5b2bd6", opacity: .55},
      // Dragon Ball Z cast (drawn for Banquet Bot, img/dbz/): a different fighter peeks in on each page.
      cast: {"index.html": "goku", "today.html": "gohan", "rundown.html": "vegeta", "overview.html": "piccolo", "housemen.html": "krillin",
        "menu.html": "buu", "training.html": "roshi", "rooms.html": "frieza", "room-map.html": "radar", "*": "dragonball"},
      css: palette("#a98bf0", "rgba(169,139,240,.14)", "#0c0816", "#171027", "#231839", "rgba(169,139,240,.14)", "rgba(201,162,39,.35)") +
        "body::before{background:radial-gradient(ellipse at 100% 0,#24177399,transparent 50%),radial-gradient(ellipse at 0 100%,#c9a22722,transparent 55%),#0c0816!important}" +
        "h1,h2{color:#e9dcff}" + BADGE +
        ".bb-me-badge{color:#f1d27a;background:linear-gradient(135deg,#241773,#120b33);border:1px solid #c9a22788}" +
        "@keyframes bbCastIn{from{transform:translateY(110%)}to{transform:none}}" +
        // ki aura: a golden power-up glow that breathes around the fighter
        "@keyframes bbKi{0%,100%{filter:drop-shadow(0 0 8px #ffd54a99) drop-shadow(0 0 2px #fff6) drop-shadow(0 4px 10px #000a)}" +
        "50%{filter:drop-shadow(0 0 22px #ffd54aee) drop-shadow(0 0 6px #fff) drop-shadow(0 4px 10px #000a)}}" +
        // energy beam: an orb charges at the fighter's hands, then a beam blasts across the bottom of the screen
        ".bb-orb{position:fixed;width:26px;height:26px;border-radius:50%;z-index:9996;pointer-events:none;" +
        "background:radial-gradient(circle,#fff 0 22%,#9fe8ff 40%,#3aa8ff 62%,transparent 72%);box-shadow:0 0 24px 8px #59c2ffcc;animation:bbOrb 1.6s ease-in forwards}" +
        ".bb-beam{position:fixed;height:22px;right:0;z-index:9995;pointer-events:none;transform-origin:left center;border-radius:0 14px 14px 0;" +
        "background:linear-gradient(180deg,transparent,#3aa8ffcc 18%,#bdf1ff 42%,#fff 50%,#bdf1ff 58%,#3aa8ffcc 82%,transparent);" +
        "box-shadow:0 0 28px 10px #3aa8ff88;animation:bbBeam 1.6s ease-out forwards}" +
        "@keyframes bbOrb{0%{transform:scale(.2);opacity:0}35%{transform:scale(1.3);opacity:1}55%{transform:scale(1);opacity:1}100%{transform:scale(1.6);opacity:0}}" +
        "@keyframes bbBeam{0%,40%{transform:scaleX(0);opacity:0}55%{transform:scaleX(1);opacity:1}82%{transform:scaleX(1);opacity:.95}100%{transform:scaleX(1);opacity:0}}" +
        "@media (prefers-reduced-motion:reduce){.bb-cast{animation:none!important}.bb-orb,.bb-beam{display:none!important}}"
    },
    // Venezuelan flag: yellow, blue, red + the arc of eight stars
    tomas: {
      label: "TOMAS · VENEZUELA",
      img: "img/flag-venezuela.svg",
      mark: {src: "img/flag-venezuela.svg", opacity: .05},
      css: palette("#ffd23f", "rgba(255,210,63,.14)", "#06102a", "#0d1c45", "#14275c", "rgba(255,210,63,.14)", "rgba(207,20,43,.45)") +
        "body::before{background:linear-gradient(180deg,#ffcc0033 0,#ffcc0024 33%,#00247d44 33%,#00247d44 66%,#cf142b2e 66%),#06102a!important}" +
        "h1,h2{color:#fff2c2}" + BADGE +
        ".bb-me-badge{color:#ffd23f;border:1px solid #ffcc0099;background:linear-gradient(135deg,#00247d,#001447)}"
    },
    // La Vinotinto (Venezuela's national team): wine red and gold
    francisco: {
      label: "FRANCISCO · LA VINOTINTO",
      img: "img/flag-venezuela.svg",
      aurora: true,
      pet: "img/me/francisco-cockatiel.svg",   // his cockatiel (original art): bobs and sways; tap it and it hops + flaps
      tint: {color: "#9e1f45", opacity: .45},
      css: palette("#f2c14e", "rgba(242,193,78,.14)", "#1a070d", "#2a0d17", "#3a1220", "rgba(242,193,78,.14)", "rgba(242,193,78,.38)") +
        "body::before{background:radial-gradient(ellipse at 100% 0,#7b1e3a99,transparent 52%),radial-gradient(ellipse at 0 100%,#f2c14e1f,transparent 55%),#1a070d!important}" +
        "h1,h2{color:#ffe7b0}" + BADGE +
        ".bb-me-badge{color:#f2c14e;background:linear-gradient(135deg,#7b1e3a,#3a0d1c);border:1px solid #f2c14e88}" +
        // aurora borealis: soft green/teal/violet curtains drifting across the top of the screen
        ".bb-aurora{position:fixed;left:-20%;right:-20%;top:-12vh;height:62vh;z-index:0;pointer-events:none;filter:blur(38px);opacity:.55;mix-blend-mode:screen;" +
        "background:radial-gradient(40% 55% at 20% 40%,#3dffb0aa,transparent 70%),radial-gradient(35% 50% at 55% 30%,#2ee6d6aa,transparent 70%)," +
        "radial-gradient(38% 55% at 82% 45%,#9b6bffaa,transparent 70%);animation:bbAurora 18s ease-in-out infinite alternate}" +
        ".bb-aurora::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 0 20%,#7dffcf33 30%,transparent 42%,#b993ff2e 58%,transparent 70%);" +
        "animation:bbAurora2 11s ease-in-out infinite alternate}" +
        "@keyframes bbAurora{0%{transform:translateX(-6%) skewY(-3deg) scaleY(.9)}50%{transform:translateX(4%) skewY(2deg) scaleY(1.1)}100%{transform:translateX(8%) skewY(-1deg) scaleY(.95)}}" +
        "@keyframes bbAurora2{0%{transform:translateX(-10%);opacity:.6}100%{transform:translateX(10%);opacity:1}}" +
        "@media (prefers-reduced-motion:reduce){.bb-aurora,.bb-aurora::after{animation:none}}" +
        "@keyframes bbPetIn{from{transform:translateY(110%)}to{transform:none}}" +
        "@keyframes bbHop{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-26px) rotate(-6deg)}35%{transform:translateY(-30px) rotate(5deg)}" +
        "50%{transform:translateY(-12px) rotate(-4deg)}65%{transform:translateY(-18px) rotate(3deg)}85%{transform:translateY(0) rotate(0)}}" +
        ".bb-pet.hop{animation:bbHop 1.1s ease-in-out!important}" +
        "@media (prefers-reduced-motion:reduce){.bb-pet,.bb-pet.hop{animation:none!important}}"
    },
    // Lisa (Events Manager): Puro San Antonio — the Alamo under Fiesta papel picado (img/me, original art).
    // No palette change: her rose accent comes from the Housemen page.
    lisa: {
      label: "LISA · PURO SAN ANTONIO",
      img: "img/me/lisa-san-antonio.svg",
      mark: {src: "img/me/lisa-san-antonio.svg", opacity: .08},
      monkey: "img/me/lisa-monkey.svg",   // home page only: a big monkey swinging on a vine, random side each visit
      css: BADGE + ".bb-me-badge{color:#ffd1e4;background:linear-gradient(135deg,#5a1f3a,#2a0f1d);border:1px solid #ff9ec788}" +
        "@keyframes bbVineIn{from{transform:translateY(-110%)}to{transform:none}}" +
        "@keyframes bbSwing{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}" +
        "@keyframes bbSwingOff{0%{transform:rotate(0)}30%{transform:rotate(-14deg)}100%{transform:translateY(-120%) rotate(10deg)}}" +
        ".bb-monkey{animation:bbVineIn .9s cubic-bezier(.3,1.4,.5,1) both,bbSwing 3.4s ease-in-out .9s infinite}" +
        ".bb-monkey.off{animation:bbSwingOff .9s ease-in forwards!important}" +
        "@media (prefers-reduced-motion:reduce){.bb-monkey{animation:none!important}}"
    },
    // Diana (Senior Events Manager): H-Town · Space City — Houston skyline with a launch (img/me, original art).
    diana: {
      label: "DIANA · H-TOWN · SPACE CITY",
      img: "img/me/diana-houston.svg",
      mark: {src: "img/me/diana-houston.svg", opacity: .08},
      css: BADGE + ".bb-me-badge{color:#e3d6ff;background:linear-gradient(135deg,#2e1f5a,#140d2e);border:1px solid #c1a6ff88}"
    }
  };
  function apply(key) {
    var old = document.getElementById("bb-me-theme"); if (old) old.remove();
    var oldB = document.querySelector(".bb-me-badge"); if (oldB) oldB.remove();
    var oldA = document.querySelector(".bb-aurora"); if (oldA) oldA.remove();
    var oldT = document.querySelector(".bb-tint"); if (oldT) oldT.remove();
    var oldM = document.querySelector(".bb-mark"); if (oldM) oldM.remove();
    var oldC = document.querySelector(".bb-cast"); if (oldC) oldC.remove();
    var oldP = document.querySelector(".bb-pet"); if (oldP) oldP.remove();
    var oldK = document.querySelector(".bb-monkey"); if (oldK) oldK.remove();
    if (document.body) document.body.className = document.body.className.replace(/\bme-\S+/g, "").trim();
    var t = key && THEMES[key];
    if (!t) return;
    var st = document.createElement("style"); st.id = "bb-me-theme"; st.textContent = t.css;
    document.head.appendChild(st);
    var addBadge = function () {
      document.body.classList.add("me-" + key);
      var b = document.createElement("div"); b.className = "bb-me-badge";
      if (t.img) { var im = document.createElement("img"); im.src = t.img; im.alt = "";
        im.style.cssText = "height:18px;width:auto;vertical-align:middle;margin:-3px 7px -3px -4px;border-radius:2px"; b.appendChild(im); }
      b.appendChild(document.createTextNode(t.label));
      document.body.appendChild(b);
      if (t.mark) { var m = document.createElement("img"); m.className = "bb-mark"; m.src = t.mark.src; m.alt = "";
        var ms = {position:"fixed", left:"50%", top:"52%", width:"min(70vw,420px)", height:"auto", "max-height":"60vh", "object-fit":"contain",
          transform:"translate(-50%,-50%)", "z-index":"9997", "pointer-events":"none", opacity:String(t.mark.opacity),
          border:"0", "border-radius":"0", background:"none", margin:"0", padding:"0", "box-shadow":"none"};
        for (var k in ms) m.style.setProperty(k, ms[k], "important");
        document.body.appendChild(m); }
      if (t.cast) {
        var page = location.pathname.split("/").pop() || "index.html", who = t.cast[page] || t.cast["*"];
        var c = document.createElement("img"); c.className = "bb-cast"; c.src = "img/dbz/" + who + ".svg"; c.alt = "";
        var cs = {position:"fixed", left:"6px", bottom:"calc(env(safe-area-inset-bottom,0px) + 4px)", width:"clamp(74px,9vw,128px)", height:"auto",
          "z-index":"9996", "pointer-events":"none", opacity:".92", filter:"drop-shadow(0 0 10px #a98bf088) drop-shadow(0 4px 10px #000a)",
          border:"0", "border-radius":"0", background:"none", margin:"0", padding:"0", "box-shadow":"none", animation:"bbCastIn .7s ease-out both"};
        for (var ck in cs) c.style.setProperty(ck, cs[ck], "important");
        // In desktop mode the sidebar owns the left edge, so the fighter steps over it.
        if (document.documentElement.classList.contains("bbd")) c.style.setProperty("left", "calc(var(--bbd-side) + 10px)", "important");
        c.style.setProperty("animation", "bbCastIn .7s ease-out both, bbKi 2.6s ease-in-out .7s infinite", "important");
        c.style.setProperty("pointer-events", "auto", "important"); c.style.setProperty("cursor", "pointer", "important");
        c.title = "Tap for a power blast";
        document.body.appendChild(c);
        // Power blast: charge an orb at the fighter's hands, then fire a beam across the bottom of the screen.
        var blast = function () {
          if (!c.isConnected || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
          var r = c.getBoundingClientRect(), x = r.right - r.width * 0.12, y = r.top + r.height * 0.42;
          var o = document.createElement("div"); o.className = "bb-orb"; o.style.left = (x - 13) + "px"; o.style.top = (y - 13) + "px";
          var bm = document.createElement("div"); bm.className = "bb-beam"; bm.style.left = x + "px"; bm.style.top = (y - 11) + "px";
          document.body.appendChild(bm); document.body.appendChild(o);
          setTimeout(function () { o.remove(); bm.remove(); }, 1700);
        };
        c.addEventListener("click", blast);
        setTimeout(blast, 3200);
        setInterval(function () { if (!document.hidden) blast(); }, 30000);
      }
      if (t.pet) {
        var pt = document.createElement("img"); pt.className = "bb-pet"; pt.src = t.pet; pt.alt = ""; pt.title = "Tap me";
        var ps = {position:"fixed", left:"6px", bottom:"calc(env(safe-area-inset-bottom,0px) + 4px)", width:"clamp(70px,8vw,116px)", height:"auto",
          "z-index":"9996", cursor:"pointer", filter:"drop-shadow(0 4px 10px #000a)", border:"0", "border-radius":"0", background:"none",
          margin:"0", padding:"0", "box-shadow":"none", animation:"bbPetIn .7s ease-out both"};
        for (var pk in ps) pt.style.setProperty(pk, ps[pk], "important");
        if (document.documentElement.classList.contains("bbd")) pt.style.setProperty("left", "calc(var(--bbd-side) + 10px)", "important");
        var hop = function () { pt.classList.remove("hop"); void pt.offsetWidth; pt.classList.add("hop"); };
        pt.addEventListener("click", hop);
        pt.addEventListener("animationend", function (e) { if (e.animationName == "bbHop") pt.classList.remove("hop"); });
        setInterval(function () { if (!document.hidden) hop(); }, 25000);
        document.body.appendChild(pt);
      }
      var onHome = /(^|\/)(index\.html)?$/.test(location.pathname);
      var gone = false; try { gone = sessionStorage.getItem("bb-monkey-off") == "1"; } catch (e) {}
      if (t.monkey && onHome && !gone) {
        var mk = document.createElement("img"); mk.className = "bb-monkey"; mk.src = t.monkey; mk.alt = ""; mk.title = "Tap me";
        var side = Math.random() < 0.5 ? "left" : "right", spot = (4 + Math.random() * 10).toFixed(1) + "vw";
        var mks = {position:"fixed", top:"0", width:"clamp(140px,15vw,210px)", height:"auto", "z-index":"9996", cursor:"pointer",
          "transform-origin":"40% 0", filter:"drop-shadow(0 6px 14px #000a)", border:"0", "border-radius":"0", background:"none",
          margin:"0", padding:"0", "box-shadow":"none"};
        mks[side] = spot;
        for (var mkk in mks) mk.style.setProperty(mkk, mks[mkk], "important");
        if (side == "left" && document.documentElement.classList.contains("bbd")) mk.style.setProperty("left", "calc(var(--bbd-side) + " + spot + ")", "important");
        mk.addEventListener("click", function () {
          mk.classList.add("off"); try { sessionStorage.setItem("bb-monkey-off", "1"); } catch (e) {}
          setTimeout(function () { mk.remove(); }, 950);
        });
        document.body.appendChild(mk);
      }
      if (t.aurora) { var a = document.createElement("div"); a.className = "bb-aurora"; document.body.prepend(a); }
      // Pages with fixed blue colors get a hue overlay: blues shift to the person's color; whites and text stay put.
      // The Housemen page is fully themed through its variables, so it skips this.
      if (t.tint && !/housemen/.test(location.pathname)) {
        var tn = document.createElement("div"); tn.className = "bb-tint";
        tn.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;mix-blend-mode:hue;background:" + t.tint.color + ";opacity:" + t.tint.opacity;
        document.body.appendChild(tn);
      }
    };
    if (document.body) addBadge(); else document.addEventListener("DOMContentLoaded", addBadge);
  }
  var me = null;
  try {
    var q = new URLSearchParams(location.search).get("me");
    if (q) { q = q.toLowerCase(); if (q === "off") localStorage.removeItem("bb-me"); else if (THEMES[q]) localStorage.setItem("bb-me", q); }
    me = localStorage.getItem("bb-me");
  } catch (e) {}
  apply(me);
  // Housemen sign-in hook: switch to that person's look (or back to default for people without one).
  window.bbTheme = {
    signIn: function (name) {
      var key = name && THEMES[String(name).toLowerCase()] ? String(name).toLowerCase() : null;
      try { if (key) localStorage.setItem("bb-me", key); } catch (e) {}
      if (key) apply(key); else this.off();
    },
    off: function () { try { localStorage.removeItem("bb-me"); } catch (e) {} apply(null); }
  };
})();
// Desktop mode for leads (desktop.js) — loaded here so every page that has the personal looks gets it too.
(function () { var s = document.createElement("script"); s.src = "desktop.js"; s.defer = true; document.head.appendChild(s); })();
