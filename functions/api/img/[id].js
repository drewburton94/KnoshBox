// Public: serves an uploaded image. Ids are random and never reused, so responses are immutable.
export async function onRequestGet({ params, env }) {
  const id = String(params.id || '');
  if (!/^[a-f0-9]{32}$/.test(id) || !env.KNOSH) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.KNOSH.getWithMetadata('img:' + id, { type: 'arrayBuffer' });
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
