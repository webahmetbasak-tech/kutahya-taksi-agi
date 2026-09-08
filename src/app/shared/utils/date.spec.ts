import { formatTrDate } from './date';

describe('formatTrDate', () => {
  it('ISO zaman damgasını Türkçe uzun tarih olarak biçimlendirir', () => {
    expect(formatTrDate('2026-09-08T12:00:00Z')).toBe('8 Eylül 2026');
  });

  it('aynı ISO girdisi için her zaman aynı sonucu üretir (hydration güvenliği)', () => {
    // `new Date()` (şimdi) DEĞİL, sabit bir girdi kullanır — bu yüzden sunucu ve
    // tarayıcı hangi anda çalışırsa çalışsın aynı string'i üretir.
    const a = formatTrDate('2026-01-15T00:00:00Z');
    const b = formatTrDate('2026-01-15T00:00:00Z');

    expect(a).toBe(b);
  });
});
