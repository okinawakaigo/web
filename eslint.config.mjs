import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const drizzleOutsideDb = { group: ['drizzle-orm', 'drizzle-orm/*'], message: 'Drizzleのクエリは apps/api/src/db/ にまとめてください。' };
const adminOnly = {
  group: ['*/consultations', '**/db/consultations'],
  message: '管理用の相談処理は管理Worker専用です。採用サイト側は intake.ts と db/intake.ts の受付処理だけを使ってください。',
};
// Everything else under apps/api/src is reachable from the recruit Worker and must stay write-only.
const adminModules = ['apps/api/src/consultations.ts', 'apps/api/src/dashboard-worker.ts', 'apps/api/src/local-worker.ts', 'apps/api/src/db/consultations.ts'];

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.astro/**', '**/.wrangler/**', '**/.deploy-*/**', 'archive/**', 'coverage/**', 'artifacts/**'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/dashboard/src/**/*.{ts,tsx}', 'packages/ui/src/react/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'error',
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/db/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [drizzleOutsideDb] }],
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='prepare']",
        message: 'D1へのSQL直書きは避け、apps/api/src/db/ のDrizzle処理を呼び出してください。',
      }],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/db/**', ...adminModules],
    rules: { 'no-restricted-imports': ['error', { patterns: [drizzleOutsideDb, adminOnly] }] },
  },
  {
    files: ['apps/api/src/db/**/*.ts'],
    ignores: adminModules,
    rules: { 'no-restricted-imports': ['error', { patterns: [adminOnly] }] },
  },
);
