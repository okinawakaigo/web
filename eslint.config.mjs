import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

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
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['drizzle-orm', 'drizzle-orm/*'], message: 'Drizzleのクエリは apps/api/src/db/ にまとめてください。' }],
      }],
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='prepare']",
        message: 'D1へのSQL直書きは避け、apps/api/src/db/ のDrizzle処理を呼び出してください。',
      }],
    },
  },
);
