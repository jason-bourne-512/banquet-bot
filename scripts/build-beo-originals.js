#!/usr/bin/env node
/**
 * BEO originals for the beta BEO tab (beo-beta.html). LOCAL ONLY.
 *
 * Reads the BEO packet PDFs in a folder (default ~/Downloads, files with "BEO" in the name), finds each
 * Event Order page (EO #, function date, organization, POST AS, date printed, page x of y), keeps the
 * newest printed version of every EO as the "current" original, and renders its pages to PNG in
 * beo-originals/ (gitignored, never committed, never pushed). Writes beo-originals/index.json.
 *
 *   node scripts/build-beo-originals.js [--src DIR] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Default window: 7 days back through 21 days out. Needs poppler (pdftotext, pdftoppm).
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = path.join(__dirname, "..", "beo-originals");
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseLongDate(s) {
  const m = /([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(s || "");
  if (!m) return "";
  const mi = MONTHS.indexOf(m[1]);
  return mi < 0 ? "" : m[3] + "-" + String(mi + 1).padStart(2, "0") + "-" + String(+m[2]).padStart(2, "0");
}
function pageInfo(text) {
  const eo = /Event Order #:\s*(\d+)/.exec(text);
  if (!eo) return null;
  const pg = /Page #\s*(\d+)\s*of\s*(\d+)/.exec(text);
  const field = (label) => { const m = new RegExp("^" + label + ":\\s*(.*?)\\s*(?:REVISED|CANCEL\\w*)?\\s*$", "m").exec(text); return m ? m[1].replace(/\s{2,}.*/, "").trim() : ""; };
  const day = /FUNCTION DAY\/DATE:\s*(.+)/.exec(text);
  return {
    eo: eo[1],
    page: pg ? +pg[1] : 1,
    of: pg ? +pg[2] : 1,
    date: parseLongDate(day && day[1]),
    org: field("ORGANIZATION"),
    postAs: field("POST AS"),
    printed: parseLongDate((/DATE PRINTED:\s*(.+)/.exec(text) || [])[1]),
    revisedFlag: /ORGANIZATION:.*\bREVISED\b/.test(text)
  };
}
// Packets reprint unchanged orders every week. Only a reprint whose text differs from the previous print is a revision.
function realVersions(byPrinted, keys) {
  const sig = (v) => Object.keys(v.pages).sort().map((p) => v.pages[p].text).join(" | ");
  const out = [];
  keys.forEach((k) => {
    const v = byPrinted[k];
    if (!out.length || sig(v) !== out[out.length - 1].sig) out.push({printed: k, source: path.basename(v.file), sig: sig(v)});
  });
  return out.map(({printed, source}) => ({printed, source}));
}
function arg(name, dflt) { const i = process.argv.indexOf("--" + name); return i > -1 ? process.argv[i + 1] : dflt; }
function iso(d) { return d.toLocaleDateString("en-CA", {timeZone: "America/Chicago"}); }

function main() {
  const src = arg("src", path.join(os.homedir(), "Downloads"));
  const today = new Date();
  const from = arg("from", iso(new Date(today.getTime() - 7 * 864e5)));
  const to = arg("to", iso(new Date(today.getTime() + 21 * 864e5)));
  const files = fs.readdirSync(src).filter((f) => /beo/i.test(f) && /\.pdf$/i.test(f)).sort();
  // versions[eo][printed] = {file, pages:{n: pdfPage}, info}
  const eos = {};
  files.forEach((f) => {
    const pdf = path.join(src, f);
    let txt;
    try { txt = execFileSync("pdftotext", ["-layout", pdf, "-"], {maxBuffer: 1 << 28}).toString(); } catch (e) { console.warn("skip (unreadable):", f); return; }
    let head = null; // continuation pages ("Page 2 of 3") carry no header fields: inherit from page 1 of the same EO
    txt.split("\f").forEach((pt, i) => {
      const info = pageInfo(pt);
      if (info && info.printed) head = info;
      else if (info && head && head.eo === info.eo) Object.assign(info, {org: head.org, postAs: head.postAs, printed: head.printed, revisedFlag: head.revisedFlag});
      if (!info || !info.date || info.date < from || info.date > to) return;
      const e = eos[info.eo] = eos[info.eo] || {};
      const v = e[info.printed || "unknown"] = e[info.printed || "unknown"] || {file: pdf, pages: {}, info};
      if (!v.pages[info.page]) v.pages[info.page] = {pdf, n: i + 1, text: pt.replace(/DATE PRINTED:.*|Page #.*|\s+/g, " ").trim()};
      if (info.revisedFlag) v.info.revisedFlag = true;
    });
  });
  fs.mkdirSync(OUT, {recursive: true});
  const days = {};
  Object.keys(eos).forEach((eo) => {
    const printedKeys = Object.keys(eos[eo]).sort();
    const cur = eos[eo][printedKeys[printedKeys.length - 1]];
    const info = cur.info;
    const dir = path.join(OUT, info.date);
    fs.mkdirSync(dir, {recursive: true});
    const pages = Object.keys(cur.pages).map(Number).sort((a, b) => a - b).map((p) => {
      const name = eo + "-p" + p + ".png", ref = cur.pages[p], base = path.join(dir, eo + "-p" + p);
      if (!fs.existsSync(path.join(dir, name)) || fs.statSync(path.join(dir, name)).mtimeMs < fs.statSync(ref.pdf).mtimeMs)
        execFileSync("pdftoppm", ["-r", "110", "-png", "-singlefile", "-f", String(ref.n), "-l", String(ref.n), ref.pdf, base]);
      return info.date + "/" + name;
    });
    (days[info.date] = days[info.date] || []).push({
      eo, org: info.org, postAs: info.postAs, printed: info.printed, pages,
      expectedPages: info.of, revisedFlag: !!info.revisedFlag,
      versions: realVersions(eos[eo], printedKeys)
    });
  });
  Object.keys(days).forEach((d) => days[d].sort((a, b) => a.org.localeCompare(b.org)));
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({generated: new Date().toISOString(), from, to, days}, null, 1));
  const n = Object.values(days).reduce((a, l) => a + l.length, 0);
  console.log("BEO originals: " + n + " event orders on " + Object.keys(days).length + " days (" + from + " to " + to + ") -> " + OUT);
}
main();
