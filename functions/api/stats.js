import { json, requireEditor, dayKey } from '../_lib/util.js';

// Editor only. POST { days: 1..180 } -> one entry per day, oldest first, zero-filled.
export async function onRequestPost({ request, env }) {
  const denied = await requireEditor(request, env);
  if (denied) return denied;
  let b; try { b = await request.json(); } catch (e) { b = {}; }
  const n = Math.max(1, Math.min(180, parseInt(b.days, 10) || 30));
  const dates = [];
  for (let i = n - 1; i >= 0; i--) dates.push(dayKey(new Date(Date.now() - i * 86400000)));
  const days = await Promise.all(dates.map(async date => {
    let d = {};
    try { d = JSON.parse((await env.KNOSH.get('stat:' + date)) || '{}'); } catch (e) {}
    return { date, v: d.v || 0, u: d.u || 0, e: d.e || {}, r: d.r || {}, d: d.d || {} };
  }));
  return json({ days });
}
