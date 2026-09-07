import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://recruit.okinawakaigo.com',
  output: 'static',
  trailingSlash: 'always',
});
