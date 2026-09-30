// Local preview server that mimics Cloudflare Pages + Functions + KV.
// Usage: node dev/server.mjs   (default http://localhost:8788)
// Editor: http://localhost:8788/edit/dev-token  (password: dev-password)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const kvFile = path.join(root, '.dev-kv.json');
const PORT = process.env.PORT || 8788;

const store = fs.existsSync(kvFile) ? JSON.parse(fs.readFileSync(kvFile, 'utf8')) : {};
const persist = () => fs.writeFileSync(kvFile, JSON.stringify(store));
const KNOSH = {
  async get(k) { const e = store[k]; return e && e.t === 's' ? e.v : (e ? Buffer.from(e.v, 'base64').toString() : null); },
  async put(k, v, o = {}) {
    store[k] = v instanceof ArrayBuffer ? { t: 'b', v: Buffer.from(v).toString('base64'), m: o.metadata } : { t: 's', v: String(v) };
    if (o.expirationTtl) setTimeout(() => { delete store[k]; }, o.expirationTtl * 1000).unref();
    persist();
  },
  async delete(k) { delete store[k]; persist(); },
  async getWithMetadata(k) {
    const e = store[k]; if (!e) return { value: null, metadata: null };
    const b = Buffer.from(e.v, 'base64'); return { value: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), metadata: e.m };
  }
};
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
function serveStatic(pathname) {
  let f = path.join(pub, path.normalize(pathname));
  if (!f.startsWith(pub)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return null;
  return new Response(fs.readFileSync(f), { headers: { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' } });
}
const env = {
  KNOSH, EDIT_TOKEN: process.env.EDIT_TOKEN || 'dev-token', EDIT_PASSWORD: process.env.EDIT_PASSWORD || 'dev-password',
  ASSETS: { fetch: req => serveStatic(new URL(req.url || req.href || String(req)).pathname) || new Response('Not found', { status: 404 }) }
};
const routes = [
  [/^\/api\/content$/, 'api/content.js', {}], [/^\/api\/auth$/, 'api/auth.js', {}], [/^\/api\/save$/, 'api/save.js', {}],
  [/^\/api\/upload$/, 'api/upload.js', {}], [/^\/api\/img\/([^/]+)$/, 'api/img/[id].js', 'id'], [/^\/edit\/([^/]+)$/, 'edit/[token].js', 'token']
];

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + PORT);
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    let response;
    for (const [re, file, pname] of routes) {
      const m = url.pathname.match(re); if (!m) continue;
      const mod = await import(pathToFileURL(path.join(root, 'functions', file)).href);
      const h = mod['onRequest' + req.method[0] + req.method.slice(1).toLowerCase()] || mod.onRequest;
      response = h ? await h({ request, env, params: pname ? { [pname]: decodeURIComponent(m[1]) } : {} }) : new Response('Method not allowed', { status: 405 });
      break;
    }
    response = response || serveStatic(url.pathname === '/' ? '/index.html' : url.pathname) || new Response('Not found', { status: 404 });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) { console.error(e); res.writeHead(500); res.end('Server error'); }
}).listen(PORT, () => console.log('http://localhost:' + PORT + '   editor: /edit/' + env.EDIT_TOKEN));
