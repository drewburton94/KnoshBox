// Shared helpers for the editor API (Cloudflare Pages Functions).
// Bindings: KNOSH (KV namespace). Secrets: EDIT_TOKEN, EDIT_PASSWORD.

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }
  });

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b))
  ]);
  const A = new Uint8Array(x), B = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < A.length; i++) d |= A[i] ^ B[i];
  return d === 0;
}

const MAX_FAILS = 10; // per IP per 15 minutes
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
const PBKDF2_ITER = 10000; // Workers' free plan has a small CPU budget per request

async function derive(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}

// A password changed in the editor is stored (salted + hashed) in KV and replaces EDIT_PASSWORD.
// To go back to EDIT_PASSWORD, delete the KV key "cfg:auth".
export async function setPassword(env, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await env.KNOSH.put('cfg:auth', JSON.stringify({ salt: hex(salt), iter: PBKDF2_ITER, hash: await derive(pw, salt, PBKDF2_ITER) }));
}
export const hasCustomPassword = async env => !!(await env.KNOSH.get('cfg:auth'));

async function passwordOk(env, pw) {
  const raw = await env.KNOSH.get('cfg:auth');
  if (raw) {
    try { const a = JSON.parse(raw); return safeEqual(await derive(pw, unhex(a.salt), a.iter), a.hash); } catch (e) { return false; }
  }
  return safeEqual(pw, env.EDIT_PASSWORD);
}

// Requires both the secret link token and the password. Returns null when allowed,
// otherwise a ready-to-send Response.
export async function requireEditor(request, env) {
  if (!env.EDIT_TOKEN || !env.EDIT_PASSWORD || !env.KNOSH) {
    return json({ error: 'The editor is not configured on the server yet.' }, 503);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const failKey = 'fail:' + ip;
  const fails = parseInt((await env.KNOSH.get(failKey)) || '0', 10);
  if (fails >= MAX_FAILS) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);

  const tokenOk = await safeEqual(request.headers.get('X-Edit-Token') || '', env.EDIT_TOKEN);
  const passOk = await passwordOk(env, request.headers.get('X-Edit-Password') || '');
  if (!(tokenOk && passOk)) {
    await env.KNOSH.put(failKey, String(fails + 1), { expirationTtl: 900 });
    return json({ error: 'Wrong link or password.' }, 401);
  }
  if (fails) await env.KNOSH.delete(failKey);
  return null;
}

export const tokenMatches = (token, env) => !!env.EDIT_TOKEN && safeEqual(token || '', env.EDIT_TOKEN);

// ---- analytics: one small JSON document per day (Detroit time), kept for 400 days ----
const TZ = 'America/Detroit';
export const dayKey = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export const EVENTS = ['view', 'visitor', 'video_play', 'call', 'contact_click', 'message'];

// Read-modify-write on KV: fine for a small site, may miss a count if two hits land in the same instant.
export async function bump(env, { e, ref, dev, visitor }) {
  if (!env.KNOSH || !EVENTS.includes(e)) return;
  const key = 'stat:' + dayKey();
  let d;
  try { d = JSON.parse((await env.KNOSH.get(key)) || '{}'); } catch (err) { d = {}; }
  d.v = d.v || 0; d.u = d.u || 0; d.e = d.e || {}; d.r = d.r || {}; d.d = d.d || {};
  if (e === 'view') {
    d.v++;
    if (visitor) d.u++; // sent with the view so both land in one write
    if (dev === 'mobile' || dev === 'desktop') d.d[dev] = (d.d[dev] || 0) + 1;
    const host = /^[a-z0-9.-]{1,80}$/i.test(ref || '') ? ref.toLowerCase() : 'direct';
    const k = host in d.r || Object.keys(d.r).length < 40 ? host : 'other';
    d.r[k] = (d.r[k] || 0) + 1;
  } else if (e === 'visitor') d.u++;
  else d.e[e] = (d.e[e] || 0) + 1;
  await env.KNOSH.put(key, JSON.stringify(d), { expirationTtl: 400 * 86400 });
}

// Cache-API rate limiter (no KV writes, so abuse can't use up the KV quota). Fails open where the Cache API is absent.
export async function allowHit(request, limit, name) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return true;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const url = 'https://rl.internal/' + name + '/' + encodeURIComponent(ip) + '/' + Math.floor(Date.now() / 3600000);
    const hit = await caches.default.match(url);
    const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (n >= limit) return false;
    await caches.default.put(url, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
  } catch (e) {}
  return true;
}
