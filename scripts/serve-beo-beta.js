#!/usr/bin/env node
// Local-only server for the BEO tab: node scripts/serve-beo-beta.js  ->  http://127.0.0.1:8765/beo-beta.html
// Binds to 127.0.0.1 only, so the BEO originals in beo-originals/ and the saved notes/highlights never leave this Mac.
// Notes and highlights live in beo-local-state.json at the repo root (gitignored), written atomically.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const Store = require("./beo-local-store.js");

const TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".woff2": "font/woff2"};
const BLOCKED = /(^|\/)(\.[^/]*|node_modules|data|beo-local-state[^/]*|firebase-config\.js|firestore\.rules(\.local)?)(\/|$)/;
const MAX_BODY = Store.MAX_BYTES + 4096;

function createServer(opts) {
  opts = opts || {};
  const root = path.resolve(opts.root || path.join(__dirname, ".."));
  const stateFile = opts.stateFile || path.join(root, "beo-local-state.json");
  const port = opts.port || 8765;

  function load() {
    try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch (e) { return Store.emptyState(); }
  }
  // Temp file in the same folder, then rename, so a crash never leaves half a file.
  function save(state) {
    const tmp = stateFile + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(state), {mode: 0o600});
    fs.renameSync(tmp, stateFile);
  }
  const backend = Store.stateBackend(load, save);

  function send(res, code, obj) {
    res.writeHead(code, {"Content-Type": "application/json", "Cache-Control": "no-store"});
    res.end(JSON.stringify(obj));
  }
  function hostOk(req) {
    const h = String(req.headers.host || "");
    return h === "127.0.0.1:" + port || h === "localhost:" + port || h === "127.0.0.1" || h === "localhost";
  }
  function originOk(req) {
    const o = req.headers.origin;
    if (!o) return true;
    return o === "http://127.0.0.1:" + port || o === "http://localhost:" + port;
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let n = 0, over = false; const chunks = [];
      req.on("data", (c) => { n += c.length; if (over) return; if (n > MAX_BODY) { over = true; chunks.length = 0; reject(Object.assign(new Error("Too large."), {code: 413})); } else chunks.push(c); });
      req.on("end", () => {
        if (over) return;
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(Object.assign(new Error("Bad JSON."), {code: 400})); }
      });
      req.on("error", reject);
    });
  }

  function api(req, res, p) {
    if (!hostOk(req) || !originOk(req)) return send(res, 403, {error: "Not allowed."});
    const m = /^\/api\/beo\/(state|notes|highlights|import)(?:\/([^/]+))?$/.exec(p);
    if (!m) return send(res, 404, {error: "Not found."});
    const what = m[1], id = m[2], method = req.method;
    if (method === "GET" && what === "state" && !id) return backend.state().then((s) => send(res, 200, s), () => send(res, 500, {error: "Could not read saved notes."}));
    if (method !== "GET" && !/^application\/json\b/i.test(req.headers["content-type"] || "") && method !== "DELETE") return send(res, 415, {error: "JSON only."});
    if (method === "DELETE" && id && (what === "notes" || what === "highlights")) {
      if (!Store.idOk(id)) return send(res, 400, {error: "Bad id."});
      return (what === "notes" ? backend.removeNote(id) : backend.removeHighlight(id)).then(() => send(res, 200, {ok: true}), () => send(res, 500, {error: "Could not save."}));
    }
    if (method === "POST" && !id && (what === "notes" || what === "highlights" || what === "import")) {
      return readBody(req).then((body) => {
        if (!body || typeof body !== "object" || Array.isArray(body)) throw Object.assign(new Error("Bad body."), {code: 400});
        const op = what === "notes" ? backend.addNote(body) : what === "highlights" ? backend.addHighlight(body) : backend.merge(body);
        return op.then((item) => send(res, 200, what === "import" ? {ok: true} : {item: item}), (e) => { throw Object.assign(new Error(e.message || "Rejected."), {code: 400}); });
      }).catch((e) => send(res, e.code || 400, {error: e.message}));
    }
    return send(res, 405, {error: "Method not allowed."});
  }

  return http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400); return res.end("bad request"); }
    if (p.startsWith("/api/")) return api(req, res, p);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end("no"); }
    if (p.endsWith("/")) p += "index.html";
    if (p.indexOf("\0") > -1) { res.writeHead(400); return res.end("bad request"); }
    const file = path.join(root, p);
    if (!file.startsWith(root + path.sep) || BLOCKED.test(p)) { res.writeHead(403); return res.end("no"); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache"});
      res.end(buf);
    });
  });
}

module.exports = {createServer, BLOCKED};

if (require.main === module) {
  const PORT = +process.env.PORT || 8765;
  createServer({port: PORT}).listen(PORT, "127.0.0.1", () => console.log("BEO beta: http://127.0.0.1:" + PORT + "/beo-beta.html"));
}
