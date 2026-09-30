# Knosh Box website

Static single-page site in `public/` (no build step) plus a small Cloudflare Pages Functions
backend in `functions/` that powers a private editor for text, the hero video and photos.

```
public/            the site (index.html, css/, js/, assets/) and the editor page (editor/)
functions/api/     content, save, upload, img/[id], auth
functions/edit/    the secret link: /edit/<EDIT_TOKEN>
dev/server.mjs     local emulator of Pages + Functions + KV
```

## How editing works
Default copy lives in `public/index.html` (elements tagged `data-edit="key"`). Edits are saved
as overrides in Cloudflare KV and applied on page load from `/api/content`. Anything not
edited keeps its HTML default, and **Reset** in the editor returns a field to it.
Editable: all page text, hero video (YouTube link), header logo, About photo.
New editable text = add `data-edit="some.key" data-label="Label" data-group="Section"` to any element.

## Deploy on Cloudflare Pages
1. `npx wrangler kv namespace create KNOSH`, paste the returned `id` into `wrangler.toml`
   (or bind the namespace as `KNOSH` in the Pages dashboard: Settings > Bindings).
2. Set two secrets (dashboard: Settings > Variables and Secrets, or `npx wrangler pages secret put NAME`):
   - `EDIT_TOKEN`: the secret part of the link. Generate with `openssl rand -hex 16`.
   - `EDIT_PASSWORD`: a strong password.
3. Deploy: `npm run deploy` (or connect the repo with build output directory `public`, no build command).
4. Editor link: `https://knoshbox.com/edit/<EDIT_TOKEN>`, then enter the password.
   Both are required to save. Wrong attempts are limited to 10 per IP per 15 minutes.
   To revoke access, change either secret.

## Run locally
`npm run dev` then open http://localhost:8788 (editor: `/edit/dev-token`, password `dev-password`).
Local edits are stored in `.dev-kv.json` (git-ignored).

## Still to do before launch
- Save `public/assets/knosh-box-logo.png` and `public/assets/knosh-box-building.jpg`
  (or upload both through the editor after deploy).
- Set the hero video in the editor (or `heroVideo` in `public/js/config.js`).
- Contact form messages are saved to the site's own storage and read in the editor (Messages tab). Optional: point `formEndpoint` in `public/js/config.js` at an outside service instead.
- Confirm with the owner: reply-time promise, materials list, "Other" industries.
