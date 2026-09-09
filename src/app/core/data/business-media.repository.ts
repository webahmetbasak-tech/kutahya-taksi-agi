import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { BusinessMediaInsert, BusinessMediaRow } from './models';

const BUSINESS_MEDIA_FIELDS = 'id,storage_path,alt_text,media_type,sort_order';

/**
 * `business_media` okuma/yazma — hem public galeri gösterimi (`taxi-detail-page`,
 * Faz 10) hem sahip yönetimi (başvuru sırasında Faz 8'de, sonradan Faz 10'da)
 * BURADAN geçer. Fotoğraf sayısı sınırı (§58, free=3) istemci kodunda
 * TEKRARLANMAZ — `business_media_enforce_limit` trigger'ı tek gerçek sınır;
 * bu repository yalnızca doğru isteği gönderir, sunucunun 400'ünü sayfaya taşır.
 */
@Injectable({ providedIn: 'root' })
export class BusinessMediaRepository {
  private readonly client = inject(PostgrestClient);

  /** Yalnızca galeri fotoğrafları (`media_type='photo'`) — `logo`/`cover` hariç. */
  forBusiness(businessId: string): Observable<BusinessMediaRow[]> {
    return this.client.list<BusinessMediaRow>('business_media', {
      select: BUSINESS_MEDIA_FIELDS,
      business_id: `eq.${businessId}`,
      media_type: 'eq.photo',
      order: 'sort_order.asc',
    });
  }

  attach(row: BusinessMediaInsert): Observable<void> {
    return this.client.insert('business_media', row);
  }

  remove(mediaId: string): Observable<void> {
    return this.client.remove('business_media', { id: `eq.${mediaId}` });
  }
}
