# Knosh Box website

Static single-page site (no build step): `index.html`, `css/styles.css`, `js/`.
Built from the Claude Design handoff (`Knosh Box D - Formed`).

## Before launch
1. **Images** — save into `assets/`:
   - `knosh-box-logo.png` (header logo)
   - `knosh-box-building.jpg` (About photo, ~1500px wide)
   (Originals are on the Squarespace CDN; URLs are in the design handoff.)
2. **`js/config.js`**
   - `heroVideo`: YouTube link or ID for the hero.
   - `formEndpoint`: JSON POST endpoint (Formspree, Resend function, etc.). Until set, the form shows a "please call us" message.
3. Confirm with the owner: reply-time promise, materials list, "Other" industries.

## Run locally
`python3 -m http.server 8000` then open http://localhost:8000
Deploys as-is to Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.
