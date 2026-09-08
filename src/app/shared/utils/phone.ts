/**
 * Telefon bağlantı yardımcıları (§47, §53).
 *
 * Girdi her zaman veritabanındaki kanonik E.164 biçimdir (`+905551112233`);
 * biçimlendirme burada YALNIZCA gösterim içindir, veriyi değiştirmez.
 */

/** `tel:` bağlantısı. Tarayıcı arama uygulamasını açar. */
export function telHref(phoneE164: string): string {
  return `tel:${phoneE164}`;
}

/**
 * `wa.me` bağlantısı (§48). Yalnızca `whatsapp_e164` doluysa çağrılmalı —
 * WhatsApp kullanmayan işletme için bu buton hiç gösterilmez.
 */
export function whatsappHref(whatsappE164: string): string {
  const digits = whatsappE164.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
}

/**
 * Kullanıcı dostu gösterim: `+905551112233` → `0555 111 22 33`.
 * Beklenmeyen bir biçimde girdiyi olduğu gibi döner — asla veri uydurmaz.
 */
export function formatPhoneDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+90/, '0').replace(/[^0-9]/g, '');
  if (digits.length !== 11) {
    return phoneE164;
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

/**
 * Türkiye telefon numarasını E.164'e çevirir — veritabanındaki
 * `normalize_tr_phone()` SQL fonksiyonuyla BİREBİR AYNI kabul edilen biçimler
 * (bkz. `20260908150300_functions_and_triggers.sql`). İki tarafın da aynı
 * mantığı ayrı ayrı yazmasının nedeni: sunucu her zaman son sözü söyler
 * (CHECK kısıtı), ama kullanıcıya "geçersiz numara" hatasını sunucudan gelen
 * kriptik bir 400 yerine, formu terk etmeden ANINDA gösterebilmek için.
 *
 * Tanınmayan biçimde `null` döner — uydurma/yanlış numara üretilmez (§53).
 */
export function normalizeTrPhone(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, '');
  const withoutIntlPrefix = digits.startsWith('00') ? digits.slice(2) : digits;

  if (withoutIntlPrefix.length === 12 && withoutIntlPrefix.startsWith('90')) {
    return `+${withoutIntlPrefix}`;
  }
  if (withoutIntlPrefix.length === 11 && withoutIntlPrefix.startsWith('0')) {
    return `+90${withoutIntlPrefix.slice(1)}`;
  }
  if (withoutIntlPrefix.length === 10 && !withoutIntlPrefix.startsWith('0')) {
    return `+90${withoutIntlPrefix}`;
  }
  return null;
}
