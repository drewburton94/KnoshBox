import { tokenMatches } from '../_lib/util.js';

// The special link: /edit/<EDIT_TOKEN> serves the editor. Any other token is a plain 404.
// (The API also requires the token and the password, so the page alone grants nothing.)
export async function onRequestGet({ params, request, env }) {
  if (!(await tokenMatches(String(params.token || ''), env))) return new Response('Not found', { status: 404 });
  const page = await env.ASSETS.fetch(new URL('/editor/', request.url));
  const res = new Response(page.body, page);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
