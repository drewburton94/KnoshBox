import { json } from '../_lib/util.js';

// Public: stores a contact-form message in KV. Keys sort newest-first (reversed timestamp).
const MAX = { name: 120, company: 160, email: 200, phone: 60, service: 60, size: 60, message: 4000 };
const LIMIT_PER_HOUR = 5;
const MAX_STORED = 500;

export async function onRequestPost({ request, env }) {
  if (!env.KNOSH) return json({ error: 'Messages are not set up yet.' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'Invalid request.' }, 400);
  if (b._gotcha) return json({ ok: true }); // honeypot: pretend it worked

  const m = {};
  for (const k of Object.keys(MAX)) {
    const v = typeof b[k] === 'string' ? b[k].trim() : '';
    if (v.length > MAX[k]) return json({ error: 'One of the fields is too long.' }, 400);
    m[k] = v;
  }
  if (!m.name || !m.email || !m.phone || !m.message) return json({ error: 'Please fill in name, email, phone and message.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return json({ error: 'That email address doesn’t look right.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rl = 'rl:' + ip;
  const n = parseInt((await env.KNOSH.get(rl)) || '0', 10);
  if (n >= LIMIT_PER_HOUR) return json({ error: 'Too many messages from your connection.' }, 429);
  await env.KNOSH.put(rl, String(n + 1), { expirationTtl: 3600 });

  const now = Date.now();
  const id = 'msg:' + String(9999999999999 - now).padStart(13, '0') + '-' +
    [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(16).padStart(2, '0')).join('');
  await env.KNOSH.put(id, JSON.stringify({ ...m, date: new Date(now).toISOString(), read: false }));

  // keep storage bounded: drop the oldest beyond MAX_STORED
  const all = await env.KNOSH.list({ prefix: 'msg:', limit: 1000 });
  for (const k of all.keys.slice(MAX_STORED)) await env.KNOSH.delete(k.name);
  return json({ ok: true });
}
