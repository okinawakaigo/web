/** Apply to assets, API responses, redirects and authentication errors alike. */
export function privateHeaders(url: URL): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  };
  if (url.protocol === 'https:') headers['Strict-Transport-Security'] = 'max-age=31536000';
  return headers;
}

export function privateResponse(response: Response, url: URL): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(privateHeaders(url))) result.headers.set(name, value);
  return result;
}
