import { json, bump } from '../_lib/util.js';

// Public: stores a contact-form message in KV. Keys sort newest-first (reversed timestamp).
const MAX = { name: 120, company: 160, email: 200, phone: 60, service: 60, message: 4000 };
const LIMIT_PER_HOUR = 5;
const MAX_STORED = 500;
const MIN_FILL_MS = 1500;
const MAX_LINKS = 3;

export async function onRequestPost({ request, env }) {
  if (!env.KNOSH) return json({ error: 'Messages are not set up yet.' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'Invalid request.' }, 400);
  if (b._gotcha) return json({ ok: true }); // honeypot: pretend it worked
  if (typeof b.t === 'number' && b.t < MIN_FILL_MS) return json({ ok: true }); // filled in faster than a person can type

  // Cloudflare Turnstile: only enforced when BOTH keys are set, the same condition under which the page shows the widget
  const tsSecret = (env.TURNSTILE_SECRET || '').trim(), tsSite = (env.TURNSTILE_SITE_KEY || '').trim();
  if (tsSecret && tsSite) {
    const r = await verifyTurnstile(tsSecret, typeof b.turnstile === 'string' ? b.turnstile : '', request.headers.get('CF-Connecting-IP'));
    if (!r.ok) {
      console.error('Turnstile check failed:', r.codes.join(','));
      const code = r.codes[0] ? ' (' + r.codes[0] + ')' : '';
      return json({ error: 'The security check didn’t pass' + code + '. Please reload the page and try again.', code: r.codes[0] || '' }, 400);
    }
  }

  const m = {};
  for (const k of Object.keys(MAX)) {
    const v = typeof b[k] === 'string' ? b[k].trim() : '';
    if (v.length > MAX[k]) return json({ error: 'One of the fields is too long.' }, 400);
    m[k] = v;
  }
  if (!m.name || !m.email || !m.phone || !m.message) return json({ error: 'Please fill in name, email, phone and message.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return json({ error: 'That email address doesn’t look right.' }, 400);

  if ((m.message.match(/https?:\/\//gi) || []).length > MAX_LINKS) return json({ error: 'Please remove some of the links from your message and try again.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rl = 'rl:' + ip;
  const n = parseInt((await env.KNOSH.get(rl)) || '0', 10);
  if (n >= LIMIT_PER_HOUR) return json({ error: 'Too many messages from your connection.' }, 429);
  await env.KNOSH.put(rl, String(n + 1), { expirationTtl: 3600 });

  const now = Date.now();
  const id = 'msg:' + String(9999999999999 - now).padStart(13, '0') + '-' +
    [...crypto.getRandomValues(new Uint8Array(4))].map(x => x.toString(16).padStart(2, '0')).join('');
  await env.KNOSH.put(id, JSON.stringify({ ...m, date: new Date(now).toISOString(), read: false }));

  try { await bump(env, { e: 'message' }); } catch (e) {}
  await notify(env, m);

  // keep storage bounded: drop the oldest beyond MAX_STORED
  const all = await env.KNOSH.list({ prefix: 'msg:', limit: 1000 });
  for (const k of all.keys.slice(MAX_STORED)) await env.KNOSH.delete(k.name);
  return json({ ok: true });
}

// Emails the message to NOTIFY_EMAIL through Resend (https://resend.com). Best effort:
// the message is already saved, so a failed email never fails the visitor's submission.
async function notify(env, m) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return;
  const clean = v => String(v).replace(/[\r\n]+/g, ' ').slice(0, 120);
  const text = [
    'New message from the Knosh Box website',
    '',
    'Name:    ' + m.name,
    'Company: ' + (m.company || '-'),
    'Email:   ' + m.email,
    'Phone:   ' + m.phone,
    'Need:    ' + (m.service || '-'),
    '',
    m.message
  ].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Knosh Box Website <onboarding@resend.dev>',
        to: env.NOTIFY_EMAIL.split(',').map(x => x.trim()).filter(Boolean),
        reply_to: m.email,
        subject: 'Website message from ' + clean(m.name) + (m.company ? ' (' + clean(m.company) + ')' : ''),
        text
      })
    });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
  } catch (e) { console.error('Resend failed', e); }
}

// Returns { ok, codes } where codes are Cloudflare's error-codes (for troubleshooting).
export async function verifyTurnstile(secret, token, ip) {
  if (!token) return { ok: false, codes: ['missing-input-response'] };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const j = await r.json();
    return { ok: j.success === true, codes: Array.isArray(j['error-codes']) ? j['error-codes'] : [] };
  } catch (e) { return { ok: false, codes: ['verify-request-failed'] }; }
}
