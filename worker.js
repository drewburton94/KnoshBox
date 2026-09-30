// Cloudflare Workers entry: routes /api/* and /edit/<token> to the handlers in functions/,
// and serves everything else from public/ (the [assets] binding).
import * as content from './functions/api/content.js';
import * as auth from './functions/api/auth.js';
import * as save from './functions/api/save.js';
import * as upload from './functions/api/upload.js';
import * as contact from './functions/api/contact.js';
import * as messages from './functions/api/messages.js';
import * as track from './functions/api/track.js';
import * as stats from './functions/api/stats.js';
import * as settings from './functions/api/settings.js';
import * as img from './functions/api/img/[id].js';
import * as edit from './functions/edit/[token].js';

const routes = [
  [/^\/api\/content$/, content], [/^\/api\/auth$/, auth], [/^\/api\/save$/, save],
  [/^\/api\/upload$/, upload], [/^\/api\/contact$/, contact], [/^\/api\/messages$/, messages],
  [/^\/api\/track$/, track], [/^\/api\/stats$/, stats], [/^\/api\/settings$/, settings],
  [/^\/api\/img\/([^/]+)$/, img, 'id'], [/^\/edit\/([^/]+)$/, edit, 'token']
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    for (const [re, mod, name] of routes) {
      const m = url.pathname.match(re);
      if (!m) continue;
      const method = request.method[0] + request.method.slice(1).toLowerCase();
      const handler = mod['onRequest' + method] || mod.onRequest;
      if (!handler) return new Response('Method not allowed', { status: 405 });
      return handler({ request, env, params: name ? { [name]: decodeURIComponent(m[1]) } : {}, waitUntil: p => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  }
};
