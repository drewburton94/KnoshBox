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
  const passOk = await safeEqual(request.headers.get('X-Edit-Password') || '', env.EDIT_PASSWORD);
  if (!(tokenOk && passOk)) {
    await env.KNOSH.put(failKey, String(fails + 1), { expirationTtl: 900 });
    return json({ error: 'Wrong link or password.' }, 401);
  }
  if (fails) await env.KNOSH.delete(failKey);
  return null;
}

export const tokenMatches = (token, env) => !!env.EDIT_TOKEN && safeEqual(token || '', env.EDIT_TOKEN);
