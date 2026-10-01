import { json, requireEditor, setPassword, hasCustomPassword } from '../_lib/util.js';

// Editor only. POST { action: 'info' } or { action: 'password', newPassword }
export async function onRequestPost({ request, env }) {
  const denied = await requireEditor(request, env);
  if (denied) return denied;
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Invalid request.' }, 400); }

  if (b.action === 'info') {
    const to = (env.NOTIFY_EMAIL || '').split(',').map(x => x.trim()).filter(Boolean)
      .map(a => a.replace(/^(.).*(@.*)$/, '$1•••$2'));
    return json({
      customPassword: await hasCustomPassword(env),
      emailOn: !!(env.RESEND_API_KEY && to.length), emailTo: to,
      botProtection: !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET)
    });
  }
  if (b.action === 'password') {
    const pw = typeof b.newPassword === 'string' ? b.newPassword : '';
    if (pw.length < 10) return json({ error: 'Use at least 10 characters.' }, 400);
    if (pw.length > 200) return json({ error: 'That password is too long.' }, 400);
    if (pw === request.headers.get('X-Edit-Password')) return json({ error: 'Choose a password different from the current one.' }, 400);
    await setPassword(env, pw);
    return json({ ok: true });
  }
  return json({ error: 'Invalid request.' }, 400);
}
