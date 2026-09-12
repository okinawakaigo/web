import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://recruit.okinawakaigo.com',
  output: 'static',
  trailingSlash: 'always',
  // Emit every script as a file: the Worker's CSP has no 'unsafe-inline' for script-src.
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
});
