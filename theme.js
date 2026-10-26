// PIN lock: every page stays covered until someone signs in with their Housemen PIN (one sign-in covers the
// whole site and this phone remembers it). PIN fingerprints come from housemen.html; PINs are never stored here.
// This is a door, not a vault: the files themselves are still public on GitHub until the pages are encrypted.
(function () {
  var KEY = "bb-hsm-who", root = document.documentElement;
  function who() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  var css = "html.bb-locked body>*:not(#bb-gate){visibility:hidden!important}" +
    "#bb-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#0b1218;" +
    "font:500 15px/1.4 -apple-system,'Segoe UI',Inter,sans-serif;color:#e6eef4}" +
    "#bb-gate .box{width:min(300px,86vw);text-align:center}" +
    "#bb-gate .mark{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:12px;border:1px solid #2b3a47;" +
    "color:#8bd1ff;font-weight:800;font-size:20px;margin-bottom:14px}" +
    "#bb-gate h1{font-size:15px;letter-spacing:.14em;margin:0 0 4px}#bb-gate p{color:#8fa3b3;font-size:12.5px;margin:0 0 18px}" +
    "#bb-gate .dots{display:flex;gap:12px;justify-content:center;margin-bottom:20px}" +
    "#bb-gate .dots i{width:13px;height:13px;border-radius:50%;border:1.5px solid #8fa3b3}#bb-gate .dots i.f{background:#8bd1ff;border-color:#8bd1ff}" +
    "#bb-gate .dots.err i{border-color:#ff7a7a;animation:bbShake .4s}@keyframes bbShake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}" +
    "#bb-gate .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}" +
    "#bb-gate .pad button{height:58px;border-radius:14px;border:1px solid #22313d;background:#121c25;color:#e6eef4;font:600 21px/1 inherit;cursor:pointer}" +
    "#bb-gate .pad button:active{background:#1d2c38}";
  var st = document.createElement("style"); st.id = "bb-gate-css"; st.textContent = css; document.head.appendChild(st);
  var people = null, buf = "";
  function load() {
    if (people) return Promise.resolve(people);
    return fetch("housemen.html", {cache: "no-cache"}).then(function (r) { return r.text(); }).then(function (t) {
      var out = [], re = /\{name:"([^"]+)",\s*role:"([^"]+)",\s*h:"([0-9a-f]{64})"\}/g, m;
      while ((m = re.exec(t))) out.push({name: m[1], role: m[2], h: m[3]});
      return (people = out);
    });
  }
  function sha(s) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
    return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }); }
  function draw(err) { var d = document.querySelector("#bb-gate .dots"); if (!d) return;
    d.className = "dots" + (err ? " err" : ""); d.innerHTML = [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < buf.length ? "f" : "") + '"></i>'; }).join(""); }
  function build() {
    if (document.getElementById("bb-gate")) return;
    var g = document.createElement("div"); g.id = "bb-gate";
    g.innerHTML = '<div class="box"><div class="mark">B</div><h1>BANQUET BOT</h1><p>Enter your PIN</p><div class="dots"></div><div class="pad">' +
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(function (k) { return k ? '<button type="button" data-k="' + k + '">' + k + "</button>" : "<span></span>"; }).join("") + "</div></div>";
    document.body.appendChild(g); draw();
    g.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return;
      if (b.dataset.k == "⌫") buf = buf.slice(0, -1); else if (buf.length < 4) buf += b.dataset.k;
      draw(); if (buf.length < 4) return;
      var tryPin = buf;
      Promise.all([load(), sha("bb-hsm-v1:" + tryPin)]).then(function (r) {
        var p = r[0].filter(function (x) { return x.h == r[1]; })[0];
        if (!p) { buf = ""; draw(true); setTimeout(draw, 600); return; }
        localStorage.setItem(KEY, JSON.stringify({name: p.name, role: p.role}));
        unlock(); if (window.bbTheme) window.bbTheme.signIn(p.name);
        window.dispatchEvent(new StorageEvent("storage", {key: KEY}));
      });
    });
    document.addEventListener("keydown", function (e) {
      if (!document.getElementById("bb-gate")) return;
      var k = /^[0-9]$/.test(e.key) ? e.key : e.key == "Backspace" ? "⌫" : null;
      if (k) { var b = g.querySelector('[data-k="' + k + '"]'); if (b) b.click(); }
    });
  }
  function lock() { buf = ""; root.classList.add("bb-locked"); if (document.body) build(); else document.addEventListener("DOMContentLoaded", build); }
  function unlock() { root.classList.remove("bb-locked"); var g = document.getElementById("bb-gate"); if (g) g.remove(); }
  // The Housemen link only shows for housemen and leads (Jason 2026-10-24); everyone else never needs the set/clear list.
  var HSMN = ["jamshid", "tomas"];
  function hsmNav() {
    var w = who(), n = w && String(w.name || "").toLowerCase();
    root.classList.toggle("bb-nohsm", !(w && (HSMN.indexOf(n) > -1 || w.role == "captain" || w.role == "director")));
  }
  var navCss = document.createElement("style"); navCss.textContent = 'html.bb-nohsm a[href^="housemen.html"]{display:none!important}';
  document.head.appendChild(navCss); hsmNav();
  window.bbHsmNav = hsmNav;
  window.bbGate = {lock: lock, unlock: unlock};
  if (!who()) lock();
  window.addEventListener("storage", function (e) { if (e.key == KEY || e.key == null) { if (who()) unlock(); else lock(); hsmNav(); } });
})();
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
    // Carlos: Venezuela — a diagonal flag sweep and the flag's arc of 8 stars twinkling across the top of every page.
    carlos: {
      label: "CARLOS · VENEZUELA",
      img: "img/flag-venezuela.svg",
      stars: true,
      tint: {color: "#1d3fa8", opacity: .32},
      css: palette("#ffcc00", "rgba(255,204,0,.14)", "#071330", "#0e1f4d", "#152a66", "rgba(255,204,0,.15)", "rgba(207,20,43,.42)") +
        "body::before{background:linear-gradient(160deg,#ffcc0030 0,#ffcc0020 30%,#00247d40 30%,#00247d40 64%,#cf142b30 64%),#071330!important}" +
        "h1,h2{color:#fff3c4}" + BADGE +
        ".bb-me-badge{color:#ffcc00;border:1px solid #ffcc0099;background:linear-gradient(90deg,#cf142b,#00247d 45%,#00247d 55%,#cf142b)}" +
        ".bb-stars{position:fixed;left:50%;top:78px;width:min(320px,62vw);height:48px;opacity:.85;transform:translateX(-50%);z-index:9997;pointer-events:none}" +
        "html.bbd .bb-stars{left:calc(var(--bbd-side) + (100vw - var(--bbd-side)) / 2);top:66px}" +
        ".bb-stars i{position:absolute;width:14px;height:14px;margin:-7px;background:#fff;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);" +
        "filter:drop-shadow(0 0 4px #fff8);animation:bbStar 2.6s ease-in-out infinite}" +
        "@keyframes bbStar{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}" +
        "@media (prefers-reduced-motion:reduce){.bb-stars i{animation:none;opacity:.8}}"
    },
    // Gema: anime night — sakura petals drifting over a pink/lavender sky, and a chibi fox spirit (original art) that cheers her on.
    gema: {
      label: "GEMA · がんばって",
      img: "img/me/gema-kitsune.svg",
      pet: "img/me/gema-kitsune.svg",
      sakura: true,
      tint: {color: "#a24fc2", opacity: .38},
      petZ: 9999,   // fox + its bubble sit above the tint so they keep their own colors
      cheer: ["がんばって! Ganbatte, Gema!", "Sugoi! ✨", "You got this! 💮", "Yatta! ⭐", "Fighto! 🌸", "Nice work, Gema-chan! 🦊"],
      css: palette("#ff7eb6", "rgba(255,126,182,.15)", "#120c2a", "#1d1542", "#291d58", "rgba(255,126,182,.16)", "rgba(178,140,255,.38)") +
        "body::before{background:radial-gradient(ellipse at 85% 0,#ff7eb655,transparent 50%),radial-gradient(ellipse at 0 100%,#7a4fd655,transparent 55%)," +
        "radial-gradient(1.5px 1.5px at 20% 30%,#fff9,transparent),radial-gradient(1px 1px at 70% 18%,#fff8,transparent),radial-gradient(1.5px 1.5px at 42% 64%,#fff7,transparent)," +
        "radial-gradient(1px 1px at 88% 52%,#fff8,transparent),radial-gradient(1px 1px at 12% 80%,#fff7,transparent),#120c2a!important}" +
        "h1,h2{color:#ffd6ea}" + BADGE +
        ".bb-me-badge{color:#ffd6ea;background:linear-gradient(135deg,#ff5fa2,#7a4fd6);border:1px solid #ffd6ea88}" +
        "@keyframes bbPetIn{from{transform:translateY(110%)}to{transform:none}}" +
        "@keyframes bbHop{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-26px) rotate(-6deg)}35%{transform:translateY(-30px) rotate(5deg)}" +
        "50%{transform:translateY(-12px) rotate(-4deg)}65%{transform:translateY(-18px) rotate(3deg)}85%{transform:translateY(0) rotate(0)}}" +
        ".bb-pet.hop{animation:bbHop 1.1s ease-in-out!important}" +
        // sakura petals
        ".bb-sakura{position:fixed;inset:0;z-index:9990;pointer-events:none;overflow:hidden}" +
        ".bb-sakura i{position:absolute;top:-6vh;width:var(--w);height:calc(var(--w) * .8);background:radial-gradient(ellipse at 30% 30%,#ffe3ef,#ff9ecb 60%,#ff7eb6);" +
        "border-radius:80% 0 80% 0;opacity:.75;animation:bbFall var(--d) linear var(--dl) infinite,bbSway calc(var(--d) / 3) ease-in-out var(--dl) infinite alternate}" +
        "@keyframes bbFall{to{top:106vh;transform:rotate(540deg)}}" +
        "@keyframes bbSway{from{margin-left:-30px}to{margin-left:30px}}" +
        // the fox's cheer
        ".bb-cheer{position:fixed!important;z-index:10000;padding:8px 13px;border-radius:16px;background:#fff;color:#7a2c5a;font:800 13px/1.2 Manrope,Arial,sans-serif;" +
        "box-shadow:0 6px 18px #0008;border:2px solid #ff7eb6;pointer-events:none;white-space:nowrap;animation:bbCheer 2.2s ease-out forwards}" +
        "@keyframes bbCheer{0%{opacity:0;transform:translateY(10px) scale(.8)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}" +
        "@media (prefers-reduced-motion:reduce){.bb-sakura,.bb-pet,.bb-pet.hop{display:none!important;animation:none!important}}"
    },
    // Hector (Director of Event Operations): the panther canvas from his wall — "Te estás distrayendo otra vez, enfócate".
    // Live look: a faint wallpaper behind every page. Sidebar card + "focus" moment exist behind ?lion=card|focus|all.
    hector: {
      label: "HECTOR · ENFÓCATE",
      img: "img/me/hector-lion-sm.jpg",
      lion: true,
      css: BADGE + ".bb-me-badge{color:#f6b13a;border:1px solid #f6b13a88;background:linear-gradient(135deg,#1b1410,#0b0a09)}" +
        ".bb-me-badge img{border-radius:50%!important;width:18px!important;object-fit:cover}" +
        ".bb-lion-wall{position:fixed!important;inset:0;z-index:9990;pointer-events:none;background:url(img/me/hector-lion.jpg) center 38%/cover no-repeat;opacity:.11;filter:saturate(.9)}" +
        "html.bbd .bb-lion-wall{left:var(--bbd-side)!important;top:58px!important}" +
        ".bb-lion-card{margin:10px 12px 0;border-radius:12px;overflow:hidden;border:1px solid #f6b13a55;box-shadow:0 6px 22px #0009;position:relative;cursor:pointer}" +
        ".bb-lion-card img{display:block;width:100%;height:auto;filter:saturate(1.05)}" +
        ".bb-lion-card::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 1px #ffffff10,inset 0 -30px 40px -20px #000c}" +
        ".bbd-mini .bb-lion-card{display:none}" +
        "@keyframes bbLionIn{0%{opacity:0;transform:scale(1.08)}12%,82%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.98)}}" +
        "@keyframes bbLionBg{0%,100%{opacity:0}12%,82%{opacity:1}}" +
        ".bb-lion-focus{position:fixed!important;inset:0;z-index:2147483600;display:grid;place-items:center;background:#000d;cursor:pointer;animation:bbLionBg 6s ease-in-out forwards}" +
        ".bb-lion-focus img{width:min(82vw,1100px);height:auto;border-radius:14px;box-shadow:0 0 0 1px #f6b13a55,0 30px 80px #000;animation:bbLionIn 6s ease-in-out forwards}" +
        "@media (prefers-reduced-motion:reduce){.bb-lion-focus,.bb-lion-focus img{animation:none}}"
    },
    // Baltimore Ravens: purple, black, gold
    dylan: {
      label: "DYLAN · RAVENS FLOCK",
      img: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
      mark: {src: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png", opacity: .07},
      tint: {color: "#5b2bd6", opacity: .55},
      dbz: true,   // random DBZ moments every minute or so: a random GIF clip every other time, the rest change with the time of day (see POOL in dbzLoop)
      // Dragon Ball Z cast (img/dbz/, Jason's picks 2026-10-24): Goku on Home, Super Saiyan Blue Vegeta on Rundown, Super Saiyan Goku everywhere else.
      cast: {"index.html": "goku.jpg", "rundown.html": "vegeta-blue.jpg", "*": "goku-ssj.jpg"},
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
        // ── random DBZ moments (drawn in CSS/SVG for Banquet Bot) ──
        ".bb-dbz{position:fixed;z-index:9999;pointer-events:none}" +
        ".bb-scouter{top:14%;right:4%;padding:10px 16px 12px;border:2px solid #39ff7a;border-radius:6px 22px 6px 6px;background:#04210fcc;" +
        "font:800 15px/1.3 'Courier New',monospace;color:#5dff92;text-shadow:0 0 8px #39ff7a;letter-spacing:1px;animation:bbScout 4.2s ease-out forwards}" +
        ".bb-scouter b{display:block;font-size:30px;color:#eaff5d;text-shadow:0 0 14px #eaff5d}" +
        "@keyframes bbScout{0%{opacity:0;transform:translateX(40px)}8%{opacity:1;transform:none}20%,30%{filter:brightness(1.8)}25%{filter:none}85%{opacity:1}100%{opacity:0}}" +
        ".bb-genki{left:50%;top:-6vmin;width:46vmin;height:46vmin;margin-left:-23vmin;border-radius:50%;" +
        "background:radial-gradient(circle,#ffffff 0 18%,#bff3ff 34%,#4fc8ff 58%,#1a7fff88 70%,transparent 72%);" +
        "box-shadow:0 0 80px 30px #4fc8ff88,0 0 160px 60px #1a7fff44;animation:bbGenki 5.5s ease-in-out forwards}" +
        "@keyframes bbGenki{0%{transform:scale(.05);opacity:0}15%{opacity:1}60%{transform:scale(1);opacity:1}80%{transform:scale(1.04) translateY(4vh)}100%{transform:scale(1.4) translateY(30vh);opacity:0}}" +
        ".bb-nimbus{top:9%;left:0;width:clamp(120px,14vw,190px);animation:bbNimbus 4.8s cubic-bezier(.4,0,.6,1) forwards}" +
        "@keyframes bbNimbus{0%{transform:translateX(-30vw) translateY(10px)}50%{transform:translateX(45vw) translateY(-8px)}100%{transform:translateX(115vw) translateY(6px)}}" +
        ".bb-balls{inset:0;background:radial-gradient(circle at 50% 50%,#0000 30%,#0b1a0caa 80%);animation:bbDim 6s ease-in-out forwards}" +
        ".bb-balls i{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;font-style:normal;display:grid;place-items:center;" +
        "background:radial-gradient(circle at 35% 30%,#fff7c2 0 8%,#ffb43a 30%,#ff7a00 70%,#c44a00);box-shadow:0 0 22px #ffae3acc;" +
        "color:#d0181b;font:900 13px/.9 Arial;letter-spacing:-1px;text-align:center;padding:7px;box-sizing:border-box;word-break:break-all;animation:bbBall 6s ease-in-out forwards}" +
        "@keyframes bbBall{0%{opacity:0;transform:scale(.2)}18%{opacity:1;transform:scale(1)}70%{opacity:1;box-shadow:0 0 40px 10px #ffd04a}100%{opacity:0;transform:scale(.6)}}" +
        "@keyframes bbDim{0%,100%{opacity:0}20%,75%{opacity:1}}" +
        ".bb-ssj{inset:0;background:radial-gradient(circle at var(--x) var(--y),#fff6 0,#ffe14a99 6%,#ffb80033 22%,transparent 45%);animation:bbSsj 2.4s ease-out forwards}" +
        "@keyframes bbSsj{0%{opacity:0}10%{opacity:1}20%{opacity:.4}30%{opacity:1}100%{opacity:0}}" +
        ".bb-cast.ssj{animation:bbSsjGlow 2.4s ease-out!important}" +
        "@keyframes bbSsjGlow{0%,100%{filter:drop-shadow(0 0 8px #ffd54a99) drop-shadow(0 4px 10px #000a)}15%,45%{filter:drop-shadow(0 0 34px #ffe14a) drop-shadow(0 0 10px #fff) brightness(1.35) hue-rotate(-10deg)}}" +
        ".bb-cast.it{animation:bbIT 2.6s steps(1,end)!important}" +
        "@keyframes bbIT{0%{opacity:1}8%{opacity:0}12%{opacity:1}16%{opacity:0}20%,70%{opacity:0;transform:translateX(calc(100vw - 100% - 30px))}" +
        "74%{opacity:1;transform:translateX(calc(100vw - 100% - 30px))}82%{opacity:0}86%,100%{opacity:1;transform:none}}" +
        // destructo disc (morning), senzu bean (midday), Shenron (evening), full moon (night)
        ".bb-disc{top:22%;left:0;width:90px;height:22px;border-radius:50%;background:radial-gradient(ellipse,#fff 0 18%,#fff59a 38%,#ffd21f 62%,#ffd21f00 72%);" +
        "box-shadow:0 0 22px 6px #ffe45a99;animation:bbDisc 2.2s cubic-bezier(.5,0,.5,1) forwards}" +
        "@keyframes bbDisc{0%{transform:translateX(-120px) rotate(-8deg)}100%{transform:translateX(110vw) rotate(6deg)}}" +
        ".bb-senzu{left:0;top:0;width:22px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#d8ff9a,#5fbf2a 60%,#2f7a14);" +
        "box-shadow:0 0 14px #9cff5a;animation:bbSenzu 2.6s ease-in-out forwards}" +
        "@keyframes bbSenzu{0%{transform:translate(8vw,80vh) rotate(0)}50%{transform:translate(50vw,22vh) rotate(540deg)}100%{transform:translate(92vw,82vh) rotate(1080deg);opacity:.2}}" +
        ".bb-shenron{inset:0;background:linear-gradient(180deg,#05140bdd,#0a1f1299 45%,transparent 75%);animation:bbDim 7s ease-in-out forwards}" +
        ".bb-shenron svg{position:absolute;top:4%;left:0;width:150%;animation:bbSnake 7s ease-in-out forwards}" +
        "@keyframes bbSnake{0%{transform:translateX(-100%)}100%{transform:translateX(70%)}}" +
        ".bb-moon{top:6%;right:8%;width:28vmin;height:28vmin;border-radius:50%;" +
        "background:radial-gradient(circle at 38% 36%,#fffef2,#f4f0d0 45%,#d9d2a6 75%,#b9b184);box-shadow:0 0 70px 24px #fff8c855,0 0 160px 60px #fff3a822;" +
        "animation:bbMoon 8s ease-in-out forwards}" +
        "@keyframes bbMoon{0%{transform:translateY(40vh) scale(.6);opacity:0}25%{transform:none;opacity:1}75%{opacity:1;box-shadow:0 0 90px 34px #ffd27a88,0 0 200px 80px #ff8a3a33}100%{opacity:0}}" +
        // anime clips (img/dbz/*.gif, Jason's picks 2026-10-24): a framed card pops up mid-screen for two loops
        ".bb-gifwrap{inset:0;background:radial-gradient(circle,#0000 30%,#0c0816cc 85%);animation:bbDim var(--d) ease-in-out forwards}" +
        ".bb-gifcard{position:absolute;left:50%;top:46%;width:min(80vw,460px);border-radius:14px;overflow:hidden;" +
        "box-shadow:0 0 0 2px #c9a227aa,0 0 46px 12px var(--glow),0 22px 50px #000c;animation:bbGifIn var(--d) ease-in-out forwards}" +
        ".bb-gifcard img{display:block!important;width:100%!important;height:auto!important;margin:0!important;border:0!important;border-radius:0!important}" +
        "@keyframes bbGifIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.85)}12%{opacity:1;transform:translate(-50%,-50%) scale(1)}" +
        "88%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.05)}}" +
        ""   // Dylan gets the full show: his moments ignore the phone's Reduce Motion setting (Jason, 2026-10-24)
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
      pet: "img/me/francisco-cockatiel.svg",   // his cockatiel (original art): bobs and sways
      petFly: "img/me/francisco-cockatiel-fly.svg",   // the same bird in flight, wings flapping (used for the fly lap)
      birdMoments: true,   // every ~20–40s (and on tap) one random moment: fly a lap, dance, whistle, spin, peek or hop (see birdLoop)
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
        // cockatiel moments
        ".bb-pet.dance{animation:bbDance 1.7s ease-in-out!important}" +
        "@keyframes bbDance{0%,100%{transform:none}10%,30%,50%,70%{transform:translateX(-7px) rotate(-9deg)}20%,40%,60%,80%{transform:translateX(7px) rotate(9deg) translateY(-6px)}}" +
        ".bb-pet.spin{animation:bbSpin 1.1s ease-in-out!important}" +
        "@keyframes bbSpin{0%{transform:none}35%{transform:translateY(-26px) rotate(0)}75%{transform:translateY(-26px) rotate(360deg)}100%{transform:rotate(360deg)}}" +
        ".bb-pet.peek{animation:bbPeek 2.4s ease-in-out!important}" +
        "@keyframes bbPeek{0%{transform:none}22%,58%{transform:translateY(108%)}72%{transform:translateY(-12px)}82%{transform:none}91%{transform:translateY(-5px)}100%{transform:none}}" +
        ".bb-pet.whistle{animation:bbWhistle 1.9s ease-in-out!important}" +
        "@keyframes bbWhistle{0%,100%{transform:none}15%,45%,75%{transform:rotate(-6deg) translateY(-3px)}30%,60%,90%{transform:rotate(3deg)}}" +
        ".bb-pet.away{visibility:hidden!important}" +
        ".bb-fly{position:fixed!important;z-index:9996;pointer-events:none;width:clamp(70px,8vw,116px);animation:bbFly 4.6s ease-in-out forwards}" +
        ".bb-fly img{display:block!important;width:100%!important;height:auto!important;border:0!important;margin:0!important;animation:bbFlap .32s ease-in-out infinite alternate}" +
        "@keyframes bbFly{0%{left:var(--x0);top:var(--y0);transform:none}12%{transform:rotate(-18deg)}30%{left:42vw;top:8vh;transform:rotate(-6deg)}" +
        "48%{left:calc(100vw - 140px);top:24vh;transform:rotate(4deg)}52%{left:calc(100vw - 140px);top:24vh;transform:scaleX(-1)}" +
        "75%{left:34vw;top:6vh;transform:scaleX(-1) rotate(8deg)}95%{transform:scaleX(-1)}100%{left:var(--x0);top:var(--y0);transform:none}}" +
        "@keyframes bbFlap{from{transform:translateY(-6px) scaleY(1.04)}to{transform:translateY(6px) scaleY(.94)}}" +
        // whistle notes stay gold above the tint
        ".bb-note{position:fixed!important;z-index:9999;pointer-events:none;color:#f2c14e;font:700 22px/1 Georgia,serif;text-shadow:0 0 8px #000c;animation:bbNote 1.9s ease-out forwards}" +
        "@keyframes bbNote{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-80px) rotate(var(--r)) scale(1.15)}}" +
        "@media (prefers-reduced-motion:reduce){.bb-pet,.bb-pet.hop,.bb-pet.dance,.bb-pet.spin,.bb-pet.peek,.bb-pet.whistle{animation:none!important}.bb-fly,.bb-note{display:none!important}}"
    },
    // Lisa (Events Manager): Puro San Antonio — the Alamo under Fiesta papel picado (img/me, original art).
    // No palette change: her rose accent comes from the Housemen page.
    lisa: {
      label: "LISA · PURO SAN ANTONIO",
      img: "img/me/lisa-san-antonio.svg",
      mark: {src: "img/me/lisa-san-antonio.svg", opacity: .08},
      monkey: "img/me/lisa-monkey.svg",   // a big monkey swinging on a vine, random side each visit
      monkeyPages: /(^|\/)(index\.html|rundown\.html)?$/,   // her most-used pages (usage stats 2026-10-18): Home + Rundown
      walker: "img/me/lisa-monkey-walk.svg",   // every page: a monkey strolls back and forth along the bottom; tap it and it vanishes
      monkeyMoments: true,   // every page: a random monkey moment every ~30–60s (see monkeyLoop)
      css: BADGE + ".bb-me-badge{color:#ffd1e4;background:linear-gradient(135deg,#5a1f3a,#2a0f1d);border:1px solid #ff9ec788}" +
        "@keyframes bbVineIn{from{transform:translateY(-110%)}to{transform:none}}" +
        "@keyframes bbSwing{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}" +
        "@keyframes bbSwingOff{0%{transform:rotate(0)}30%{transform:rotate(-14deg)}100%{transform:translateY(-120%) rotate(10deg)}}" +
        ".bb-monkey{animation:bbVineIn .9s cubic-bezier(.3,1.4,.5,1) both,bbSwing 3.4s ease-in-out .9s infinite}" +
        ".bb-monkey.off{animation:bbSwingOff .9s ease-in forwards!important}" +
        "@media (prefers-reduced-motion:reduce){.bb-monkey{animation:none!important}}" +
        "@keyframes bbStroll{0%{transform:translateX(-170px) scaleX(1)}47%{transform:translateX(calc(100vw + 20px)) scaleX(1)}" +
        "50%{transform:translateX(calc(100vw + 20px)) scaleX(-1)}97%{transform:translateX(-170px) scaleX(-1)}100%{transform:translateX(-170px) scaleX(1)}}" +
        "@keyframes bbJump{0%,100%{translate:0 0}40%{translate:0 -60px}}" +
        ".bb-walker{animation:bbStroll 46s linear infinite}" +
        ".bb-walker.jump img{animation:bbJump .7s ease-out}" +
        "@media (prefers-reduced-motion:reduce){.bb-walker{display:none!important}}" +
        // Monkey moments (new set 2026-10-23): the walker naps, juggles bananas or says hola; a monkey parachutes in, floats up in a bubble,
        // hangs upside down from the top, rockets across or walks a tightrope; a conga line of monkeys runs through.
        ".bb-walker.hold{animation-play-state:paused!important}" +
        "@keyframes bbNap{0%{transform:none}18%,84%{transform:translateY(20%) rotate(-90deg)}100%{transform:none}}" +
        ".bb-walker.nap img{transform-origin:50% 90%;animation:bbNap 4.4s ease-in-out}" +
        "@keyframes bbZ{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(26px,-70px) scale(1.4)}}" +
        ".bb-z{position:fixed!important;z-index:9997;pointer-events:none;font:900 22px/1 system-ui,sans-serif;color:#ffd1e4;text-shadow:0 2px 6px #000a;animation:bbZ 1.7s ease-out forwards}" +
        "@keyframes bbJuggle{0%{transform:translate(0,0) rotate(0)}50%{transform:translate(var(--jx),-95px) rotate(200deg)}100%{transform:translate(calc(var(--jx) * 2),0) rotate(400deg)}}" +
        ".bb-jug{position:fixed!important;z-index:9997;width:26px;pointer-events:none;animation:bbJuggle .8s ease-in-out infinite alternate}" +
        "@keyframes bbHola{0%{opacity:0;transform:translate(-50%,12px) scale(.5)}14%,86%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-10px) scale(.9)}}" +
        ".bb-hola{position:fixed!important;z-index:9997;pointer-events:none;white-space:nowrap;background:#fff;color:#c2185b;font:900 15px/1 system-ui,sans-serif;" +
        "padding:8px 12px;border-radius:14px;border:2px solid #c2185b;box-shadow:0 4px 12px #0007;animation:bbHola 2.8s ease-in-out forwards}" +
        ".bb-mm img{display:block;width:100%;height:auto;border:0;border-radius:0;background:none;margin:0;padding:0;box-shadow:none}" +
        "@keyframes bbSway{0%,100%{rotate:-12deg}50%{rotate:12deg}}" +
        "@keyframes bbChute{0%{transform:translateY(-110%)}100%{transform:translateY(calc(100vh + 20px))}}" +
        ".bb-chute{position:fixed!important;top:0;z-index:9996;width:clamp(90px,9vw,130px);cursor:pointer;animation:bbChute 9s linear forwards}" +
        ".bb-chute>div{transform-origin:50% 0;animation:bbSway 2.4s ease-in-out infinite;filter:drop-shadow(0 6px 12px #0009)}" +
        "@keyframes bbRise{0%{transform:translateY(0)}100%{transform:translateY(calc(-100vh - 200px))}}" +
        "@keyframes bbWob{0%,100%{scale:1 1}50%{scale:1.06 .94}}" +
        ".bb-bubble{position:fixed!important;top:100vh;z-index:9996;width:clamp(110px,10vw,150px);aspect-ratio:1;border-radius:50%;cursor:pointer;" +
        "background:radial-gradient(circle at 30% 28%,#ffffffd0 0 7%,#ffffff1c 9% 62%,#ff9ec74d 100%);border:2px solid #ffffff99;" +
        "box-shadow:inset 0 0 18px #ffd1e488,0 0 14px #ff9ec755;animation:bbRise 8s ease-in forwards,bbWob 1.4s ease-in-out infinite}" +
        ".bb-bubble img{position:absolute;left:12%;top:20%;width:76%!important;animation:bbSway 3s ease-in-out infinite}" +
        "@keyframes bbHang{0%{transform:translateY(-105%)}18%,80%{transform:translateY(0)}100%{transform:translateY(-105%)}}" +
        ".bb-hang{position:fixed!important;top:0;z-index:9996;width:clamp(100px,10vw,145px);cursor:pointer;animation:bbHang 5.5s ease-in-out forwards}" +
        ".bb-hang>div{transform-origin:50% 0;animation:bbSway 1.8s ease-in-out infinite;filter:drop-shadow(0 6px 12px #0009)}" +
        ".bb-hang img{transform:rotate(180deg)}" +
        "@keyframes bbRocket{0%{transform:translate(0,0) rotate(-18deg)}100%{transform:translate(calc(100vw + 320px),-55vh) rotate(-18deg)}}" +
        "@keyframes bbFlame{from{opacity:.7;height:11px}to{opacity:1;height:19px}}" +
        ".bb-rocket{position:fixed!important;left:-200px;z-index:9996;width:clamp(100px,10vw,140px);cursor:pointer;animation:bbRocket 3.2s cubic-bezier(.5,0,.8,.6) forwards}" +
        ".bb-rocket:before{content:'';position:absolute;right:86%;top:50%;width:120%;height:16px;translate:0 -50%;border-radius:10px;" +
        "background:linear-gradient(90deg,transparent,#ffb347,#ff5e3a);animation:bbFlame .12s linear infinite alternate}" +
        ".bb-rope{position:fixed!important;left:0;right:0;height:3px;z-index:9995;background:#8b5a2b;box-shadow:0 1px 3px #0008;pointer-events:none;animation:bbRopeIn 9s ease forwards}" +
        "@keyframes bbRopeIn{0%{opacity:0}6%,92%{opacity:1}100%{opacity:0}}" +
        "@keyframes bbAcross{0%{transform:translateX(-160px)}100%{transform:translateX(calc(100vw + 20px))}}" +
        "@keyframes bbTeeter{0%,100%{rotate:-11deg}50%{rotate:11deg}}" +
        ".bb-tight{position:fixed!important;left:0;z-index:9996;width:clamp(90px,8vw,120px);cursor:pointer;animation:bbAcross 9s linear .4s both}" +
        ".bb-tight img{transform-origin:50% 100%;animation:bbTeeter 1.3s ease-in-out infinite}" +
        "@keyframes bbConga{0%{transform:translateX(calc(100vw + 20px))}100%{transform:translateX(-100%)}}" +
        "@keyframes bbHop{0%,100%{translate:0 0}50%{translate:0 -16px}}" +
        ".bb-conga{position:fixed!important;left:0;bottom:calc(env(safe-area-inset-bottom,0px) + 2px);z-index:9997;display:flex;gap:2px;cursor:pointer;" +
        "animation:bbConga 6.5s linear forwards;filter:drop-shadow(0 4px 8px #0009)}" +
        ".bb-conga img{width:clamp(64px,6vw,90px)!important;transform:scaleX(-1);animation:bbHop .5s ease-in-out infinite}" +
        ".bb-conga img:nth-child(2){animation-delay:-.12s}.bb-conga img:nth-child(3){animation-delay:-.25s}.bb-conga img:nth-child(4){animation-delay:-.37s}" +
        // Tap any monkey (or banana) and it vanishes in a puff.
        "@keyframes bbPoof{0%{transform:scale(1);opacity:1;filter:none}55%{transform:scale(1.35) rotate(8deg);opacity:.7;filter:blur(2px)}" +
        "100%{transform:scale(.15) rotate(-20deg);opacity:0;filter:blur(6px)}}" +
        ".bb-poof{animation:bbPoof .45s ease-in forwards!important;pointer-events:none!important}" +
        ".bb-poof img{animation:none!important}" +
        "@media (prefers-reduced-motion:reduce){.bb-z,.bb-jug,.bb-hola,.bb-chute,.bb-bubble,.bb-hang,.bb-rocket,.bb-rope,.bb-tight,.bb-conga{display:none!important}}"
    },
    // Diana (Senior Events Manager): H-Town · Space City — Houston skyline with a launch (img/me, original art).
    diana: {
      label: "DIANA · H-TOWN · SPACE CITY",
      img: "img/me/diana-houston.svg",
      mark: {src: "img/me/diana-houston.svg", opacity: .08},
      tint: {color: "#9b82d9", opacity: .42},
      bear: /live-map\.html$/,   // Live Map: a Houston bear in a red jersey drops by now and then (see bearLoop)
      // Lavender (Jason 2026-10-18): soft lavender accents on a dusky violet night.
      css: palette("#cbb4ff", "rgba(203,180,255,.15)", "#110d1c", "#1c1630", "#271f42", "rgba(203,180,255,.16)", "rgba(203,180,255,.40)") +
        "body::before{background:radial-gradient(ellipse at 100% 0,#7d63c466,transparent 52%),radial-gradient(ellipse at 0 100%,#cbb4ff1f,transparent 55%),#110d1c!important}" +
        "h1,h2{color:#efe6ff}" + BADGE +
        ".bb-me-badge{color:#efe6ff;background:linear-gradient(135deg,#4a3880,#1f1838);border:1px solid #cbb4ff88}" +
        // Bear moments sit above the hue tint (9998) so the jersey stays red.
        ".bb-bear{position:fixed;z-index:9999;pointer-events:none;width:clamp(92px,10vw,140px)}" +
        ".bb-bear img{display:block;width:100%;height:auto;border:0;border-radius:0;background:none;margin:0;padding:0;box-shadow:none;filter:drop-shadow(0 5px 10px #000a)}" +
        ".bb-ball{position:absolute;width:30%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffb066,#e86a10 60%,#a84400);" +
        "box-shadow:inset 0 0 0 2px #5a2400}" +
        ".bb-ball::before,.bb-ball::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid #5a2400;border-width:0 2px}" +
        ".bb-ball::after{border-width:2px 0 0;inset:48% 0 auto;border-radius:0}" +
        // 1. Dribble: waddles across the bottom, bouncing a ball out front.
        "@keyframes bbBearCross{from{transform:translateX(-30vw)}to{transform:translateX(130vw)}}" +
        "@keyframes bbWaddle{0%,100%{rotate:-4deg}50%{rotate:4deg}}" +
        "@keyframes bbDribble{0%,100%{top:56%}50%{top:88%}}" +
        ".bb-bear.dribble{left:0;bottom:calc(env(safe-area-inset-bottom,0px) + 4px);animation:bbBearCross 13s linear forwards}" +
        ".bb-bear.dribble.back{animation-direction:reverse}.bb-bear.dribble.back .bb-flip{transform:scaleX(-1)}" +
        ".bb-bear.dribble img{animation:bbWaddle .5s ease-in-out infinite}" +
        ".bb-bear.dribble .bb-ball{left:96%;animation:bbDribble .5s ease-in infinite}" +
        // 2. Peek: pops up from a bottom corner, waves, ducks back down.
        "@keyframes bbPeek{0%{transform:translateY(105%)}14%,84%{transform:translateY(38%)}100%{transform:translateY(105%)}}" +
        ".bb-bear.peek{bottom:0;animation:bbPeek 5.2s cubic-bezier(.3,1.3,.5,1) forwards}" +
        // 3. Slam dunk: crouch, leap with a spin, the ball rockets off the top, SLAM!
        "@keyframes bbLeap{0%{transform:translate(-50%,105%)}18%{transform:translate(-50%,8%) scaleY(.88)}" +
        "45%{transform:translate(-50%,-42vh) rotate(360deg)}62%{transform:translate(-50%,-42vh) rotate(360deg)}100%{transform:translate(-50%,105%) rotate(360deg)}}" +
        ".bb-bear.dunk{left:50%;bottom:0;animation:bbLeap 3.4s cubic-bezier(.4,0,.4,1) forwards}" +
        "@keyframes bbShot{0%{opacity:0;transform:none}8%{opacity:1}100%{opacity:0;transform:translate(14vw,-40vh) rotate(720deg) scale(.6)}}" +
        ".bb-ball.shot{position:fixed;width:clamp(30px,3.4vw,46px);z-index:9999;animation:bbShot 1.3s ease-out forwards}" +
        "@keyframes bbSlam{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-8deg)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(-8deg)}" +
        "80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1) rotate(-8deg)}}" +
        ".bb-slam{position:fixed;z-index:9999;pointer-events:none;font:900 clamp(34px,6vw,64px)/1 Impact,'Arial Black',sans-serif;color:#fff;" +
        "-webkit-text-stroke:2px #ce1141;text-shadow:0 0 18px #ce1141,4px 4px 0 #7a0a26;letter-spacing:2px;animation:bbSlam 1.6s ease-out forwards}" +
        "@media (prefers-reduced-motion:reduce){.bb-bear,.bb-slam,.bb-ball.shot{display:none!important}}"
    }
  };
  // Dylan: one random DBZ moment every ~40–80s (the first one shortly after the page opens).
  function dbzLoop() {
    var acts = {
      scouter: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-scouter";
        d.innerHTML = "POWER LEVEL<b>OVER 9000!</b>"; document.body.appendChild(d); return [d, 4300]; },
      genki: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-genki"; document.body.appendChild(d); return [d, 5600]; },
      nimbus: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-nimbus";
        d.innerHTML = '<svg viewBox="0 0 200 80" width="100%"><g fill="#ffd84a" stroke="#e8a400" stroke-width="3">' +
          '<ellipse cx="100" cy="46" rx="80" ry="22"/><circle cx="70" cy="34" r="20"/><circle cx="104" cy="28" r="24"/><circle cx="138" cy="36" r="18"/></g>' +
          '<path d="M20 50 Q-10 46 6 30" stroke="#ffd84a" stroke-width="10" fill="none" stroke-linecap="round"/>' +
          '<path d="M60 40 Q90 30 120 40" stroke="#fff3b0" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
        document.body.appendChild(d); return [d, 4900]; },
      balls: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-balls";
        for (var i = 0; i < 7; i++) { var b = document.createElement("i"), a = -Math.PI / 2 + i * 2 * Math.PI / 7;
          b.textContent = "★".repeat(i + 1); b.style.fontSize = (i < 2 ? 14 : i < 4 ? 10 : 8) + "px";
          b.style.left = "calc(50% + " + (Math.cos(a) * 26).toFixed(1) + "vmin)"; b.style.top = "calc(45% + " + (Math.sin(a) * 26).toFixed(1) + "vmin)";
          b.style.animationDelay = (i * 0.12) + "s"; d.appendChild(b); }
        document.body.appendChild(d); return [d, 6800]; },
      ssj: function () { var c = document.querySelector(".bb-cast"); if (!c) return null; var r = c.getBoundingClientRect();
        var d = document.createElement("div"); d.className = "bb-dbz bb-ssj";
        d.style.setProperty("--x", (r.left + r.width / 2) + "px"); d.style.setProperty("--y", (r.top + r.height / 2) + "px");
        document.body.appendChild(d); c.classList.add("ssj"); setTimeout(function () { c.classList.remove("ssj"); }, 2500); return [d, 2500]; },
      it: function () { var c = document.querySelector(".bb-cast"); if (!c) return null;
        c.classList.add("it"); setTimeout(function () { c.classList.remove("it"); }, 2700); return [null, 2700]; },
      disc: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-disc"; document.body.appendChild(d); return [d, 2300]; },
      senzu: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-senzu"; document.body.appendChild(d); return [d, 2700]; },
      shenron: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-shenron";
        d.innerHTML = '<svg viewBox="0 0 900 160"><path d="M0 90 C80 20 160 150 240 80 S400 10 480 80 S640 150 720 70" stroke="#2fae4f" stroke-width="34" fill="none" stroke-linecap="round"/>' +
          '<path d="M0 90 C80 20 160 150 240 80 S400 10 480 80 S640 150 720 70" stroke="#9ff0a8" stroke-width="6" fill="none" stroke-dasharray="14 18" opacity=".7"/>' +
          '<g transform="translate(720 70)"><ellipse cx="34" cy="0" rx="46" ry="30" fill="#2fae4f"/><path d="M60 -6 L104 -2 L62 12 Z" fill="#2fae4f"/>' +
          '<path d="M20 -26 Q10 -60 -10 -70" stroke="#d9b45a" stroke-width="6" fill="none"/><path d="M40 -26 Q46 -62 66 -72" stroke="#d9b45a" stroke-width="6" fill="none"/>' +
          '<circle cx="46" cy="-8" r="7" fill="#ff2a2a"/><path d="M70 10 Q110 30 130 70" stroke="#e8e0b8" stroke-width="3" fill="none"/></g></svg>';
        document.body.appendChild(d); return [d, 7100]; },
      moon: function () { var d = document.createElement("div"); d.className = "bb-dbz bb-moon"; document.body.appendChild(d); return [d, 8100]; },
      powerup: function () { return gif("powerup", 2900, "#ff3d8b99"); },   // pink pillar of ki over red rocks (1.4s clip)
      ssjblue: function () { return gif("ssjblue", 3500, "#3aa8ffaa"); },   // gold to blue, then the beam (1.7s clip)
      vegeta: function () { return gif("vegeta-ssj", 4300, "#ffd54aaa"); }  // Super Saiyan Vegeta powers up and cracks the ground (4.1s clip, plays once)
    };
    // The clip is fetched once, then each showing gets a fresh blob URL so it plays from frame 1.
    var clips = {};
    function gif(name, ms, glow) {
      function show(blob) {
        var url = URL.createObjectURL(blob), d = document.createElement("div"), c = document.createElement("div"), im = new Image();
        d.className = "bb-dbz bb-gifwrap"; c.className = "bb-gifcard"; d.style.setProperty("--d", ms + "ms"); c.style.setProperty("--glow", glow);
        im.alt = ""; im.onload = function () { document.body.appendChild(d); setTimeout(function () { d.remove(); URL.revokeObjectURL(url); }, ms + 100); };
        im.src = url; c.appendChild(im); d.appendChild(c);
      }
      if (clips[name]) show(clips[name]);
      else fetch("img/dbz/" + name + ".gif").then(function (r) { return r.blob(); }).then(function (b) { clips[name] = b; show(b); }).catch(function () {});
      return [null, ms];
    }
    // what can happen depends on the time of day (hotel time, Central)
    var POOL = {morning: ["disc", "nimbus", "scouter", "senzu", "it", "ssjblue"], midday: ["genki", "ssj", "senzu", "it", "balls", "disc", "ssjblue", "vegeta"],
      evening: ["balls", "shenron", "ssj", "scouter", "nimbus", "powerup", "vegeta"], night: ["moon", "it", "genki", "shenron", "scouter", "powerup"]};
    function period() {
      var h = +new Intl.DateTimeFormat("en-US", {timeZone: "America/Chicago", hour: "numeric", hour12: false}).format(new Date()) % 24;
      return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "midday" : h >= 17 && h < 21 ? "evening" : "night";
    }
    var last = null, turn = 0, GIFS = ["powerup", "ssjblue", "vegeta"];
    // Dylan's clips are the main event on every page, any time of day (Jason, 2026-10-26): preload all three,
    // open with a random one, then alternate random clip / other moment.
    setTimeout(function () { GIFS.forEach(function (n) { var f = n == "vegeta" ? "vegeta-ssj" : n; if (clips[f]) return;
      fetch("img/dbz/" + f + ".gif").then(function (r) { return r.blob(); }).then(function (b) { clips[f] = b; }).catch(function () {}); }); }, 2000);
    function run(name) {
      if (document.hidden) return;
      var r = acts[name](); if (r && r[0]) setTimeout(function () { r[0].remove(); }, r[1]);
    }
    function next(delay) {
      window.bbDbzTimer = setTimeout(function () {
        var rest = POOL[period()].filter(function (n) { return GIFS.indexOf(n) < 0; });
        var names = turn++ % 2 == 0 ? GIFS : rest, pick;
        do { pick = names[Math.floor(Math.random() * names.length)]; } while (pick == last && names.length > 1);
        last = pick; run(pick); next(40000 + Math.random() * 40000);
      }, delay);
    }
    window.bbDbz = run;   // bbDbz("genki") etc. to preview one on demand
    var q = (location.search.match(/[?&]dbz=(\w+)/) || [])[1];   // ?dbz=powerup plays that one right away
    if (q && acts[q]) setTimeout(function () { run(q); }, 1200);
    next(9000 + Math.random() * 6000);
  }
  // Francisco: the cockatiel does one random moment every ~20–40s, and another each time it's tapped.
  function birdLoop(pt) {
    var MOVES = ["fly", "dance", "whistle", "spin", "peek", "hop"], busy = false, last = null;
    function cls(name, ms) { pt.classList.remove("hop"); pt.classList.add(name); setTimeout(function () { pt.classList.remove(name); busy = false; }, ms); }
    var acts = {
      hop: function () { cls("hop", 1150); },
      dance: function () { cls("dance", 1750); },
      spin: function () { cls("spin", 1150); },
      peek: function () { cls("peek", 2450); },
      whistle: function () {
        cls("whistle", 1950);
        var r = pt.getBoundingClientRect(), notes = ["♪", "♫", "♪", "♬"];
        notes.forEach(function (n, i) {
          var d = document.createElement("span"); d.className = "bb-note"; d.textContent = n;
          d.style.left = (r.left + r.width * 0.62) + "px"; d.style.top = (r.top + r.height * 0.18) + "px";
          d.style.setProperty("--dx", (i % 2 ? 28 : 10) + i * 8 + "px"); d.style.setProperty("--r", (i % 2 ? 14 : -10) + "deg");
          d.style.animationDelay = (i * 0.32) + "s"; document.body.appendChild(d);
          setTimeout(function () { d.remove(); }, 2000 + i * 320);
        });
      },
      fly: function () {   // a copy flies a lap around the screen while the perch sits empty
        var r = pt.getBoundingClientRect(), f = document.createElement("div"), im = document.createElement("img");
        f.className = "bb-fly"; f.style.setProperty("--x0", r.left + "px"); f.style.setProperty("--y0", r.top + "px");
        im.src = pt.getAttribute("data-fly") || pt.src; im.alt = ""; f.appendChild(im); document.body.appendChild(f); pt.classList.add("away");
        setTimeout(function () { f.remove(); pt.classList.remove("away"); busy = false; }, 4600);
      }
    };
    function run(name) {
      if (busy || !pt.isConnected || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
      busy = true; acts[name]();
    }
    function pick() { var m; do { m = MOVES[Math.floor(Math.random() * MOVES.length)]; } while (m == last); last = m; return m; }
    pt.addEventListener("click", function () { run(pick()); });
    (function next(ms) { setTimeout(function () { if (!document.hidden) run(pick()); next(20000 + Math.random() * 20000); }, ms); })(6000 + Math.random() * 4000);
    var q = (location.search.match(/[?&]bird=(\w+)/) || [])[1];   // ?bird=fly plays that one right away
    if (q && acts[q]) setTimeout(function () { run(q); }, 1500);
    window.bbBird = run;   // bbBird("whistle") etc. to preview one
  }
  // Hector: the panther canvas. Default is the faint wallpaper (Jason picked it 2026-10-21); ?lion=card|focus|all previews the others.
  function lionLooks() {
    var q = (location.search.match(/[?&]lion=(\w+)/) || [])[1], look;
    try { if (q) localStorage.setItem("bb-lion-look", q); look = localStorage.getItem("bb-lion-look") || "wall"; } catch (e) { look = q || "wall"; }
    var has = function (k) { return look == "all" || look == k; };
    if (has("wall")) { var w = document.createElement("div"); w.className = "bb-lion-wall"; document.body.appendChild(w); }
    var focus = function () {
      if (document.querySelector(".bb-lion-focus")) return;
      var f = document.createElement("div"); f.className = "bb-lion-focus"; f.title = "Tap to close";
      var im = document.createElement("img"); im.src = "img/me/hector-lion.jpg"; im.alt = "Te estás distrayendo otra vez, enfócate"; f.appendChild(im);
      f.addEventListener("click", function () { f.remove(); });
      document.body.appendChild(f); setTimeout(function () { f.remove(); }, 6100);
    };
    window.bbLion = focus;   // preview on demand
    if (has("card")) {
      var tries = 0, put = function () {
        var me = document.querySelector(".bbd-side .bbd-me");
        if (!me) { if (++tries < 40) setTimeout(put, 150); return; }
        var c = document.createElement("div"); c.className = "bb-lion-card"; c.title = "Enfócate";
        var im = document.createElement("img"); im.src = "img/me/hector-lion-sm.jpg"; im.alt = "Te estás distrayendo otra vez, enfócate"; c.appendChild(im);
        c.addEventListener("click", focus);
        me.parentNode.insertBefore(c, me);
      };
      put();
    }
    if (has("focus")) {
      // At most once every 90 minutes per computer, a few minutes after a page opens.
      var last = 0; try { last = +localStorage.getItem("bb-lion-last") || 0; } catch (e) {}
      if (Date.now() - last > 90 * 60000) window.bbLionTimer = setTimeout(function () {
        if (document.hidden) return; try { localStorage.setItem("bb-lion-last", String(Date.now())); } catch (e) {} focus();
      }, 4 * 60000);
    }
  }
  // Lisa: a tapped monkey or banana vanishes in a puff where it stands.
  function bbPoof(el) {
    var r = el.getBoundingClientRect(), st = el.style;
    var put = { left: r.left + "px", top: r.top + "px", right: "auto", bottom: "auto", width: r.width + "px", translate: "none", "transform-origin": "50% 50%" };
    for (var k in put) st.setProperty(k, put[k], "important");
    el.classList.add("bb-poof"); setTimeout(function () { el.remove(); }, 480);
  }
  // Lisa: one random monkey moment every ~30–60s (the first shortly after the page opens), never the same twice in a row.
  function monkeyLoop() {
    var BANANA = '<svg viewBox="0 0 60 60" width="100%"><path d="M8 14 Q12 48 50 50 Q30 40 22 12 Z" fill="#ffd93b" stroke="#c99a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M8 14 L4 8" stroke="#6b4a1a" stroke-width="5" stroke-linecap="round"/><path d="M14 20 Q20 40 40 46" stroke="#fff3a0" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
    var CHUTE = '<svg viewBox="0 0 120 72" width="100%" style="display:block"><path d="M6 40 Q60 -14 114 40 Q100 32 87 40 Q73 32 60 40 Q47 32 33 40 Q20 32 6 40Z" fill="#ff7eb3" stroke="#c2185b" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M33 38 Q60 4 87 38" fill="#ffd1e4" opacity=".75"/><path d="M8 41 L50 72 M60 41 L60 72 M112 41 L70 72" stroke="#fff" stroke-width="1.6"/></svg>';
    var WALK = "img/me/lisa-monkey-walk.svg";
    var walker = function () { var w = document.querySelector(".bb-walker"); return w && !w.classList.contains("bb-poof") ? w : null; };
    var pulse = function (cls, ms) { var w = walker(); if (!w) return null;
      w.classList.remove(cls); void w.offsetWidth; w.classList.add(cls); setTimeout(function () { w.classList.remove(cls); }, ms); return [null, ms]; };
    // left position as a vw number, shifted past the sidebar in desktop mode
    var X = function (vw) { var x = vw.toFixed(1) + "vw"; return document.documentElement.classList.contains("bbd") ? "calc(var(--bbd-side) + " + x + ")" : x; };
    var monkeyImg = function (src) { var im = document.createElement("img"); im.src = src || WALK; im.alt = ""; return im; };
    var add = function (cls, kids) { var d = document.createElement("div"); d.className = "bb-mm " + cls;
      (kids || []).forEach(function (k) { d.appendChild(k); }); d.addEventListener("click", function () { bbPoof(d); });
      document.body.appendChild(d); return d; };
    var temp = function (el, ms) { document.body.appendChild(el); setTimeout(function () { el.remove(); }, ms); return el; };
    var acts = {
      // the walker stops, lies down and snores
      nap: function () { var w = walker(); if (!w) return null; var r = w.getBoundingClientRect();
        pulse("hold", 4400); pulse("nap", 4400);
        for (var i = 0; i < 3; i++) setTimeout(function () { var z = document.createElement("div"); z.className = "bb-z"; z.textContent = "z";
          z.style.left = (r.left + r.width * 0.55) + "px"; z.style.top = (r.top + r.height * 0.15) + "px"; temp(z, 1800); }, 800 + i * 900);
        return [null, 4400]; },
      // the walker stops and juggles three bananas
      juggle: function () { var w = walker(); if (!w) return null; var r = w.getBoundingClientRect(); pulse("hold", 3400);
        for (var i = 0; i < 3; i++) { var b = document.createElement("div"); b.className = "bb-jug"; b.innerHTML = BANANA;
          b.style.left = (r.left + r.width / 2 - 45) + "px"; b.style.top = (r.top + r.height * 0.15) + "px";
          b.style.setProperty("--jx", "32px"); b.style.animationDelay = (-0.27 * i) + "s"; temp(b, 3300); }
        return [null, 3400]; },
      // the walker stops, hops and says something
      hola: function () { var w = walker(); if (!w) return null; var r = w.getBoundingClientRect(); pulse("hold", 2900); pulse("jump", 800);
        var lines = ["¡Hola, Lisa!", "¿Qué onda?", "¡Órale!", "¡Puro San Antonio!", "¡Ándale, ándale!"];
        var t = document.createElement("div"); t.className = "bb-hola"; t.textContent = lines[Math.floor(Math.random() * lines.length)];
        t.style.left = Math.max(70, Math.min(innerWidth - 70, r.left + r.width / 2)) + "px"; t.style.top = (r.top - 34) + "px"; temp(t, 2900);
        return [null, 2900]; },
      // a monkey drifts down under a pink parachute
      parachute: function () { var sw = document.createElement("div"); sw.innerHTML = CHUTE; sw.appendChild(monkeyImg());
        var d = add("bb-chute", [sw]); d.style.left = X(8 + Math.random() * 70); return [d, 9100]; },
      // a monkey floats up the screen inside a bubble (tap to pop)
      bubble: function () { var d = add("bb-bubble", [monkeyImg()]); d.style.left = X(8 + Math.random() * 70); return [d, 8100]; },
      // a monkey hangs upside down from the top and sways
      hang: function () { var sw = document.createElement("div"); sw.appendChild(monkeyImg());
        var d = add("bb-hang", [sw]); d.style.left = X(10 + Math.random() * 68); return [d, 5600]; },
      // a monkey rockets across the screen
      rocket: function () { var d = add("bb-rocket", [monkeyImg()]); d.style.top = (55 + Math.random() * 30).toFixed(1) + "vh"; return [d, 3300]; },
      // a rope stretches across and a monkey teeters along it
      tightrope: function () { var y = 30 + Math.random() * 35;
        var rope = document.createElement("div"); rope.className = "bb-rope"; rope.style.top = y.toFixed(1) + "vh";
        if (document.documentElement.classList.contains("bbd")) rope.style.left = "var(--bbd-side)";
        temp(rope, 9100);
        var d = add("bb-tight", [monkeyImg()]); d.style.bottom = (100 - y).toFixed(1) + "vh";
        d.addEventListener("click", function () { rope.remove(); }); return [d, 9500]; },
      // the big one: a conga line of four monkeys hops across the bottom
      conga: function () { if (document.querySelector(".bb-conga")) return null;
        return [add("bb-conga", [monkeyImg(), monkeyImg(), monkeyImg(), monkeyImg()]), 6600]; }
    };
    var names = Object.keys(acts).concat("conga"), last = null;   // the conga line comes up twice as often
    var run = function (name) { var r = acts[name](); if (r && r[0]) setTimeout(function () { r[0].remove(); }, r[1] + 200); return !!r; };
    window.bbMonkey = run;   // preview a moment on demand: bbMonkey("banana")
    var next = function (ms) {
      window.bbMonkeyTimer = setTimeout(function () {
        if (!document.hidden && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          for (var tries = 0; tries < 6; tries++) {
            var pick = names[Math.floor(Math.random() * names.length)];
            if (pick != last && run(pick)) { last = pick; break; }
          }
        }
        next(30000 + Math.random() * 30000);
      }, ms);
    };
    next(6000 + Math.random() * 5000);
  }
  // Diana's Live Map: one bear moment every ~35–70s (the first a few seconds after the page opens), never the same twice in a row.
  function bearLoop() {
    var add = function (cls, src) {
      var d = document.createElement("div"); d.className = "bb-bear " + cls;
      var f = document.createElement("div"); f.className = "bb-flip"; f.style.position = "relative";
      var im = document.createElement("img"); im.src = src; im.alt = ""; f.appendChild(im); d.appendChild(f);
      document.body.appendChild(d); return d;
    };
    var acts = {
      dribble: function () { var d = add("dribble" + (Math.random() < 0.5 ? " back" : ""), "img/me/diana-bear.svg");
        var b = document.createElement("i"); b.className = "bb-ball"; d.firstChild.appendChild(b); return [d, 13200]; },
      peek: function () { var d = add("peek", "img/me/diana-bear-wave.svg");
        var side = Math.random() < 0.5 ? "left" : "right", spot = (3 + Math.random() * 14).toFixed(1) + "vw";
        if (side == "left" && document.documentElement.classList.contains("bbd")) spot = "calc(var(--bbd-side) + " + spot + ")";
        d.style[side] = spot; return [d, 5400]; },
      dunk: function () { var d = add("dunk", "img/me/diana-bear.svg"), extra = [];
        setTimeout(function () { if (!d.isConnected) return; var r = d.getBoundingClientRect();
          var b = document.createElement("i"); b.className = "bb-ball shot"; b.style.left = (r.left + r.width * 0.7) + "px"; b.style.top = r.top + "px";
          var t = document.createElement("div"); t.className = "bb-slam"; t.textContent = "SLAM!"; t.style.left = "50%"; t.style.top = "30%";
          document.body.appendChild(b); document.body.appendChild(t); extra.push(b, t);
        }, 1450);
        return [d, 3500, extra]; }
    };
    var names = Object.keys(acts), last = null;
    var run = function (name) {
      if (document.querySelector(".bb-bear")) return;
      var r = acts[name](); setTimeout(function () { r[0].remove(); (r[2] || []).forEach(function (x) { x.remove(); }); }, r[1] + 200);
    };
    window.bbBear = run;   // preview a moment on demand: bbBear("dunk")
    var next = function (ms) {
      window.bbBearTimer = setTimeout(function () {
        if (!document.hidden && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          var pick; do { pick = names[Math.floor(Math.random() * names.length)]; } while (pick == last);
          last = pick; run(pick);
        }
        next(35000 + Math.random() * 35000);
      }, ms);
    };
    next(4000 + Math.random() * 4000);
  }
  function apply(key) {
    var old = document.getElementById("bb-me-theme"); if (old) old.remove();
    var oldB = document.querySelector(".bb-me-badge"); if (oldB) oldB.remove();
    var oldA = document.querySelector(".bb-aurora"); if (oldA) oldA.remove();
    var oldT = document.querySelector(".bb-tint"); if (oldT) oldT.remove();
    var oldM = document.querySelector(".bb-mark"); if (oldM) oldM.remove();
    var oldC = document.querySelector(".bb-cast"); if (oldC) oldC.remove();
    var oldP = document.querySelector(".bb-pet"); if (oldP) oldP.remove();
    var oldS = document.querySelectorAll(".bb-sakura,.bb-cheer,.bb-stars"); for (var si = 0; si < oldS.length; si++) oldS[si].remove();
    var oldK = document.querySelector(".bb-monkey"); if (oldK) oldK.remove();
    var oldW = document.querySelector(".bb-walker"); if (oldW) oldW.remove();
    var oldX = document.querySelectorAll(".bb-dbz"); for (var xi = 0; xi < oldX.length; xi++) oldX[xi].remove();
    if (window.bbDbzTimer) { clearTimeout(window.bbDbzTimer); window.bbDbzTimer = null; }
    var oldBr = document.querySelectorAll(".bb-bear,.bb-slam,.bb-ball.shot"); for (var bi = 0; bi < oldBr.length; bi++) oldBr[bi].remove();
    if (window.bbBearTimer) { clearTimeout(window.bbBearTimer); window.bbBearTimer = null; }
    var oldL = document.querySelectorAll(".bb-lion-wall,.bb-lion-card,.bb-lion-focus"); for (var li = 0; li < oldL.length; li++) oldL[li].remove();
    if (window.bbLionTimer) { clearTimeout(window.bbLionTimer); window.bbLionTimer = null; }
    var oldMm = document.querySelectorAll(".bb-mm,.bb-z,.bb-jug,.bb-hola,.bb-rope"); for (var mi = 0; mi < oldMm.length; mi++) oldMm[mi].remove();
    if (window.bbMonkeyTimer) { clearTimeout(window.bbMonkeyTimer); window.bbMonkeyTimer = null; }
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
        var c = document.createElement("img"); c.className = "bb-cast"; c.src = "img/dbz/" + (who.indexOf(".") > -1 ? who : who + ".svg"); c.alt = "";
        var cs = {position:"fixed", left:"6px", bottom:"calc(env(safe-area-inset-bottom,0px) + 4px)", width:"clamp(74px,9vw,128px)", height:"auto",
          "z-index":"9996", "pointer-events":"none", opacity:".92", filter:"drop-shadow(0 0 10px #a98bf088) drop-shadow(0 4px 10px #000a)",
          border:"0", "border-radius":"0", background:"none", margin:"0", padding:"0", "box-shadow":"none", animation:"bbCastIn .7s ease-out both"};
        for (var ck in cs) c.style.setProperty(ck, cs[ck], "important");
        if (/\.(jpe?g|png|webp)$/.test(c.src)) {   // a picture, not a cut-out: frame it as a small portrait card
          // z-index above the colour tint, or the tint turns a gold Super Saiyan pink
          var pc = {"aspect-ratio":"3/4", "object-fit":"cover", "border-radius":"12px", border:"2px solid #c9a227aa", opacity:"1", "z-index":"9999"};
          for (var pk in pc) c.style.setProperty(pk, pc[pk], "important");
        }
        // In desktop mode the sidebar owns the left edge, so the fighter steps over it.
        if (document.documentElement.classList.contains("bbd")) c.style.setProperty("left", "calc(var(--bbd-side) + 10px)", "important");
        c.style.setProperty("animation", "bbCastIn .7s ease-out both, bbKi 2.6s ease-in-out .7s infinite", "important");
        c.style.setProperty("pointer-events", "auto", "important"); c.style.setProperty("cursor", "pointer", "important");
        c.title = "Tap for a power blast";
        document.body.appendChild(c);
        // Power blast: charge an orb at the fighter's hands, then fire a beam across the bottom of the screen.
        var blast = function () {
          if (!c.isConnected) return;
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
          "z-index":String(t.petZ || 9996), cursor:"pointer", filter:"drop-shadow(0 4px 10px #000a)", border:"0", "border-radius":"0", background:"none",
          margin:"0", padding:"0", "box-shadow":"none"};
        for (var pk in ps) pt.style.setProperty(pk, ps[pk], "important");
        pt.style.animation = "bbPetIn .7s ease-out both";   // not !important, so the .hop/.dance/... moments can take over
        if (document.documentElement.classList.contains("bbd")) pt.style.setProperty("left", "calc(var(--bbd-side) + 10px)", "important");
        var hop = function () { pt.classList.remove("hop"); void pt.offsetWidth; pt.classList.add("hop"); };
        if (!t.birdMoments) pt.addEventListener("click", hop);
        if (t.cheer) pt.addEventListener("click", function () {
          var old = document.querySelector(".bb-cheer"); if (old) old.remove();
          var r = pt.getBoundingClientRect(), c = document.createElement("div"); c.className = "bb-cheer";
          c.textContent = t.cheer[Math.floor(Math.random() * t.cheer.length)];
          c.style.left = (r.left + r.width * 0.55) + "px"; c.style.bottom = (innerHeight - r.top + 6) + "px";
          document.body.appendChild(c); setTimeout(function () { c.remove(); }, 2300);
        });
        pt.addEventListener("animationend", function (e) { if (e.animationName == "bbHop") pt.classList.remove("hop"); });
        if (t.petFly) { pt.setAttribute("data-fly", t.petFly); new Image().src = t.petFly; }   // preload so the wings are there on take-off
        if (t.birdMoments) birdLoop(pt); else setInterval(function () { if (!document.hidden) hop(); }, 25000);
        document.body.appendChild(pt);
      }
      var onHome = /(^|\/)(index\.html)?$/.test(location.pathname);
      var gone = false; try { gone = sessionStorage.getItem("bb-monkey-off") == "1"; } catch (e) {}
      if (t.monkey && (t.monkeyPages ? t.monkeyPages.test(location.pathname) : onHome) && !gone) {
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
      if (t.walker) {
        var wk = document.createElement("div"); wk.className = "bb-walker"; wk.title = "Tap me";
        var wks = {position:"fixed", left:"0", bottom:"calc(env(safe-area-inset-bottom,0px) + 2px)", width:"clamp(96px,9vw,132px)", "z-index":"9996",
          cursor:"pointer", "pointer-events":"auto", filter:"drop-shadow(0 4px 8px #0009)"};
        for (var wkk in wks) wk.style.setProperty(wkk, wks[wkk], "important");
        wk.style.setProperty("animation-delay", "-" + Math.floor(Math.random() * 46) + "s");
        var wi = document.createElement("img"); wi.src = t.walker; wi.alt = "";
        wi.style.cssText = "display:block;width:100%;height:auto;border:0;border-radius:0;background:none;margin:0;padding:0;box-shadow:none";
        wk.appendChild(wi);
        wk.addEventListener("click", function () { bbPoof(wk); });   // tap: it vanishes until the next page
        document.body.appendChild(wk);
      }
      if (t.dbz) dbzLoop();
      if (t.bear && t.bear.test(location.pathname)) bearLoop();
      if (t.monkeyMoments) monkeyLoop();
      if (t.lion) lionLooks();
      if (t.stars) {   // 8 stars on an arc, like the flag
        var st8 = document.createElement("div"); st8.className = "bb-stars";
        for (var zi = 0; zi < 8; zi++) {
          var a = Math.PI * (0.15 + 0.7 * zi / 7), z = document.createElement("i");
          z.style.left = (50 - 46 * Math.cos(a)).toFixed(1) + "%"; z.style.top = (88 - 74 * Math.sin(a)).toFixed(1) + "%";
          z.style.animationDelay = (zi * 0.3).toFixed(1) + "s"; st8.appendChild(z);
        }
        document.body.appendChild(st8);
      }
      if (t.sakura) {
        var sk = document.createElement("div"); sk.className = "bb-sakura";
        for (var pi = 0; pi < 16; pi++) {
          var pe = document.createElement("i");
          pe.style.left = (Math.random() * 100).toFixed(1) + "vw";
          pe.style.setProperty("--w", (8 + Math.random() * 9).toFixed(1) + "px");
          pe.style.setProperty("--d", (11 + Math.random() * 10).toFixed(1) + "s");
          pe.style.setProperty("--dl", "-" + (Math.random() * 20).toFixed(1) + "s");
          sk.appendChild(pe);
        }
        document.body.appendChild(sk);
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
    // Nothing saved yet (signed in before their look existed): use the signed-in person's look if they have one.
    if (!me && q !== "off") { var sw = JSON.parse(localStorage.getItem("bb-hsm-who") || "null"), sk = sw && sw.name && String(sw.name).toLowerCase();
      if (sk && THEMES[sk]) { me = sk; localStorage.setItem("bb-me", sk); } }
  } catch (e) {}
  apply(me);
  // Housemen sign-in hook: switch to that person's look (or back to default for people without one).
  window.bbTheme = {
    signIn: function (name) {
      if (window.bbHsmNav) window.bbHsmNav();
      var key = name && THEMES[String(name).toLowerCase()] ? String(name).toLowerCase() : null;
      try { if (key) localStorage.setItem("bb-me", key); } catch (e) {}
      if (key) apply(key); else this.off();
    },
    off: function () { try { localStorage.removeItem("bb-me"); } catch (e) {} apply(null); }
  };
})();
// Usage counter (Jason-only stats on usage.html): one view per person, per page, per 20 minutes on this phone,
// tallied in a monthly doc of the same Firestore collection the Housemen page uses (housemen_test on localhost).
(function () {
  try {
    var w = JSON.parse(localStorage.getItem("bb-hsm-who") || "null"); if (!w || !w.name) return;
    var file = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
    var page = (file == "rundown" && /overview/.test(location.hash)) ? "overview" : (file || "index");
    if (page == "usage") return;
    var last = JSON.parse(localStorage.getItem("bb-view-last") || "{}"), now = Date.now();
    if (last[page] && now - last[page] < 20 * 60 * 1000) return;
    last[page] = now; localStorage.setItem("bb-view-last", JSON.stringify(last));
    var d = new Intl.DateTimeFormat("en-CA", {timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname), col = local ? "housemen_test" : "housemen";
    var who = String(w.name).replace(/[^A-Za-z0-9]/g, "_"), key = "d" + d.slice(8) + "__" + who + "__" + page.replace(/[^a-z0-9]/gi, "_");
    var P = "projects/the-wire-587e6/databases/(default)/documents/";
    fetch("https://firestore.googleapis.com/v1/" + P.replace(/\/$/, "") + ":commit?key=AIzaSyCr9z1e8neChgnRsEeSHX7fM_5h_jhTcxQ", {
      method: "POST", headers: {"Content-Type": "application/json"}, keepalive: true,
      body: JSON.stringify({writes: [{transform: {document: P + col + "/views-" + d.slice(0, 7),
        fieldTransforms: [{fieldPath: key, increment: {integerValue: "1"}}]}}]})
    }).catch(function () {});
  } catch (e) {}
})();
// Desktop mode for leads (desktop.js) — loaded here so every page that has the personal looks gets it too.
(function () { var s = document.createElement("script"); s.src = "desktop.js?v=1025h"; s.defer = true; document.head.appendChild(s); })();
// Site search (events, menus, docs) + ?find= landing highlight — on every page.
(function () { var s = document.createElement("script"); s.src = "search.js?v=1025h"; s.defer = true; document.head.appendChild(s); })();
