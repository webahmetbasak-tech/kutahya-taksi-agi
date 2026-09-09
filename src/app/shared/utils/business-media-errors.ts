import { HttpErrorResponse } from '@angular/common/http';

/**
 * `business_media_enforce_limit` trigger'ının (Faz 10, §58) hatasını
 * dürüst bir mesaja çevirir — jenerik "kaydedilemedi" yerine kullanıcı NEDEN
 * olduğunu bilsin. PostgREST CHECK ihlallerini `23514` koduyla döner.
 */
export function photoErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.error?.code === '23514') {
    return 'Ücretsiz planda en fazla 3 fotoğraf eklenebilir. Daha fazlası için planınızı yükseltin.';
  }
  return 'Fotoğraf kaydedilemedi. Lütfen tekrar deneyin.';
}
