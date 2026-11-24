// Hide personal contact information from BEO event data on the live site:
// client/on-site contact names, plus phone numbers and emails if they appear.
// Westin staff first names stay visible. Works in the browser and in Node tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBContactPrivacy = factory();
})(typeof window !== "undefined" ? window : this, function () {
  // Banquet and hotel staff first names that should stay visible (schedule, assignments, event managers).
  var STAFF = "jason hector diana lisa jessica samantha malaika dylan francisco tomas carlos gema odaly hilnery maricruz leodan leonardo raibely jamshid brandon margri".split(" ");
  var STAFF_SET = {};
  STAFF.forEach(function (n) { STAFF_SET[n] = 1; });

  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;

  function foldName(s) { return String(s || "").replace(/^IC:\s*/i, "").replace(/^MGR:\s*/i, "").replace(/^CONTACT:\s*/i, "").replace(/\s+/g, " ").trim(); }
  function firstName(s) {
    var t = foldName(s).split(/[\s,;/(]+/)[0] || "";
    return t.replace(/[^A-Za-z'-]/g, "");
  }
  function isStaff(s) {
    var f = firstName(s).toLowerCase();
    return !!(f && STAFF_SET[f]);
  }
  function hasPersonalData(s) {
    var t = String(s || "");
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    return EMAIL_RE.test(t) || PHONE_RE.test(t);
  }
  function shouldHide(s) {
    var t = foldName(s);
    if (!t) return false;
    if (hasPersonalData(t)) return true;
    return !isStaff(t);
  }
  function stripPersonal(s) {
    return String(s || "").replace(EMAIL_RE, " ").replace(PHONE_RE, " ").replace(/\s+/g, " ").trim();
  }
  function nameRe(contactName) {
    var first = firstName(contactName);
    if (!first || first.length < 2 || isStaff(first)) return null;
    return new RegExp("\\b" + first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
  }
  function redactNameInText(text, contactName) {
    var re = nameRe(contactName);
    var out = String(text || "");
    if (re) out = out.replace(re, "the contact");
    return stripPersonal(out);
  }
  function stripPersonalLoose(s) {
    return String(s || "").replace(EMAIL_RE, " ").replace(PHONE_RE, " ");
  }
  function extraContactNames(text) {
    var out = [], m = String(text || "").match(/\bcontacts?:\s*([A-Za-z][A-Za-z'-]+(?:\s*,\s*[A-Za-z][A-Za-z'-]+)*(?:\s*,?\s*and\s+[A-Za-z][A-Za-z'-]+)?)/i);
    if (!m) return out;
    m[1].split(/\s*,\s*|\s+and\s+/i).forEach(function (n) {
      n = firstName(n);
      if (n && !isStaff(n) && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }
  function hideNames(primary, text) {
    var out = [];
    function add(n) {
      n = firstName(n);
      if (!n || isStaff(n) || out.indexOf(n) > -1) return;
      out.push(n);
    }
    add(primary);
    extraContactNames(text).forEach(add);
    return out;
  }
  function applyNames(text, names) {
    var out = String(text || "");
    (names || []).forEach(function (n) {
      var re = nameRe(n);
      if (re) out = out.replace(re, "the contact");
    });
    return stripPersonalLoose(out);
  }
  function redactHtml(html, names) {
    var s = String(html || "");
    if (typeof document !== "undefined") {
      var d = document.createElement("div");
      d.innerHTML = s;
      redactTextNodes(d, names);
      return d.innerHTML;
    }
    return s.replace(/([^<]+)|(<[^>]+>)/g, function (_, text, tag) { return tag || applyNames(text, names); });
  }
  function redactTextNodes(root, names) {
    if (!root || typeof document === "undefined") return;
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = it.nextNode())) n.nodeValue = applyNames(n.nodeValue, names);
  }
  function qualifierAfterName(value) {
    var t = foldName(value);
    var first = firstName(t);
    if (!first) return "";
    var at = t.toLowerCase().indexOf(first.toLowerCase());
    if (at < 0) return "";
    return t.slice(at + first.length).replace(/^\s*/, "");
  }
  function spokenContact(name) {
    if (!foldName(name)) return "the contact";
    return shouldHide(name) ? "the contact" : firstName(name);
  }

  function isContactKey(el) {
    if (!el) return false;
    var t = String(el.textContent || "").replace(/\s+/g, " ").trim();
    return /^(CONTACT|CONTACTO)$/i.test(t);
  }
  function hiddenSpan() {
    var s = document.createElement("span");
    s.className = "bb-contact-hidden";
    s.setAttribute("aria-label", "contact hidden");
    s.title = "contact hidden";
    s.setAttribute("data-bb-hidden", "1");
    s.textContent = "\u00a0";
    return s;
  }
  function hideValue(el) {
    if (!el || el.getAttribute("data-bb-hidden") === "1" || (el.querySelector && el.querySelector(".bb-contact-hidden"))) return;
    var rest = qualifierAfterName(el.textContent);
    el.textContent = "";
    el.removeAttribute("data-en");
    el.removeAttribute("data-es");
    el.appendChild(hiddenSpan());
    if (rest) el.appendChild(document.createTextNode(" " + rest));
  }
  function cardContactName(card) {
    if (!card || !card.querySelector) return "";
    var val = "";
    Array.prototype.forEach.call(card.querySelectorAll(".foot-row"), function (row) {
      var key = row.querySelector(".foot-key");
      var v = row.querySelector(".foot-val");
      if (isContactKey(key) && v) val = v.textContent;
    });
    if (!foldName(val)) {
      var ic = card.querySelector(".badge-ic");
      if (ic) val = ic.textContent;
    }
    return foldName(val);
  }
  function redactCard(card) {
    if (!card || !card.querySelector) return;
    var contact = cardContactName(card);
    var names = hideNames(contact, card.textContent || "");
    Array.prototype.forEach.call(card.querySelectorAll(".badge-ic"), function (el) {
      if (!shouldHide(el.textContent)) return;
      el.removeAttribute("data-en");
      el.removeAttribute("data-es");
      el.textContent = "IC: ";
      el.appendChild(hiddenSpan());
    });
    Array.prototype.forEach.call(card.querySelectorAll(".foot-row"), function (row) {
      var key = row.querySelector(".foot-key");
      var val = row.querySelector(".foot-val");
      if (!key || !val) return;
      if (isContactKey(key) && shouldHide(val.textContent)) { hideValue(val); return; }
      var en = val.getAttribute("data-en");
      var es = val.getAttribute("data-es");
      redactTextNodes(val, names);
      if (en != null) val.setAttribute("data-en", applyNames(en, names));
      if (es != null) val.setAttribute("data-es", applyNames(es, names));
    });
  }
  function redactTree(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll(".event-card"), function (card) { redactCard(card); });
    if (root.classList && root.classList.contains("event-card")) redactCard(root);
    Array.prototype.forEach.call(root.querySelectorAll(".group-contact, .original-contact"), function (el) {
      if (shouldHide(el.textContent)) hideValue(el);
    });
  }
  function cardSearchText(card, txtFn) {
    if (!card) return "";
    if (typeof card === "string") {
      return stripFromHtml(card, txtFn);
    }
    var clone = card.cloneNode(true);
    redactCard(clone);
    Array.prototype.forEach.call(clone.querySelectorAll(".bb-contact-hidden"), function (el) { el.parentNode && el.parentNode.removeChild(el); });
    var text = txtFn ? txtFn(clone) : String(clone.textContent || "").replace(/\s+/g, " ").trim();
    return stripPersonal(text);
  }
  function stripFromHtml(html) {
    var s = String(html || "");
    var ic = s.match(/<span class="badge badge-ic"[^>]*>([\s\S]*?)<\/span>/i);
    var foot = s.match(/<span class="foot-key"[^>]*>\s*CONTACTO?\s*<\/span>\s*<span class="foot-val"[^>]*>([\s\S]*?)<\/span>/i);
    var contact = foldName(foot ? foot[1].replace(/<[^>]+>/g, " ") : (ic ? ic[1].replace(/<[^>]+>/g, " ") : ""));
    s = s.replace(/<span class="badge badge-ic"[^>]*>[\s\S]*?<\/span>/gi, function (m) {
      return shouldHide(m.replace(/<[^>]+>/g, " ")) ? "" : m;
    });
    s = s.replace(/<div class="foot-row">\s*<span class="foot-key"[^>]*>\s*CONTACTO?\s*<\/span>\s*<span class="foot-val"[^>]*>[\s\S]*?<\/span>\s*<\/div>/gi, function (m) {
      return shouldHide(m.replace(/<[^>]+>/g, " ")) ? "" : m;
    });
    var text = s.replace(/<[^>]+>/g, " ");
    var names = hideNames(contact, text);
    text = applyNames(text, names);
    return stripPersonal(text);
  }

  function injectCss() {
    if (typeof document === "undefined" || document.getElementById("bb-contact-privacy-css")) return;
    var css = document.createElement("style");
    css.id = "bb-contact-privacy-css";
    css.textContent = ".bb-contact-hidden{display:inline-block;min-width:4.5em;height:.85em;margin:0 2px -1px;background:#111;border-radius:2px;color:transparent;user-select:none;pointer-events:none;vertical-align:middle}";
    (document.head || document.documentElement).appendChild(css);
  }
  function boot() {
    if (typeof document === "undefined") return;
    injectCss();
    function run() { redactTree(document); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
    if (typeof MutationObserver !== "undefined") {
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            var n = muts[i].addedNodes[j];
            if (n && n.nodeType === 1 && !(n.classList && n.classList.contains("bb-contact-hidden"))) redactTree(n);
          }
        }
      });
      function watch() { if (document.body) obs.observe(document.body, { childList: true, subtree: true }); }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
      else watch();
    }
  }
  boot();

  return {
    STAFF: STAFF,
    firstName: firstName,
    isStaff: isStaff,
    shouldHide: shouldHide,
    hasPersonalData: hasPersonalData,
    stripPersonal: stripPersonal,
    redactNameInText: redactNameInText,
    extraContactNames: extraContactNames,
    hideNames: hideNames,
    redactHtml: redactHtml,
    applyNames: applyNames,
    qualifierAfterName: qualifierAfterName,
    spokenContact: spokenContact,
    cardContactName: cardContactName,
    cardSearchText: cardSearchText,
    redactTree: redactTree,
    redactCard: redactCard,
    hiddenSpan: typeof document !== "undefined" ? hiddenSpan : null
  };
});
