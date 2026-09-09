import { inject, Injectable } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * `business-media` Storage bucket'ına fotoğraf yükleme (Faz 8, §18).
 *
 * Bucket sınırları (5 MB, image/jpeg|png|webp|avif) `20260908150500_storage.sql`
 * ile eşleşecek şekilde BURADA DA doğrulanır — kullanıcı yanlış dosyayı sunucu
 * 400 döndürene kadar beklemeden, seçer seçmez öğrenir. Sunucu her zaman son
 * sözü söyler (bucket kısıtı); bu yalnızca UX içindir.
 *
 * Yol düzeni `<business_id>/<dosya>` — `can_write_business_media()` RLS
 * fonksiyonu yalnızca işletme sahibinin kendi klasörüne yazmasına izin verir.
 */
@Injectable({ providedIn: 'root' })
export class BusinessMediaService {
  private readonly auth = inject(AuthService);

  validate(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Yalnızca JPEG, PNG, WebP veya AVIF görsel yükleyebilirsiniz.';
    }
    if (file.size > MAX_FILE_BYTES) {
      return 'Görsel 5 MB\'tan büyük olamaz.';
    }
    return null;
  }

  async upload(businessId: string, file: File): Promise<{ storagePath: string } | { error: string }> {
    const validationError = this.validate(file);
    if (validationError) {
      return { error: validationError };
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const path = `${businessId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;

    const { error } = await this.auth
      .storageClient()
      .from('business-media')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (error) {
      return { error: 'Görsel yüklenemedi. Lütfen tekrar deneyin.' };
    }
    return { storagePath: path };
  }

  /** Storage'daki dosyayı siler — `business_media` satırının silinmesiyle EŞ ZAMANLI değil, ayrı bir adım. */
  async remove(storagePath: string): Promise<{ error: string } | undefined> {
    const { error } = await this.auth.storageClient().from('business-media').remove([storagePath]);
    return error ? { error: "Görsel storage'dan silinemedi." } : undefined;
  }
}
