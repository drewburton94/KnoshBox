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

## Editor tabs
- **Website**: edit text, hero video, photos (live preview; nothing changes until Save).
- **Messages**: contact-form messages saved by the site.
- **Analytics**: visits, visitors, messages, video plays, phone taps, "Contact us" clicks, sources, phone vs computer.
  Anonymous, no cookies, stored as one small KV record per day. Your own browser and the editor preview are not counted.
  KV's free plan allows ~1,000 writes/day (each visit is one write), which is plenty for a small shop; tracking fails silently beyond that and never breaks the site.
- **Settings**: change the editing password (stored salted + hashed in KV, replaces `EDIT_PASSWORD`).
  Forgot it? Delete the KV entry `cfg:auth` and `EDIT_PASSWORD` works again.

## Hero video
Visitors see a poster with our own play button and controls. The YouTube player itself is fully covered, so the title,
channel name and YouTube links can't be clicked. Clicking the video toggles play/pause. The player is built in the background shortly after the page loads so playback starts instantly, and the controls only appear while the mouse is over the video.

## Email each message to Gmail (optional but recommended)
Messages are always saved (editor > Messages). To also get them by email:
1. Make a free account at https://resend.com using the Gmail address that should receive them.
2. Resend > API Keys > Create API Key (permission: sending). Copy it.
3. In Cloudflare Pages > Settings > Variables and Secrets add:
   - `RESEND_API_KEY` (secret): the key
   - `NOTIFY_EMAIL`: that Gmail address (several allowed, comma-separated)
4. Redeploy. Emails arrive from "Knosh Box Website" and Reply goes straight to the customer.
Without a verified domain, Resend only delivers to the address the account was created with.
To send from your own domain or to other addresses, verify knoshbox.com in Resend and set
`MAIL_FROM` (e.g. `Knosh Box <website@knoshbox.com>`).

## Stop form spam (Cloudflare Turnstile, free)
Built-in protection is always on: a hidden trap field, a minimum fill time, a link limit, and 5 messages/hour per visitor.
For real bot blocking, add Turnstile:
1. Cloudflare dashboard > Turnstile > Add widget. Name it, add hostnames `knoshbox.com`, `www.knoshbox.com` (and the `*.workers.dev` address if you want to test there), mode **Managed**.
2. Copy the **Site key** and **Secret key**.
3. Worker > Settings > Variables and Secrets: add `TURNSTILE_SITE_KEY` (text) and `TURNSTILE_SECRET` (secret). Redeploy.
The check stays invisible unless a visitor looks suspicious. Editor > Settings > Status shows whether it's on.

## Run locally
`npm run dev` then open http://localhost:8788 (editor: `/edit/dev-token`, password `dev-password`).
Local edits are stored in `.dev-kv.json` (git-ignored).

## Still to do before launch
- Save `public/assets/knosh-box-logo.png` and `public/assets/knosh-box-building.jpg`
  (or upload both through the editor after deploy).
- Set the hero video in the editor (or `heroVideo` in `public/js/config.js`).
- Contact form messages are saved to the site's own storage and read in the editor (Messages tab). Optional: point `formEndpoint` in `public/js/config.js` at an outside service instead.
- Confirm with the owner: reply-time promise, materials list, "Other" industries.
