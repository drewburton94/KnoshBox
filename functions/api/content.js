import { json } from '../_lib/util.js';

// Public: the saved text/video/image overrides. Missing keys fall back to the HTML defaults.
export async function onRequestGet({ env }) {
  let values = {};
  try { if (env.KNOSH) values = JSON.parse((await env.KNOSH.get('content')) || '{}').values || {}; } catch (e) {}
  return json({ values, config: { turnstileSiteKey: (env.TURNSTILE_SITE_KEY || '').trim() && (env.TURNSTILE_SECRET || '').trim() ? env.TURNSTILE_SITE_KEY.trim() : '' } }, 200, { 'Cache-Control': 'public, max-age=30' });
}
