/** Apply to assets, API responses, redirects and authentication errors alike. */
export function privateResponse(response: Response, url: URL): Response {
  const result = new Response(response.body, response);
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://docs.google.com",
  };
  for (const [name, value] of Object.entries(headers)) result.headers.set(name, value);
  if (url.protocol === 'https:') result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return result;
}
