import { json, requireEditor } from '../_lib/util.js';

// Editor only. POST { action: 'list' | 'read' | 'delete', id? }
const ID_RE = /^msg:\d{13}-[a-f0-9]{8}$/;

export async function onRequestPost({ request, env }) {
  const denied = await requireEditor(request, env);
  if (denied) return denied;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }

  if (b.action === 'list') {
    const { keys } = await env.KNOSH.list({ prefix: 'msg:', limit: 200 });
    const messages = [];
    for (const k of keys) {
      try { messages.push({ id: k.name, ...JSON.parse(await env.KNOSH.get(k.name)) }); } catch (e) {}
    }
    return json({ messages });
  }
  if (!ID_RE.test(b.id || '')) return json({ error: 'Invalid message.' }, 400);
  if (b.action === 'delete') { await env.KNOSH.delete(b.id); return json({ ok: true }); }
  if (b.action === 'read') {
    const raw = await env.KNOSH.get(b.id);
    if (!raw) return json({ error: 'Message not found.' }, 404);
    await env.KNOSH.put(b.id, JSON.stringify({ ...JSON.parse(raw), read: b.read !== false }));
    return json({ ok: true });
  }
  return json({ error: 'Invalid request.' }, 400);
}
