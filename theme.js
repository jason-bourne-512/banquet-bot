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
      css: palette("#a98bf0", "rgba(169,139,240,.14)", "#0c0816", "#171027", "#231839", "rgba(169,139,240,.14)", "rgba(201,162,39,.35)") +
        "body::before{background:radial-gradient(ellipse at 100% 0,#24177399,transparent 50%),radial-gradient(ellipse at 0 100%,#c9a22722,transparent 55%),#0c0816!important}" +
        "h1,h2{color:#e9dcff}" + BADGE +
        ".bb-me-badge{color:#f1d27a;background:linear-gradient(135deg,#241773,#120b33);border:1px solid #c9a22788}"
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
        "@media (prefers-reduced-motion:reduce){.bb-aurora,.bb-aurora::after{animation:none}}"
    }
  };
  function apply(key) {
    var old = document.getElementById("bb-me-theme"); if (old) old.remove();
    var oldB = document.querySelector(".bb-me-badge"); if (oldB) oldB.remove();
    var oldA = document.querySelector(".bb-aurora"); if (oldA) oldA.remove();
    var oldT = document.querySelector(".bb-tint"); if (oldT) oldT.remove();
    var oldM = document.querySelector(".bb-mark"); if (oldM) oldM.remove();
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
