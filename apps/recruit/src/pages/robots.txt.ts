import { indexable } from '../config';
import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => new Response(indexable
  ? `User-agent: *\nAllow: /\nDisallow: /design/\nSitemap: ${new URL('/sitemap.xml', site)}\n`
  : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
