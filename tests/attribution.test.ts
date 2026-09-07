import { describe, expect, it } from 'vitest';
import { buildReservationUrl, readAttribution, reservationIsConfigured, type ReservationConfig } from '../packages/content/src/attribution';

const config: ReservationConfig = {
  url: 'https://docs.google.com/forms/d/e/example/viewform',
  fields: { source: 'entry.1', medium: 'entry.2', role: 'entry.3', step: 'entry.4' },
};

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

describe('Googleフォーム', () => {
  it('職種・次のステップ・許可済み流入元をentry IDにエンコードする', () => {
    const result = new URL(buildReservationUrl({ ...config, url: config.url + '?unwanted=private#fragment' }, { source: 'instagram', medium: 'bio' }, 'ケアマネジャー', '職場を見学したい')!);
    expect(Object.fromEntries(result.searchParams)).toEqual({ usp: 'pp_url', 'entry.1': 'instagram', 'entry.2': 'bio', 'entry.3': 'ケアマネジャー', 'entry.4': '職場を見学したい' });
    expect(result.hash).toBe('');
  });
  it.each(['', 'javascript:alert(1)', 'https://docs.google.com.evil.example/forms/d/e/example/viewform', 'https://forms.gle/example', 'http://docs.google.com/forms/d/e/example/viewform'])('不正な送信先を無効にする: %s', url => {
    expect(buildReservationUrl({ ...config, url }, { source: 'direct', medium: 'none' }, 'その他', '見学')).toBeNull();
  });
  it('未設定・重複のあるentry IDを拒否する', () => {
    expect(reservationIsConfigured({ ...config, fields: { ...config.fields, source: '' } })).toBe(false);
    expect(reservationIsConfigured({ ...config, fields: { ...config.fields, source: 'entry.2' } })).toBe(false);
  });
});
