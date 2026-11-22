#!/usr/bin/env node
/**
 * BEO originals for the beta BEO tab (beo-beta.html). LOCAL ONLY.
 *
 * Reads the BEO packet PDFs in a folder (default ~/Downloads, files with "BEO" in the name), finds each
 * Event Order page (EO #, function date, organization, POST AS, date printed, page x of y), keeps every source
 * document as its own version (newest print, then file name, is the "current" original; conflicting same-day copies are flagged), and renders its pages to PNG in
 * beo-originals/ (gitignored, never committed, never pushed). Writes beo-originals/index.json.
 *
 *   node scripts/build-beo-originals.js [--src DIR] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Default window: 7 days back through 21 days out. Needs poppler (pdftotext, pdftoppm).
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
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
// Packets reprint unchanged orders every week. Each source document is its own version. A version is only listed as a
// revision when its text differs from the previous one; two different copies with the same print date are flagged as a conflict.
function pageSig(v) { return Object.keys(v.pages).sort((a, b) => a - b).map((p) => v.pages[p].text).join(" | "); }
function orderVersions(list) {
  return list.slice().sort((a, b) => (a.printed || "").localeCompare(b.printed || "") || path.basename(a.file).localeCompare(path.basename(b.file)));
}
function realVersions(ordered) {
  const out = [];
  ordered.forEach((v) => {
    const sig = pageSig(v), last = out[out.length - 1];
    if (!last) return out.push({printed: v.printed, source: path.basename(v.file), sig});
    if (sig === last.sig) return;
    const entry = {printed: v.printed, source: path.basename(v.file), sig};
    if (v.printed === last.printed) entry.sameDayConflict = true;
    out.push(entry);
  });
  return out.map(({printed, source, sameDayConflict}) => sameDayConflict ? {printed, source, sameDayConflict: true} : {printed, source});
}
function fileHash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16); }
function arg(name, dflt) { const i = process.argv.indexOf("--" + name); return i > -1 ? process.argv[i + 1] : dflt; }
function iso(d) { return d.toLocaleDateString("en-CA", {timeZone: "America/Chicago"}); }

function main() {
  const src = arg("src", path.join(os.homedir(), "Downloads"));
  const today = new Date();
  const from = arg("from", iso(new Date(today.getTime() - 7 * 864e5)));
  const to = arg("to", iso(new Date(today.getTime() + 21 * 864e5)));
  const files = fs.readdirSync(src).filter((f) => /beo/i.test(f) && /\.pdf$/i.test(f)).sort();
  // eos[eo] = one version per source document: {file, hash, printed, pages:{n: {pdf, n, text}}, info}
  const eos = {};
  files.forEach((f) => {
    const pdf = path.join(src, f);
    let txt;
    try { txt = execFileSync("pdftotext", ["-layout", pdf, "-"], {maxBuffer: 1 << 28}).toString(); } catch (e) { console.warn("skip (unreadable):", f); return; }
    const hash = fileHash(pdf), mine = {};
    let head = null; // continuation pages ("Page 2 of 3") carry no header fields: inherit from page 1 of the same EO
    txt.split("\f").forEach((pt, i) => {
      const info = pageInfo(pt);
      if (info && head && head.eo === info.eo) {
        ["org", "postAs", "printed", "date"].forEach((k) => { if (!info[k]) info[k] = head[k]; });
        info.revisedFlag = info.revisedFlag || head.revisedFlag;
      }
      if (info && info.printed) head = info;
      if (!info || !info.date || info.date < from || info.date > to) return;
      let v = mine[info.eo];
      if (!v) { v = mine[info.eo] = {file: pdf, hash, printed: info.printed || "unknown", pages: {}, info}; (eos[info.eo] = eos[info.eo] || []).push(v); }
      if (!v.pages[info.page]) v.pages[info.page] = {pdf, n: i + 1, text: pt.replace(/DATE PRINTED:.*|Page #.*|\s+/g, " ").trim()};
      if (info.revisedFlag) v.info.revisedFlag = true;
    });
  });
  fs.mkdirSync(OUT, {recursive: true});
  const days = {};
  Object.keys(eos).forEach((eo) => {
    const ordered = orderVersions(eos[eo]);
    const cur = ordered[ordered.length - 1];
    const info = cur.info;
    const dir = path.join(OUT, info.date);
    fs.mkdirSync(dir, {recursive: true});
    const pages = Object.keys(cur.pages).map(Number).sort((a, b) => a - b).map((p) => {
      // Cached by source content hash and PDF page, so a different revision can never show an older image.
      const ref = cur.pages[p], stem = eo + "-p" + p, name = stem + "-" + cur.hash + "-" + ref.n + ".png", base = path.join(dir, name.slice(0, -4));
      if (!fs.existsSync(path.join(dir, name)))
        execFileSync("pdftoppm", ["-r", "110", "-png", "-singlefile", "-f", String(ref.n), "-l", String(ref.n), ref.pdf, base]);
      fs.readdirSync(dir).forEach((f) => { if (f !== name && (f === stem + ".png" || f.startsWith(stem + "-"))) fs.unlinkSync(path.join(dir, f)); });
      return info.date + "/" + name;
    });
    (days[info.date] = days[info.date] || []).push({
      eo, org: info.org, postAs: info.postAs, printed: cur.printed, pages,
      expectedPages: info.of, revisedFlag: !!info.revisedFlag,
      versions: realVersions(ordered)
    });
  });
  Object.keys(days).forEach((d) => days[d].sort((a, b) => a.org.localeCompare(b.org)));
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({generated: new Date().toISOString(), from, to, days}, null, 1));
  const n = Object.values(days).reduce((a, l) => a + l.length, 0);
  console.log("BEO originals: " + n + " event orders on " + Object.keys(days).length + " days (" + from + " to " + to + ") -> " + OUT);
}
main();
