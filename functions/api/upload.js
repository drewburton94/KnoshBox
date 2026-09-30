import { json, requireEditor } from '../_lib/util.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const denied = await requireEditor(request, env);
  if (denied) return denied;

  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!TYPES.includes(type)) return json({ error: 'Use a JPG, PNG or WebP image.' }, 415);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: 'Empty upload.' }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: 'Image is over 5 MB.' }, 413);

  const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await env.KNOSH.put('img:' + id, buf, { metadata: { type } });
  return json({ url: '/api/img/' + id });
}
