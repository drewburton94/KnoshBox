import { json, bump, allowHit, EVENTS } from '../_lib/util.js';

// Public: cookie-free, anonymous counters (no IP or user-agent is stored).
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python|lighthouse/i;

export async function onRequestPost({ request, env }) {
  try {
    if (BOT.test(request.headers.get('User-Agent') || '')) return json({ ok: true });
    let b; try { b = await request.json(); } catch (e) { return json({ ok: false }, 400); }
    if (!b || !EVENTS.includes(b.e) || b.e === 'message') return json({ ok: false }, 400);
    if (!(await allowHit(request, 60, 'track'))) return json({ ok: true });
    await bump(env, { e: b.e, ref: typeof b.ref === 'string' ? b.ref : '', dev: b.dev, visitor: b.visitor === true });
  } catch (e) { /* analytics must never break the site */ }
  return json({ ok: true });
}
