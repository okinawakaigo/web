import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();
describe('書き方のルールをCIで検出する', () => {
  it.each([
    ['react-hooks/set-state-in-effect', `import { useEffect, useState } from 'react';
      export function Example({ name }: { name: string }) {
        const [value, setValue] = useState('');
        useEffect(() => { setValue(name); }, [name]);
        return <p>{value}</p>;
      }`],
    ['react-hooks/exhaustive-deps', `import { useEffect } from 'react';
      export function Example({ title }: { title: string }) {
        useEffect(() => { document.title = title; }, []);
        return null;
      }`],
    ['react-hooks/rules-of-hooks', `import { useState } from 'react';
      export function Example({ enabled }: { enabled: boolean }) {
        if (!enabled) return null;
        const [value] = useState('');
        return <p>{value}</p>;
      }`],
    ['react-hooks/refs', `import { useRef } from 'react';
      export function Example() {
        const value = useRef(0);
        return <p>{value.current}</p>;
      }`],
  ])('%s の違反を検出する', async (rule, code) => {
    const [result] = await eslint.lintText(code, { filePath: 'apps/dashboard/src/LintExample.tsx' });
    expect(result.messages.map(message => message.ruleId)).toContain(rule);
  });

  it('APIハンドラからのSQL直接実行とDrizzleの持ち込みを拒否する', async () => {
    const [result] = await eslint.lintText(`import { drizzle } from 'drizzle-orm/d1';
      export function handler(binding: D1Database) {
        binding.prepare('SELECT id FROM consultations');
        return drizzle(binding);
      }`, { filePath: 'apps/api/src/handler-example.ts' });
    expect(result.messages.map(message => message.ruleId)).toEqual(expect.arrayContaining(['no-restricted-imports', 'no-restricted-syntax']));
  });

  it('採用サイト側から管理用の相談処理をimportできない', async () => {
    const rules = async (code: string, filePath: string) => (await eslint.lintText(code, { filePath }))[0].messages.map(message => message.ruleId);
    for (const [code, filePath] of [
      [`import { adminConsultations } from './consultations'; export { adminConsultations };`, 'apps/api/src/intake-example.ts'],
      [`import { consultationRepository } from './db/consultations'; export { consultationRepository };`, 'apps/api/src/intake-example.ts'],
      [`import { consultationRepository } from './consultations'; export { consultationRepository };`, 'apps/api/src/db/intake-example.ts'],
    ]) expect(await rules(code, filePath), filePath).toContain('no-restricted-imports');
    expect(await rules(`import { intakeRepository } from './db/intake'; export { intakeRepository };`, 'apps/api/src/intake-example.ts')).toEqual([]);
    expect(await rules(`import { consultationRepository } from './db/consultations'; export { consultationRepository };`, 'apps/api/src/dashboard-worker.ts')).toEqual([]);
  });

  it('DB層のDrizzleクエリと、レンダー中の派生値の計算は許可する', async () => {
    const [database] = await eslint.lintText(`import { drizzle } from 'drizzle-orm/d1';
      import { consultations } from './schema';
      export function list(binding: D1Database) { return drizzle(binding).select().from(consultations).all(); }`,
    { filePath: 'apps/api/src/db/example.ts' });
    const [component] = await eslint.lintText(`export function Example({ first, last }: { first: string; last: string }) {
      const fullName = first + last;
      return <p>{fullName}</p>;
    }`, { filePath: 'apps/dashboard/src/LintExample.tsx' });
    expect(database.messages).toEqual([]);
    expect(component.messages).toEqual([]);
  });
});
