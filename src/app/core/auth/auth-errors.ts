import type { AuthError } from '@supabase/supabase-js';

/**
 * Supabase Auth hatalarının makine-okunur `code` alanına göre Türkçe çeviri
 * (bkz. `@supabase/auth-js`'in `ErrorCode` union'ı). Mesaj metnine göre eşleme
 * YAPILMAZ — İngilizce metin sürüm sürüm değişebilir, `code` sabit sözleşmedir.
 *
 * Kapsanmayan bir kod için jenerik ama dürüst bir mesaj döner — asla ham
 * İngilizce metni Türkçe arayüze karıştırmaz.
 */
export function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
    case 'weak_password':
      return 'Şifre çok zayıf. En az 6 karakter kullanın.';
    case 'email_address_invalid':
      return 'Geçerli bir e-posta adresi girin.';
    case 'invalid_credentials':
      return 'E-posta veya şifre hatalı.';
    case 'email_not_confirmed':
      return 'E-posta adresinizi henüz onaylamadınız. Gelen kutunuzu kontrol edin.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Yeni kayıt şu anda kapalı.';
    default:
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}
