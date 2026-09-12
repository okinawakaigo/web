import { createHash, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface BasicAuthEnv {
  BASIC_AUTH_USERNAME?: string;
  BASIC_AUTH_PASSWORD?: string;
}

export function hasBasicAuthCredentials(env: BasicAuthEnv): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/.test(env.BASIC_AUTH_USERNAME ?? '')
    && typeof env.BASIC_AUTH_PASSWORD === 'string'
    && env.BASIC_AUTH_PASSWORD.length >= 16
    && env.BASIC_AUTH_PASSWORD.length <= 256
    && !/[\x00-\x1f\x7f]/.test(env.BASIC_AUTH_PASSWORD); // eslint-disable-line no-control-regex -- パスワード中の制御文字を意図的に拒否する。
}

/** Missing secrets fail closed, including in local Worker previews. */
export function requireBasicAuth(request: Request, env: BasicAuthEnv, realm = 'Recruit preview'): Response | null {
  if (!hasBasicAuthCredentials(env)) return new Response('Service unavailable', { status: 503 });

  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.length <= 2048 && /^Basic +([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (match) {
    const supplied = createHash('sha256').update(Buffer.from(match[1], 'base64')).digest();
    const expected = createHash('sha256').update(`${env.BASIC_AUTH_USERNAME}:${env.BASIC_AUTH_PASSWORD}`).digest();
    // Hash to a fixed length before comparing; neither ID nor password short-circuits.
    if (timingSafeEqual(supplied, expected)) return null;
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"` },
  });
}
