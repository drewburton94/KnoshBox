import { json, requireEditor } from '../_lib/util.js';

const KEY_RE = /^[a-z0-9.]{1,40}$/;
const IMG_RE = /^\/api\/img\/[a-f0-9]{32}$/;
const MAX_KEYS = 300, MAX_TEXT = 3000;

export async function onRequestPost({ request, env }) {
  const denied = await requireEditor(request, env);
  if (denied) return denied;

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }
  const input = body && body.values;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid request.' }, 400);

  const keys = Object.keys(input);
  if (keys.length > MAX_KEYS) return json({ error: 'Too many fields.' }, 400);
  const values = {};
  for (const k of keys) {
    const v = input[k];
    if (!KEY_RE.test(k) || typeof v !== 'string') return json({ error: 'Invalid field: ' + k }, 400);
    if (v.length > MAX_TEXT) return json({ error: 'That text is too long: ' + k }, 400);
    if (/\.(photo|logo)$/.test(k) && v && !IMG_RE.test(v)) return json({ error: 'Invalid image: ' + k }, 400);
    if (v !== '') values[k] = v;
  }
  await env.KNOSH.put('content', JSON.stringify({ values, savedAt: new Date().toISOString() }));
  return json({ ok: true });
}
