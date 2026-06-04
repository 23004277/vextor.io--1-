export default {
async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Only intervene for the OG image assets.
    if (!url.pathname.startsWith('/imgasset/')) {
      // If assets binding exists, defer to it; otherwise fall back to default behavior.
      if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
      return new Response('Not Found', { status: 404 });
    }

    // Fetch the actual file from the static assets binding so we don't get SPA HTML fallback.
    if (!env?.ASSETS?.fetch) {
      return new Response('Static assets binding missing', { status: 500 });
    }

    const response: Response = await env.ASSETS.fetch(request);

    // If it isn't an image, just return what we got.
    const headers = new Headers(response.headers);

    // Force correct headers for Discord's scraper.
    headers.set('Content-Type', 'image/png');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    // Some scrapers may reject if content-length changes; keep original body.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

