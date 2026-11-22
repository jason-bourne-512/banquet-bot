#!/usr/bin/env node
// Local-only static server for the BEO beta: node scripts/serve-beo-beta.js  ->  http://127.0.0.1:8765/beo-beta.html
// Binds to 127.0.0.1 only, so the BEO originals in beo-originals/ never leave this Mac.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 8765;
const TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".woff2": "font/woff2"};
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400); return res.end("bad request"); }
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || /(^|\/)(\.git|node_modules|data)(\/|$)/.test(p)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache"});
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", () => console.log("BEO beta: http://127.0.0.1:" + PORT + "/beo-beta.html"));
