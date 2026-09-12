import { expect } from 'vitest';

/** Every Worker response, including denials and redirects, carries the private headers. */
export function expectPrivate(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
}
