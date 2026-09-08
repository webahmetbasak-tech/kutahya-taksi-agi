import { translateAuthError } from './auth-errors';
import type { AuthError } from '@supabase/supabase-js';

function error(code: string): AuthError {
  return { code, message: 'irrelevant', name: 'AuthApiError', status: 400 } as AuthError;
}

describe('translateAuthError', () => {
  it('bilinen kodları Türkçeye çevirir', () => {
    expect(translateAuthError(error('invalid_credentials'))).toBe('E-posta veya şifre hatalı.');
    expect(translateAuthError(error('user_already_exists'))).toBe(
      'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.',
    );
    expect(translateAuthError(error('email_not_confirmed'))).toContain('onaylamadınız');
  });

  it('bilinmeyen bir kod için jenerik Türkçe mesaj döner (ham İngilizce metin sızmaz)', () => {
    const message = translateAuthError(error('some_future_error_code'));
    expect(message).toBe('Bir hata oluştu. Lütfen tekrar deneyin.');
  });
});
