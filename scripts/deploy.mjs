import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hasBasicAuthCredentials } from '../apps/api/src/basic-auth.ts';
import './check-public-assets.mjs';

const env = process.env;
const apiDirectory = fileURLToPath(new URL('../apps/api/', import.meta.url));
const enabled = env.PUBLIC_CONSULTATION_ENABLED ?? 'false';
if (!['true', 'false'].includes(enabled)) throw new Error('PUBLIC_CONSULTATION_ENABLED must be true or false.');
if (!env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required.');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.D1_DATABASE_ID ?? '')
  || env.D1_DATABASE_ID === '00000000-0000-0000-0000-000000000000') throw new Error('Set the real D1_DATABASE_ID before deployment.');
const previewSecrets = { BASIC_AUTH_USERNAME: env.BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD: env.BASIC_AUTH_PASSWORD };
const adminSecrets = { ADMIN_USERNAME: env.ADMIN_USERNAME, ADMIN_PASSWORD: env.ADMIN_PASSWORD };
if (!hasBasicAuthCredentials(previewSecrets)
  || !hasBasicAuthCredentials({ BASIC_AUTH_USERNAME: env.ADMIN_USERNAME, BASIC_AUTH_PASSWORD: env.ADMIN_PASSWORD })) throw new Error('Valid preview and admin credentials are required. See docs/deployment.md.');
if (env.ADMIN_PASSWORD === env.BASIC_AUTH_PASSWORD) throw new Error('Use different preview and admin passwords.');
const mailNames = ['RESEND_API_KEY', 'NOTIFICATION_FROM', 'NOTIFICATION_TO'];
if (enabled === 'true' && (!env.PUBLIC_TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY || mailNames.some(key => !env[key]?.trim()))) {
  throw new Error('Enabling consultations requires Turnstile and Resend settings. See docs/deployment.md.');
}
const mailSecrets = Object.fromEntries(mailNames.map(key => [key, env[key] ?? '']));
const repliesEnabled = env.REPLY_ENABLED ?? 'false';
if (!['true', 'false'].includes(repliesEnabled)) throw new Error('REPLY_ENABLED must be true or false.');
if (repliesEnabled === 'true' && ['RESEND_API_KEY', 'REPLY_FROM', 'REPLY_TO'].some(key => !env[key]?.trim())) {
  throw new Error('Enabling dashboard replies requires RESEND_API_KEY, REPLY_FROM and REPLY_TO. See docs/deployment.md.');
}
Object.assign(previewSecrets, mailSecrets, { TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY ?? '', LOCAL_FORM_TEST: 'false' });
Object.assign(adminSecrets, mailSecrets, { REPLY_FROM: env.REPLY_FROM ?? '', REPLY_TO: env.REPLY_TO ?? '', LOCAL_MAIL_TEST: 'false' });

// Configs share the production D1 ID; committed configs remain safe for local use.
const temporary = [];
function writeTemporary(suffix, data) {
  const path = `${apiDirectory}.deploy-${randomUUID()}.${suffix}.json`;
  temporary.push(path); writeFileSync(path, JSON.stringify(data), { mode: 0o600 }); return path;
}
function configuration(file, publicSite) {
  const config = JSON.parse(readFileSync(`${apiDirectory}${file}`, 'utf8'));
  config.d1_databases[0].database_id = env.D1_DATABASE_ID;
  if (publicSite) config.vars.CONSULTATION_ENABLED = enabled;
  else config.vars.REPLY_ENABLED = repliesEnabled;
  return writeTemporary('config', config);
}
function wrangler(args) { execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: apiDirectory, stdio: 'inherit' }); }
try {
  const recruitConfig = configuration('wrangler.jsonc', true);
  const dashboardConfig = configuration('wrangler.dashboard.jsonc', false);
  const recruitSecretsFile = writeTemporary('secrets', previewSecrets);
  const adminSecretsFile = writeTemporary('secrets', adminSecrets);
  if (process.argv.includes('--validate')) {
    console.log('Deployment settings validated. No remote changes made.');
  } else {
    wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', recruitConfig]);
    wrangler(['deploy', '--config', dashboardConfig, '--secrets-file', adminSecretsFile]);
    wrangler(['deploy', '--config', recruitConfig, '--secrets-file', recruitSecretsFile]);
    execFileSync(process.execPath, [fileURLToPath(new URL('../apps/api/scripts/verify-deployment.mjs', import.meta.url))], { stdio: 'inherit' });
    execFileSync(process.execPath, [fileURLToPath(new URL('../apps/api/scripts/verify-dashboard.mjs', import.meta.url))], { stdio: 'inherit' });
  }
} finally { for (const path of temporary) rmSync(path, { force: true }); }
