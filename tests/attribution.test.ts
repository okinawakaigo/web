import { describe, expect, it } from 'vitest';
import { readAttribution } from '../packages/content/src/attribution';

describe('流入元の引き継ぎ', () => {
  it('定義済み媒体だけを引き継ぐ', () => {
    expect(readAttribution(new URLSearchParams('utm_source=instagram&utm_medium=bio'))).toEqual({ source: 'instagram', medium: 'bio' });
  });
  it.each(['', 'utm_source=person@example.com&utm_medium=bio', 'utm_source=__proto__'])('未定義値を保存しない: %s', query => {
    expect(readAttribution(new URLSearchParams(query))).toEqual({ source: 'direct', medium: 'none' });
  });
  it('媒体と一致しない掲載場所・自由記入値は引き継がない', () => {
    expect(readAttribution(new URLSearchParams('utm_source=indeed&utm_medium=bio&utm_campaign=private'))).toEqual({ source: 'indeed', medium: 'none' });
  });
});
