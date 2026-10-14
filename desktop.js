// Banquet Bot desktop mode — leads only (captain / director). Loaded on every page by theme.js.
// Off by default; a lead turns it on with the 🖥 button (wide screens only) and this computer remembers it.
// Sign-in uses the same Housemen PIN and the same "bb-hsm-who" slot, so one sign-in covers the whole site.
// PINs are never stored here: the hashes are read from housemen.html (single source of truth).
(function () {
  var DESK = "bb-desk", WHO = "bb-hsm-who", SIDE = 236;
  var PAGES = [
    ["index.html", "Home", "⌂"], ["today.html", "Today", "☀"], ["rundown.html#rundown", "Rundown", "▤"], ["rundown.html#overview", "Overview", "▦"],
    ["housemen.html", "Housemen", "⚒"], ["room-map.html", "Room Map", "⌖"], ["rooms.html", "Rooms", "▢"], ["menu.html", "Menu", "◈"],
    ["info.html", "Info", "ℹ"], ["training.html", "Training", "✎"], ["handbook.html", "Handbook", "❏"]
  ];
  var ACCENT = {captain: "#f2c879", director: "#5fe3c0"};
  // Card types that reflow into a multi-column grid when two or more sit side by side in the same parent.
  var CARDS = ".event-card,.menu-item,.room-card,.tr-card,.hb-card,#bb-app .room,#bb-app .original-event,#bb-app .week-choice,.crow,.menu-list>*,#main>.room";

  // Overview and Today were built with their own palettes (gold on black, mono/serif type). In desktop
  // mode they get the site skin: navy/ice-blue tokens, the lattice background, Barlow Condensed + Manrope.
  var LATTICE = "radial-gradient(ellipse at 100% 0,#2a4f6a59,transparent 46%),radial-gradient(ellipse at 0 100%,#5a4f9a24,transparent 52%)," +
    "repeating-linear-gradient(60deg,transparent 0 33px,#84d3ff0c 33px 34px),repeating-linear-gradient(-60deg,transparent 0 33px,#b7a8ff0a 33px 34px),#101820";
  var SKIN_BASE =
    "html.bbd-skin,html.bbd-skin body{background:#101820!important;background-color:#101820!important;background-image:none!important;color:#eaf3fa}" +
    "html.bbd-skin body::before{content:'';position:fixed!important;inset:0!important;z-index:0;pointer-events:none;transform:none!important;background:" + LATTICE + "!important}" +
    "html.bbd-skin .page-wrap{position:relative;z-index:1;background:transparent!important}" +
    "html.bbd-skin .page-wrap,html.bbd-skin .page-wrap *{font-family:Manrope,Arial,sans-serif!important;letter-spacing:normal}" +
    "html.bbd-skin .page-title,html.bbd-skin .brand-name,html.bbd-skin .client-name,html.bbd-skin .day-dot-num,html.bbd-skin .summary-stat .num,html.bbd-skin .page-wrap h1,html.bbd-skin .page-wrap h2,html.bbd-skin .page-wrap h3{" +
      "font-family:'Barlow Condensed',Arial,sans-serif!important;font-weight:600!important;text-transform:uppercase;letter-spacing:.5px!important}" +
    "html.bbd-skin .page-title{font-size:40px!important;line-height:1!important}" +
    "html.bbd-skin .page-wrap{padding-left:20px!important;padding-right:20px!important}" +
    "html.bbd-skin .page-wrap [class*=eyebrow],html.bbd-skin .page-wrap [class*=lbl],html.bbd-skin .section-heading,html.bbd-skin .food-header,html.bbd-skin .setup-label{font-weight:800!important;letter-spacing:1.6px!important;text-transform:uppercase}";
  var SKINS = {
    "overview.html": SKIN_BASE +
      "html.bbd-skin:root{--bg:#101820;--bg-card:#162530;--bg-active:#1d3344;--border:rgba(139,209,255,.12);--border-h:rgba(139,209,255,.28);" +
        "--text-1:#eaf3fa;--text-2:#b1c6d6;--text-3:#8aa4b8;--text-4:#6f8aa0;--accent:#8bd1ff;--accent-dim:rgba(139,209,255,.10);" +
        "--green:#78d6ca;--green-dim:rgba(120,214,202,.10);--blue:#8bd1ff;--blue-dim:rgba(139,209,255,.10);--header-bg:rgba(16,24,32,.88);" +
        "--tog-bg:#0b151e;--tog-border:rgba(139,209,255,.14);--tog-act:#1d3344;--divider:rgba(166,216,255,.07);--stripe:rgba(130,207,255,.03);" +
        "--today-bg:linear-gradient(135deg,#1d3a52 0%,#162530 60%);--today-border:#8bd1ff;--today-top:#8bd1ff}" +
      "html.bbd-skin .day-btn{background:#162530!important;border-color:rgba(139,209,255,.14)!important;border-left-color:var(--accent)!important}" +
      "html.bbd-skin .day-btn.is-today{background:var(--today-bg)!important;box-shadow:0 0 0 1px #8bd1ff55,0 0 24px #8bd1ff1f}" +
      "html.bbd-skin .day-btn.a-dim{border-left-color:rgba(139,209,255,.2)!important}" +
      "html.bbd-skin .today-chip{color:#0c141b!important}" +
      "html.bbd-skin .day-dot{border-radius:50%!important}" +
      "html.bbd-skin .ov-event{border-radius:12px!important}",
    "room-map.html": SKIN_BASE +
      "html.bbd-skin:root{--bg:#101820;--bg-card:#162530;--bg-row:#1d3344;--border:rgba(139,209,255,.14);--border-h:rgba(139,209,255,.3);" +
        "--text-1:#eaf3fa;--text-2:#b1c6d6;--text-3:#8aa4b8;--green:#78d6ca;--green-dim:rgba(120,214,202,.14)}" +
      "html.bbd-skin body{max-width:none!important;padding-right:24px!important;font-family:Manrope,Arial,sans-serif!important}" +
      "html.bbd-skin body>*:not(.bbd-side):not(.bbd-top){position:relative;z-index:1;max-width:1560px;margin-left:auto;margin-right:auto}" +
      "html.bbd-skin body>*:not(.bbd-side):not(.bbd-top) *{font-family:Manrope,Arial,sans-serif!important}" +
      "html.bbd-skin body>*:not(.bbd-side):not(.bbd-top){padding-left:24px}" +
      "html.bbd-skin .hdr{padding-top:18px}" +
      "html.bbd-skin body>.hdr:not(.bbd-side):not(.bbd-top) h1,html.bbd-skin body>*:not(.bbd-side):not(.bbd-top) .day-hd h2{font-family:'Barlow Condensed',Arial,sans-serif!important;font-weight:600;text-transform:uppercase;letter-spacing:.5px}" +
      "html.bbd-skin .hdr h1{font-size:40px;line-height:1}" +
      "html.bbd-skin .day-hd h2{font-size:22px}" +
      "html.bbd-skin .daynav,html.bbd-skin .day{border-radius:14px}" +
      "html.bbd-skin .daynav a{border-radius:20px;padding:5px 11px;font-weight:700}" +
      "html.bbd-skin .day.is-today{border-color:#8bd1ff;box-shadow:0 0 0 1px #8bd1ff55,0 0 24px #8bd1ff1f}" +
      "html.bbd-skin .day-hd.is-today h2,html.bbd-skin .daynav a.is-today{color:#8bd1ff;border-color:#8bd1ff}" +
      "html.bbd-skin .room-chip{border-radius:20px;font-weight:700}" +
      "html.bbd-skin body>.soon-wrap:not(.bbd-side):not(.bbd-top) .soon-title{font-family:'Barlow Condensed',Arial,sans-serif!important}",
    "today.html": SKIN_BASE +
      "html.bbd-skin:root{--bg:#101820;--surface:#162530;--card:#162530;--border:rgba(139,209,255,.14);--border-light:rgba(139,209,255,.26);" +
        "--gold:#8bd1ff;--gold-dim:rgba(139,209,255,.45);--gold-glow:rgba(139,209,255,.10);--cream:#eaf3fa;--muted:#8aa4b8;--muted2:#6f8aa0;--white:#eaf3fa}" +
      "html.bbd-skin .event-card{border-radius:12px!important;border-left:4px solid #8bd1ff!important}" +
      "html.bbd-skin #events{display:flex!important;gap:18px;align-items:flex-start}" +
      "html.bbd-skin #events>.ev-lane{flex:1 1 0;min-width:0}" +
      "html.bbd-skin #events .ev-col{margin-bottom:12px}" +
      "html.bbd-skin #events .ev-col>.event-card{margin:0 0 12px!important}" +
      "html.bbd-skin #events .rm,html.bbd-skin #events .meta-chip.room{display:inline-flex;align-items:center;gap:4px;font-family:inherit!important;font-size:0.72rem!important;font-weight:800!important;letter-spacing:.06em!important;text-transform:uppercase;color:#bfe6ff!important;background:rgba(139,209,255,.14)!important;border:1px solid rgba(139,209,255,.55)!important;border-radius:6px!important;padding:2px 8px!important;line-height:1.3}" +
      "html.bbd-skin #events .rm::before,html.bbd-skin #events .meta-chip.room::before{content:'';width:6px;height:6px;border-radius:50%;background:#8bd1ff;box-shadow:0 0 6px #8bd1ff}" +
      "html.bbd-skin #events .rms{display:flex;flex-wrap:wrap;gap:4px}" +
      "html.bbd-skin #events .svc-where{display:inline-flex;align-items:center;gap:4px}" +
      // minimalist meal / break / beverage blocks (Jason 2026-10-14)
      "html.bbd-skin #events .meal-group[class*=k-]{background:transparent!important;border-left:2px solid color-mix(in srgb,var(--k) 70%,transparent)!important;border-radius:0!important;padding:0.3rem 0 0.3rem 0.7rem!important;margin-bottom:0.45rem!important}" +
      "html.bbd-skin #events .svc-head{gap:0.35rem 0.5rem!important;margin-bottom:0.25rem!important}" +
      "html.bbd-skin .page-wrap #events .svc-time{font:600 15px/1.2 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.3px!important}" +
      "html.bbd-skin .page-wrap #events .svc-tag{background:transparent!important;color:var(--k)!important;border:1px solid color-mix(in srgb,var(--k) 45%,transparent);font-size:8.5px!important;font-weight:700!important;padding:1px 6px!important}" +
      "html.bbd-skin #events .meal-group .dd>summary{font-size:0.74rem!important;font-weight:600!important;padding:0.18rem 0.55rem!important;border-color:rgba(255,255,255,.1)!important;color:#c9d6e0!important}" +
      "html.bbd-skin #events .meal-group .rm{font-size:0.6rem!important;padding:1px 6px!important}" +
      "html.bbd-skin #events .meal-group.is-now{box-shadow:none!important;border-left-color:var(--k)!important;background:color-mix(in srgb,var(--k) 6%,transparent)!important}" +
      "html.bbd-skin #events .meal-group.is-now .svc-head::after{font-size:8px!important;padding:1px 6px!important}" +
      "html.bbd-skin #events .meal-group.is-past{opacity:.4!important}" +
      // minimalist timeline
      "html.bbd-skin .day-timeline{margin-bottom:1.25rem!important;padding:0.25rem 0 0.4rem!important;background:none!important;border:none!important;box-shadow:none!important}" +
      "html.bbd-skin .tl-dot{width:7px!important;height:7px!important;border:none!important;background:var(--k,#8fa3b3)!important;margin-bottom:0.35rem!important}" +
      "html.bbd-skin .tl-dot .inner{display:none!important}" +
      "html.bbd-skin .tl-item.is-now .tl-dot{box-shadow:0 0 0 3px color-mix(in srgb,var(--k) 25%,transparent)!important}" +
      "html.bbd-skin .tl-item[class*=k-] .tl-label{font:500 11px/1.2 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.3px!important;color:color-mix(in srgb,var(--k) 80%,#fff)!important}" +
      "html.bbd-skin .tl-item[class*=k-] .tl-event{font-size:9.5px!important;color:#8fa3b3!important;max-width:96px!important;margin-top:1px!important}" +
      "html.bbd-skin .tl-spacer{height:1px!important;background:rgba(255,255,255,.08)!important;margin-top:3px!important;min-width:1.25rem!important}" +
      "html.bbd-skin .tl-item.is-past{opacity:.35!important}" +
      // compact "On the schedule" strip
      "html.bbd-skin .crew{gap:2px 0!important;margin:-0.9rem 0 1rem!important}" +
      "html.bbd-skin .crew-chip{border:none!important;background:none!important;border-radius:0!important;padding:0 10px 0 0!important;font-size:11px!important;line-height:1.5;color:#b8c7d3!important}" +
      "html.bbd-skin .crew-chip+.crew-chip::before{content:'·';color:#4d5f6d;margin-right:10px}" +
      "html.bbd-skin .crew-chip b{font-weight:600!important;margin-right:3px!important}" +
      "html.bbd-skin .crew-chip i{font-size:10px!important;color:#6f8291!important;margin-left:3px!important}" +
      // bird's-eye compaction (Jason 2026-10-14): no timeline, quiet beverage lines, tighter cards
      "html.bbd-skin #timeline{display:none!important}" +
      "html.bbd-skin #events .meal-group.quiet{--k:#7d8a96;border-left-color:rgba(255,255,255,.12)!important}" +
      "html.bbd-skin #events .meal-group.quiet .svc-time{color:#9aabb8!important;font-weight:500!important}" +
      "html.bbd-skin #events .meal-group.quiet .svc-tag{color:#8fa3b3!important;border-color:rgba(255,255,255,.15)!important}" +
      "html.bbd-skin #events .meal-group.quiet .dd>summary{color:#9aabb8!important}" +
      "html.bbd-skin #events .info-item:has(.rms){display:none!important}" +
      "html.bbd-skin #events .card-header{padding:0.6rem 0.85rem!important}" +
      "html.bbd-skin #events .card-body{padding:0.55rem 0.85rem 0.6rem!important}" +
      "html.bbd-skin #events .client-name{font-size:15px!important;margin-bottom:0.35rem!important}" +
      "html.bbd-skin #events .info-row{margin-bottom:0.45rem!important;gap:0.4rem!important}" +
      "html.bbd-skin #events .info-item .val{font-size:0.8rem!important}" +
      "html.bbd-skin #events .booking{font-size:0.7rem!important;margin-top:0.3rem!important}" +
      "html.bbd-skin .summary-row{gap:1.25rem!important}" +
      "html.bbd-skin .summary-stat .num{font-size:1.05rem!important}" +
      "html.bbd-skin #events .booking.nofb{display:none!important}" +
      // less redundancy: type chip repeats the title, room-hold lines repeat header time/room, headings label the obvious
      "html.bbd-skin #events .meta-chip.type,html.bbd-skin #events .booking{display:none!important}" +
      "html.bbd-skin .page-wrap>.section-heading,html.bbd-skin #evHead,html.bbd-skin #crew>.section-heading,html.bbd-skin .section-heading{display:none!important}" +
      "html.bbd-skin #events .gtd-all{font-size:11px;color:#8fa3b3;text-align:right;margin-top:2px}" +
      // no highlighting — font color only (Jason 2026-10-14)
      "html.bbd-skin #events .event-card{border-left:1px solid var(--border)!important}" +
      "html.bbd-skin #events .meal-group[class*=k-],html.bbd-skin #events .meal-group.is-now,html.bbd-skin #events .meal-group.quiet{border-left:none!important;background:transparent!important;box-shadow:none!important;padding-left:0!important}" +
      "html.bbd-skin .page-wrap #events .svc-tag{border:none!important;padding:0!important;background:none!important}" +
      "html.bbd-skin #events .rm,html.bbd-skin #events .meta-chip.room{background:none!important;border:none!important;padding:0!important;color:#8bd1ff!important;margin-right:8px}" +
      "html.bbd-skin #events .rm::before,html.bbd-skin #events .meta-chip.room::before{display:none!important}" +
      "html.bbd-skin #events .meal-group.is-now .svc-head::after{background:none!important;color:var(--k)!important;padding:0!important;font-size:9px!important;letter-spacing:.12em}" +
      "html.bbd-skin #events .meal-group .dd>summary{border:none!important;padding:0.1rem 0!important}" +
      "html.bbd-skin #events .client-name{text-shadow:none!important}" +
      "html.bbd-skin #events details.dd-setup:not([open]),html.bbd-skin #events details.dd-diag:not([open]){display:inline-block!important;margin-right:6px}" +
      // setup/notes + diagrams: just a small triangle (label kept as a hover title)
      "html.bbd-skin #events .dd-setup,html.bbd-skin #events .dd-diag{margin-top:0.3rem!important}" +
      "html.bbd-skin #events .dd-setup>summary,html.bbd-skin #events .dd-diag>summary{font-size:0!important;border:none!important;padding:2px 4px!important;gap:0!important}" +
      "html.bbd-skin #events .dd-setup>summary::before,html.bbd-skin #events .dd-diag>summary::before{font-size:12px;color:#8fa3b3}" +
      "html.bbd-skin #events .dd-setup>summary:hover::before,html.bbd-skin #events .dd-diag>summary:hover::before{color:var(--gold)}" +
      "html.bbd-skin .meta-chip,html.bbd-skin .setup-pill{border-radius:6px!important}" +
      "html.bbd-skin .date-chip{color:#0c141b!important;border-radius:8px!important}" +
      "html.bbd-skin .ops-note{background:rgba(255,192,133,.08)!important;border-left-color:#ffc085!important}" +
      "html.bbd-skin .page-wrap .svc-time{font:600 21px/1 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.5px!important;color:var(--k)!important}" +
      "html.bbd-skin .page-wrap .svc-tag{font-size:9.5px!important;letter-spacing:.8px!important}" +
      "html.bbd-skin .page-wrap .client-name{margin-bottom:12px!important}" +
      // group names in the Rundown's green glow
      "html.bbd-skin .page-wrap .client-name{color:#a8f2c7!important;text-shadow:0 0 14px #7fe0a061,0 0 2px #7fe0a080}" +
      "html.bbd-skin .page-wrap .card-meta{margin-bottom:6px!important}" +
      "html.bbd-skin .page-wrap .tl-item .tl-label{font:600 16px 'Barlow Condensed',Arial,sans-serif!important;color:var(--k)!important}" +
      "html.bbd-skin .page-wrap .tl-item .tl-event{font-size:12px!important;font-weight:700!important;max-width:130px!important}" +
      "html.bbd-skin .day-timeline{padding:14px 10px 12px!important;border-radius:12px;background:#16253099;border:1px solid rgba(139,209,255,.12)}"
  };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function who() { try { return JSON.parse(get(WHO)); } catch (e) { return null; } }
  function isLead(w) { return !!(w && (w.role == "captain" || w.role == "director")); }
  function here() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p == "rundown.html" ? p + (location.hash == "#overview" ? "#overview" : "#rundown") : p;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  var wide = function () { return window.innerWidth >= 1000; };

  var CSS = function (acc) { return "" +
    ":root.bbd{--bbd-acc:" + acc + ";--bbd-side:" + SIDE + "px}" +
    ".bbd body{padding-left:var(--bbd-side)!important;padding-top:58px!important}" +
    ".bbd .page-wrap,.bbd .wrap,.bbd .home,.bbd.bb-ref .page-wrap,.bbd body.bb-ref .page-wrap{max-width:1560px!important;margin:0 auto!important}" +
    ".bbd .home{min-height:calc(100vh - 58px)!important}" +
    ".bbd .bottom-nav{left:calc(var(--bbd-side) + (100vw - var(--bbd-side)) / 2)!important;max-width:760px!important;border-radius:14px 14px 0 0}" +
    ".bbd .bbd-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px;align-items:start}" +
    ".bbd .bbd-grid>*{margin-top:0!important;margin-bottom:0!important;min-width:0}" +
    ".bbd .bbd-grid>.bbd-span{grid-column:1/-1;margin-top:10px!important}" +
    ".bbd #bb-app{max-width:1560px!important}" +
    // Rundown: newspaper columns so each client block (header + its rooms) packs side by side.
    ".bbd #rdScreen.bbd-grid{display:block!important;columns:430px;column-gap:16px}" +
    ".bbd #rdScreen>*{break-inside:avoid}" +
    ".bbd #rdScreen>.bbd-span{break-after:avoid;margin-top:0!important;padding-top:10px}" +
    ".bbd #rdScreen>.room{margin-bottom:14px!important;display:block}" +
    // Info page: Amenities / Parking / Transport flow as newspaper columns — each heading stays with its card.
    ".bbd #tab-amenities.active,.bbd #tab-parking.active,.bbd #tab-transport.active{display:block!important;columns:380px 3;column-gap:16px}" +
    ".bbd #tab-amenities>*,.bbd #tab-parking>*,.bbd #tab-transport>*{max-width:none!important;margin-left:0!important;margin-right:0!important;break-inside:avoid}" +
    ".bbd #tab-amenities>.section-label,.bbd #tab-parking>.section-label,.bbd #tab-transport>.section-label{break-after:avoid;margin-top:0!important;padding-top:6px}" +
    ".bbd #tab-amenities>.card,.bbd #tab-parking>.card,.bbd #tab-transport>.card{display:block;margin:0 0 16px!important}" +
    // Info > Dining: restaurant hours + contact rows compact (label and value side by side, flowing in columns); menu untouched.
    ".bbd #tab-dining .card-body>.hours-row,.bbd #tab-dining .card-body>.row{display:inline-flex!important;width:360px;max-width:100%;margin-right:28px;justify-content:flex-start!important;gap:14px;vertical-align:top}" +
    ".bbd #tab-dining .card-body>.hours-row>:first-child,.bbd #tab-dining .card-body>.row>:first-child{flex:0 0 120px}" +
    ".bbd #tab-dining .card-body>.hours-row>:last-child,.bbd #tab-dining .card-body>.row>:last-child{text-align:left!important;margin-left:0!important}" +
    ".bbd #tab-dining .card-body>.alert{max-width:780px!important}" +
    // Info > Corinne menu: each meal period in its own color (--mg-color), serif dish names, italic descriptions.
    ".bbd #tab-dining .menu-group{border-left-width:4px!important;border-radius:12px!important;margin-top:12px!important}" +
    ".bbd #tab-dining .menu-group-head{padding:12px 14px!important;background:linear-gradient(90deg,color-mix(in srgb,var(--mg-color,#8bd1ff) 18%,transparent),transparent 70%)!important}" +
    ".bbd #tab-dining .menu-group-name{font:600 24px/1.1 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.8px!important;text-transform:uppercase;color:var(--mg-color,#8bd1ff)!important}" +
    ".bbd #tab-dining .menu-group-meta{margin-top:4px}" +
    ".bbd #tab-dining .menu-sub-label{justify-self:start;width:fit-content!important;display:inline-block;margin:16px 0 8px!important;padding:3px 10px;border-radius:20px;font:800 10px Manrope,Arial,sans-serif!important;letter-spacing:1.6px!important;color:#0e1a26!important;background:var(--mg-color,#8bd1ff)}" +
    ".bbd #tab-dining .menu-item-name{font:400 17px/1.25 'DM Serif Display',Georgia,serif!important;letter-spacing:.2px!important;color:#f3f8fc!important}" +
    ".bbd #tab-dining .menu-item-desc{font:italic 400 12.5px/1.45 Manrope,Arial,sans-serif!important;color:#a9bfd0!important}" +
    ".bbd #tab-dining .menu-item-price{font:700 14px 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.4px!important;color:var(--mg-color,#8bd1ff)!important}" +
    ".bbd #tab-dining .menu-item{padding:9px 2px!important}" +
    // Overview (desktop): bigger room names, group names in the Rundown's green glow.
    ".bbd #bb-app .original-room{font-size:15px!important;letter-spacing:1.2px!important;color:#d6ecff!important;margin-top:16px!important}" +
    ".bbd #bb-app .original-client{color:#a8f2c7!important;text-shadow:0 0 14px #7fe0a061,0 0 2px #7fe0a080!important;font-size:17px!important}" +
    // No Rundown/Overview tabs on desktop — the sidebar switches views.
    ".bbd #bb-app .tabs{display:none!important}" +
    // Overview + week list: room between days and a date you can read from across the office.
    ".bbd #rdScreen>.week-label{column-span:all;margin:40px 0 16px!important;padding:12px 16px!important;border-radius:12px;" +
      "font:600 28px/1 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:1px!important;color:#eaf3fa!important;" +
      "background:linear-gradient(90deg,#1d3344,#16253000 80%);border-left:4px solid var(--bbd-acc);box-shadow:0 0 0 1px rgba(139,209,255,.12)}" +
    ".bbd #rdScreen>.week-label:first-child{margin-top:6px!important}" +
    ".bbd #rdScreen>.week-label:before,.bbd #rdScreen>.week-label:after{display:none!important}" +
    ".bbd #rdScreen>.week-label{display:block!important;text-align:left!important}" +
    ".bbd #rdScreen>.original-event,.bbd #rdScreen>.week-choice{margin:0 0 16px!important;display:block}" +
    ".bbd #bb-app .week-choice strong{font:600 22px 'Barlow Condensed',Arial,sans-serif!important;letter-spacing:.6px;color:#eaf3fa!important}" +
    // sidebar
    "html.bbd body>.bbd-side{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:var(--bbd-side)!important;z-index:2147483000!important;margin:0!important;display:flex;flex-direction:column;" +
      "background:#101820;border-right:1px solid rgba(139,209,255,.14);box-shadow:6px 0 30px #0007;font-family:Manrope,Arial,sans-serif}" +
    ".bbd-side::before{content:'';position:absolute;inset:0;pointer-events:none;background:" +
      "radial-gradient(ellipse at 0 0,#2a4f6a59,transparent 55%),radial-gradient(ellipse at 100% 100%,#5a4f9a24,transparent 55%)," +
      "repeating-linear-gradient(60deg,transparent 0 33px,#84d3ff0c 33px 34px),repeating-linear-gradient(-60deg,transparent 0 33px,#b7a8ff0a 33px 34px)}" +
    ".bbd-brand{position:relative;display:flex;align-items:center;gap:10px;padding:16px 16px 14px;border-bottom:1px solid rgba(139,209,255,.12);text-decoration:none;color:#eaf1f7}" +
    ".bbd-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;border:1px solid #81ccff80;color:#81ccff;font:20px Georgia,serif;box-shadow:0 0 14px #81ccff18}" +
    ".bbd-brand b{display:block;font:800 11px Manrope,Arial;letter-spacing:2px;white-space:nowrap}" +
    ".bbd-brand .sub{display:block;font:700 9px Manrope,Arial;letter-spacing:2.4px;color:#8bd1ff;margin-top:3px;white-space:nowrap}" +
    ".bbd-nav{position:relative;flex:1;overflow:auto;padding:10px 10px}" +
    ".bbd-nav .lbl{font:700 9.5px Manrope,Arial;letter-spacing:1.6px;color:#89b4cf;text-transform:uppercase;padding:12px 8px 6px}" +
    ".bbd-nav a{display:flex;align-items:center;gap:11px;padding:9px 10px;margin:2px 0;border-radius:11px;color:#b1c6d6;text-decoration:none;font:700 13px Manrope,Arial;border:1px solid transparent}" +
    ".bbd-nav a i{font-style:normal;width:20px;text-align:center;opacity:.8}" +
    ".bbd-nav a:hover{background:#162530;border-color:rgba(139,209,255,.12);color:#eaf3fa}" +
    ".bbd-nav a.on{color:#eaf3fa;background:#1d3344;border-color:rgba(139,209,255,.26);box-shadow:inset 3px 0 0 var(--bbd-acc),0 0 18px #8bd1ff14}" +
    ".bbd-nav a.on i{color:var(--bbd-acc);opacity:1}" +
    ".bbd-me{position:relative;padding:12px;border-top:1px solid rgba(139,209,255,.12);display:grid;gap:8px}" +
    ".bbd-user{display:flex;align-items:center;gap:10px;color:#eaf3fa;font:700 13px Manrope,Arial}" +
    ".bbd-user em{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb,var(--bbd-acc) 18%,transparent);color:var(--bbd-acc);font:800 14px Manrope,Arial;font-style:normal;border:1px solid var(--bbd-acc)}" +
    ".bbd-user small{display:block;font:800 9px/1.35 Manrope,Arial;letter-spacing:1.4px;color:var(--bbd-acc);text-transform:uppercase}" +
    ".bbd-me .row{display:grid;grid-template-columns:1fr 1fr;gap:6px}" +
    ".bbd-btn{border:1px solid #ffffff1c;background:#ffffff08;color:#d6e3ee;border-radius:8px;padding:7px 8px;font:700 11px Manrope,Arial;cursor:pointer}" +
    ".bbd-btn:hover{border-color:var(--bbd-acc);color:var(--bbd-acc)}" +
    // top bar
    "html.bbd body>.bbd-top{position:fixed!important;left:var(--bbd-side)!important;right:0!important;top:0!important;height:58px;z-index:2147482999!important;margin:0!important;width:auto!important;display:flex;align-items:center;gap:16px;padding:0 20px;" +
      "background:rgba(9,15,21,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-bottom:1px solid #ffffff10;box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--bbd-acc) 25%,transparent);font-family:Manrope,Arial,sans-serif}" +
    ".bbd-title{font:600 24px 'Barlow Condensed',Arial;letter-spacing:.8px;text-transform:uppercase;color:#eaf3fa;white-space:nowrap}" +
    ".bbd-title small{font:800 9px Manrope,Arial;letter-spacing:2px;color:var(--bbd-acc);margin-left:10px;vertical-align:middle}" +
    ".bbd-jump{position:relative;flex:1;max-width:460px;margin-left:auto}" +
    ".bbd-jump input{width:100%;box-sizing:border-box;border:1px solid #ffffff1c;background:#0b151e;color:#eaf3fa;border-radius:10px;padding:9px 12px 9px 34px;font:600 13px Manrope,Arial;outline:none}" +
    ".bbd-jump input:focus{border-color:var(--bbd-acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--bbd-acc) 18%,transparent)}" +
    ".bbd-jump::before{content:'⌕';position:absolute;left:12px;top:50%;transform:translateY(-52%);color:#6f8aa0;font-size:15px}" +
    ".bbd-jump kbd{position:absolute;right:9px;top:50%;transform:translateY(-50%);font:700 10px Manrope,Arial;color:#6f8aa0;border:1px solid #ffffff1c;border-radius:5px;padding:1px 6px}" +
    ".bbd-res{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#0e1923;border:1px solid #ffffff1c;border-radius:10px;padding:5px;display:none;box-shadow:0 14px 40px #000a}" +
    ".bbd-res.on{display:block}" +
    ".bbd-res a{display:flex;gap:10px;padding:8px 10px;border-radius:7px;color:#d6e3ee;text-decoration:none;font:700 13px Manrope,Arial}" +
    ".bbd-res a.sel,.bbd-res a:hover{background:color-mix(in srgb,var(--bbd-acc) 16%,transparent);color:#fff}" +
    ".bbd-res a span{margin-left:auto;color:#6f8aa0;font-size:11px}" +
    ".bbd-tiles{display:flex;gap:8px}" +
    ".bbd-tile{border:1px solid #ffffff14;background:#ffffff06;border-radius:10px;padding:5px 11px;text-align:right;line-height:1.1}" +
    ".bbd-tile b{display:block;font:600 19px 'Barlow Condensed',Arial;color:#eaf3fa;letter-spacing:.6px;font-variant-numeric:tabular-nums}" +
    ".bbd-tile span{font:800 8.5px Manrope,Arial;letter-spacing:1.6px;color:#6f8aa0;text-transform:uppercase}" +
    ".bbd-tile.live b{color:var(--bbd-acc)}" +
    ".bbd-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#7fe0a0;box-shadow:0 0 8px #7fe0a0;margin-right:6px;vertical-align:middle;animation:bbdp 2s infinite}" +
    "@keyframes bbdp{50%{opacity:.35}}" +
    // entry button + PIN pad (also used before desktop mode is on)
    ".bbd-enter{position:fixed;right:16px;bottom:16px;z-index:2147483000;border:1px solid #8bd1ff55;background:#0e1923e6;color:#cfe6f5;border-radius:24px;padding:8px 14px;font:800 11px Manrope,Arial,sans-serif;letter-spacing:.6px;cursor:pointer;box-shadow:0 6px 22px #0008}" +
    ".bbd-enter:hover{border-color:#8bd1ff;color:#fff}" +
    ".bbd-pin{position:fixed;inset:0;z-index:2147483001;background:#000b;display:grid;place-items:center;font-family:Manrope,Arial,sans-serif}" +
    ".bbd-pin>div{width:300px;background:#121e28;border:1px solid #8bd1ff33;border-radius:16px;padding:18px;color:#eaf3fa;box-shadow:0 20px 60px #000c}" +
    ".bbd-pin h3{margin:0 0 4px;font:600 22px 'Barlow Condensed',Arial;text-transform:uppercase;letter-spacing:.6px}" +
    ".bbd-pin p{margin:0 0 12px;font-size:12px;color:#8aa4b8}" +
    ".bbd-pin .dots{display:flex;justify-content:center;gap:12px;margin:4px 0 14px}" +
    ".bbd-pin .dots i{width:13px;height:13px;border-radius:50%;border:1.6px solid #8bd1ff55}" +
    ".bbd-pin .dots i.f{background:#8bd1ff;border-color:#8bd1ff}" +
    ".bbd-pin .dots.err i{border-color:#ff8f8f}.bbd-pin .dots.err i.f{background:#ff8f8f}" +
    ".bbd-pin .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}" +
    ".bbd-pin .pad button{border:1px solid #ffffff14;background:#182a37;color:#eaf3fa;border-radius:10px;padding:11px 0;font:600 22px 'Barlow Condensed',Arial;cursor:pointer}" +
    ".bbd-pin .pad button:hover{background:#21394a}" +
    ".bbd-pin .cx{width:100%;margin-top:10px}";
  };

  function addStyle(acc) {
    if (!document.querySelector('link[href*="Barlow+Condensed"]')) {
      var l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Manrope:wght@400;600;700;800&display=swap";
      document.head.appendChild(l);
    }
    if (!document.getElementById("bbd-serif")) {
      var sf = document.createElement("link"); sf.id = "bbd-serif"; sf.rel = "stylesheet";
      sf.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap"; document.head.appendChild(sf);
    }
    var s = document.getElementById("bbd-style") || document.createElement("style");
    s.id = "bbd-style"; s.textContent = CSS(acc); document.head.appendChild(s);
  }

  // ── PIN sign-in (leads only). Hashes come from housemen.html so there is one list to maintain.
  var people = null;
  function loadPeople() {
    if (people) return Promise.resolve(people);
    return fetch("housemen.html", {cache: "no-store"}).then(function (r) { return r.text(); }).then(function (t) {
      var out = [], re = /\{name:"([^"]+)",\s*role:"([^"]+)",\s*h:"([0-9a-f]{64})"\}/g, m;
      while ((m = re.exec(t))) out.push({name: m[1], role: m[2], h: m[3]});
      return (people = out);
    });
  }
  function sha(s) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function askPin(done) {
    addStyle("#8bd1ff");
    var buf = "", el = document.createElement("div");
    el.className = "bbd-pin";
    el.innerHTML = '<div><h3>Desktop mode</h3><p>Captain or Director PIN</p><div class="dots"><i></i><i></i><i></i><i></i></div><div class="pad">' +
      ["1","2","3","4","5","6","7","8","9","","0","⌫"].map(function (k) { return k ? '<button data-k="' + k + '">' + k + "</button>" : "<span></span>"; }).join("") +
      '</div><button class="bbd-btn cx">Cancel</button></div>';
    document.body.appendChild(el);
    var dots = el.querySelector(".dots");
    function draw(err) { dots.className = "dots" + (err ? " err" : ""); dots.innerHTML = [0,1,2,3].map(function (i) { return '<i class="' + (i < buf.length ? "f" : "") + '"></i>'; }).join(""); }
    function close() { el.remove(); document.removeEventListener("keydown", key); }
    function press(k) {
      if (k == "⌫") buf = buf.slice(0, -1); else if (buf.length < 4) buf += k;
      draw();
      if (buf.length < 4) return;
      var tryPin = buf;
      Promise.all([loadPeople(), sha("bb-hsm-v1:" + tryPin)]).then(function (r) {
        var p = r[0].filter(function (x) { return x.h == r[1]; })[0];
        if (!p || !isLead(p)) { buf = ""; draw(true); setTimeout(draw, 600); return; }
        set(WHO, JSON.stringify({name: p.name, role: p.role}));
        close(); done(p);
      }, function () { buf = ""; draw(true); });
    }
    function key(e) { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key == "Backspace") press("⌫"); else if (e.key == "Escape") close(); }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (b) { press(b.dataset.k); return; }
      if (e.target.closest(".cx") || e.target == el) close();
    });
    document.addEventListener("keydown", key);
  }

  // ── shell
  // Phone pages cap their sections at ~460–720px; lift any such cap on in-flow page sections (not modals/sheets).
  function unclamp() {
    document.querySelectorAll(".page-wrap *,.wrap *,#bb-app *,.home *").forEach(function (e) {
      if (e.dataset.bbdW || e.offsetWidth < 280 || e.closest(".bbd-grid>*,.sheet,.sheet-bg,.viewer,.bbd-side,.bbd-top")) return;
      var cs = getComputedStyle(e), m = parseFloat(cs.maxWidth);
      if (!(m >= 300 && m <= 900) || cs.position == "fixed" || cs.position == "absolute") return;
      e.dataset.bbdW = "1"; e.style.setProperty("max-width", "1560px", "important");
    });
  }
  function gridify() {
    unclamp();
    var seen = new Set();
    document.querySelectorAll(CARDS).forEach(function (c) {
      var p = c.parentElement; if (!p || seen.has(p) || p.classList.contains("ev-col")) return; seen.add(p);
      var n = 0; for (var i = 0; i < p.children.length; i++) if (p.children[i].matches(CARDS)) n++;
      if (n < 2) return;
      p.classList.add("bbd-grid");
      // Anything in the list that isn't a card (client headers, day labels) spans the full row.
      for (var j = 0; j < p.children.length; j++) p.children[j].classList.toggle("bbd-span", !p.children[j].matches(CARDS));
    });
  }
  function build(w) {
    var root = document.documentElement, acc = ACCENT[w.role] || "#8bd1ff", cur = here();
    root.classList.add("bbd"); root.dataset.bbdRole = w.role;
    if (SKINS[cur]) { root.classList.add("bbd-skin"); var sk = document.createElement("style"); sk.id = "bbd-skin"; sk.textContent = SKINS[cur]; document.head.appendChild(sk); }
    addStyle(acc);
    var title = (PAGES.filter(function (p) { return p[0] == cur; })[0] || [cur, document.title.split("—")[0].trim()])[1];
    var side = document.createElement("aside");
    side.className = "bbd-side";
    side.innerHTML = '<a class="bbd-brand" href="index.html"><span class="bbd-mark">B</span><span><b>BANQUET BOT</b><span class="sub">COMMAND CENTER</span></span></a>' +
      '<nav class="bbd-nav"><div class="lbl">Operations</div>' +
      PAGES.map(function (p, i) {
        return (i == 6 ? '<div class="lbl">Reference</div>' : "") +
          '<a href="' + p[0] + '" class="' + (p[0] == cur ? "on" : "") + '"><i>' + p[2] + "</i>" + p[1] + "</a>";
      }).join("") + "</nav>" +
      '<div class="bbd-me"><div class="bbd-user"><em>' + esc(w.name.slice(0, 1)) + "</em><div>" + esc(w.name) + "<small>" + (w.role == "director" ? "Director of Event Operations" : "Captain") + "</small></div></div>" +
      '<div class="row"><button class="bbd-btn" data-bbd="phone">📱 Phone view</button><button class="bbd-btn" data-bbd="out">Sign out</button></div></div>';
    var top = document.createElement("header");
    top.className = "bbd-top";
    top.innerHTML = '<div class="bbd-title">' + esc(title) + "<small>DESKTOP</small></div>" +
      '<div class="bbd-jump"><input id="bbd-q" placeholder="Jump to a page…" autocomplete="off"><kbd>⌘K</kbd><div class="bbd-res" id="bbd-res"></div></div>' +
      '<div class="bbd-tiles"><div class="bbd-tile"><b id="bbd-date"></b><span>Hotel date</span></div><div class="bbd-tile live"><b id="bbd-clock"></b><span><i class="bbd-dot"></i>Austin · CT</span></div></div>';
    document.body.appendChild(side); document.body.appendChild(top);
    window.addEventListener("hashchange", function () {
      var now = here(), pg = PAGES.filter(function (p) { return p[0] == now; })[0];
      side.querySelectorAll(".bbd-nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") == now); });
      if (pg) top.querySelector(".bbd-title").firstChild.textContent = pg[1];
    });

    // live clock (hotel time)
    function tick() {
      var d = new Date();
      document.getElementById("bbd-clock").textContent = d.toLocaleTimeString("en-US", {timeZone: "America/Chicago", hour: "numeric", minute: "2-digit"});
      document.getElementById("bbd-date").textContent = d.toLocaleDateString("en-US", {timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric"});
    }
    tick(); setInterval(tick, 1000);

    // quick jump: ⌘K / Ctrl+K or "/" to focus, arrows + Enter to go; number keys 1–9 jump when not typing
    var q = document.getElementById("bbd-q"), res = document.getElementById("bbd-res"), sel = 0, hits = [];
    function draw() {
      var s = q.value.trim().toLowerCase();
      hits = PAGES.filter(function (p) { return !s || p[1].toLowerCase().indexOf(s) >= 0 || p[0].indexOf(s) >= 0; });
      sel = Math.min(sel, Math.max(hits.length - 1, 0));
      res.innerHTML = hits.map(function (p, i) { return '<a href="' + p[0] + '" class="' + (i == sel ? "sel" : "") + '"><i>' + p[2] + "</i>" + p[1] + "<span>" + p[0] + "</span></a>"; }).join("") || '<a>No match</a>';
      res.classList.toggle("on", document.activeElement == q);
    }
    q.addEventListener("focus", draw); q.addEventListener("input", function () { sel = 0; draw(); });
    q.addEventListener("blur", function () { setTimeout(function () { res.classList.remove("on"); }, 150); });
    q.addEventListener("keydown", function (e) {
      if (e.key == "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); draw(); e.preventDefault(); }
      else if (e.key == "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key == "Enter" && hits[sel]) location.href = hits[sel][0];
      else if (e.key == "Escape") q.blur();
    });
    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") || (document.activeElement || {}).isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() == "k") { e.preventDefault(); q.focus(); q.select(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key == "/") { e.preventDefault(); q.focus(); return; }
    });
    side.addEventListener("click", function (e) {
      var b = e.target.closest("[data-bbd]"); if (!b) return;
      if (b.dataset.bbd == "phone") set(DESK, "0");
      if (b.dataset.bbd == "out") { set(DESK, "0"); set(WHO, null); window.bbTheme && window.bbTheme.off && window.bbTheme.off(); }
      location.reload();
    });

    // reflow card lists now and whenever a page re-renders (Rundown, Housemen and Today draw after load)
    gridify();
    var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(gridify, 120); }).observe(document.body, {childList: true, subtree: true});
  }

  function entry() {
    if (!wide() || document.querySelector(".bbd-enter")) return;
    addStyle("#8bd1ff");
    var b = document.createElement("button");
    b.className = "bbd-enter"; b.textContent = "🖥 Desktop";
    b.title = "Desktop mode (captain / director)";
    b.onclick = function () {
      var w = who();
      if (isLead(w)) { set(DESK, "1"); location.reload(); return; }
      askPin(function () { set(DESK, "1"); location.reload(); });
    };
    document.body.appendChild(b);
  }

  function start() {
    var w = who();
    if (get(DESK) == "1" && isLead(w) && wide()) build(w);
    else entry();
  }
  if (document.readyState == "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
