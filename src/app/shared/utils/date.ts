/**
 * Türkçe tarih gösterimi.
 *
 * Yalnızca VERİDEN gelen sabit bir zaman damgasını biçimlendirir — asla
 * `new Date()` (şimdi) kullanmaz. Bu fark önemlidir: sabit bir ISO string'i
 * biçimlendirmek sunucu ve tarayıcıda aynı sonucu verir (hydration uyuşmazlığı
 * riski yok); "şimdi"yi biçimlendirmek vermez.
 */
const formatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatTrDate(iso: string): string {
  return formatter.format(new Date(iso));
}
