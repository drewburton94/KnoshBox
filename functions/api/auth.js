import { json, requireEditor } from '../_lib/util.js';

// Lets the editor page check the link + password before showing the form.
export async function onRequestPost({ request, env }) {
  return (await requireEditor(request, env)) || json({ ok: true });
}
