import { inject, Injectable } from '@angular/core';
import { map, of, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import {
  BUSINESS_CARD_FIELDS,
  BUSINESS_DETAIL_FIELDS,
  type BusinessCard,
  type BusinessDetail,
  type BusinessHoursRow,
  type NearbyBusinessRow,
  type OwnedBusinessRow,
  type SlugResolution,
} from './models';

const OWNED_BUSINESS_FIELDS = 'id,slug,business_name,status,verification_status,plan';

/**
 * İşletme okuma sorguları.
 *
 * NOT: `status = 'active'` filtresi burada AYRICA yazılmaz. RLS zaten yalnızca
 * aktif işletmeleri döndürür (§54); filtreyi iki yerde tutmak, ileride biri
 * değişirse sessiz tutarsızlık üretirdi. Güvenlik sınırı tek yerde: veritabanında.
 */
@Injectable({ providedIn: 'root' })
export class BusinessRepository {
  private readonly client = inject(PostgrestClient);

  /** Yayındaki işletmeler. */
  list(limit = 50): Observable<BusinessCard[]> {
    return this.client.list<BusinessCard>('businesses', {
      select: BUSINESS_CARD_FIELDS,
      order: 'business_name.asc',
      limit,
    });
  }

  /** Slug ile tek işletme; bulunamazsa `null`. */
  bySlug(slug: string): Observable<BusinessDetail | null> {
    return this.client.single<BusinessDetail>('businesses', {
      select: BUSINESS_DETAIL_FIELDS,
      slug: `eq.${slug}`,
    });
  }

  /**
   * Belirli bir bölgede hizmet veren işletmeler (§12, `business_locations`).
   *
   * `business_locations` üzerinden embed edilir; görünürlük o tablonun RLS'i
   * ile aynı kurala (bağlı işletme aktifse görünür) otomatik uyar.
   */
  byLocation(locationId: string): Observable<BusinessCard[]> {
    return this.client
      .list<{ business: BusinessCard }>('business_locations', {
        select: `business:businesses(${BUSINESS_CARD_FIELDS})`,
        location_id: `eq.${locationId}`,
      })
      .pipe(map((rows) => sortByName(rows.map((row) => row.business))));
  }

  /** Belirli bir hizmeti veren işletmeler (§10, `business_services`). */
  byService(serviceId: string): Observable<BusinessCard[]> {
    return this.client
      .list<{ business: BusinessCard }>('business_services', {
        select: `business:businesses(${BUSINESS_CARD_FIELDS})`,
        service_id: `eq.${serviceId}`,
      })
      .pipe(map((rows) => sortByName(rows.map((row) => row.business))));
  }

  /**
   * Bir landing page'in hedeflediği bölge/hizmet kombinasyonundaki işletmeler.
   *
   * `landing_pages` en az birini zorunlu kılar (`landing_pages_has_target`
   * kısıtı), ikisi de olabilir. İkisi de doluysa PostgREST'in çift `!inner`
   * embed'i ile TEK sorguda kesişim alınır — iki ayrı sorgu çekip elle kesişim
   * almaktan daha doğru (sayfalama/limit ile tutarlı kalır) ve daha hızlıdır.
   */
  forLandingPage(params: {
    locationId: string | null;
    serviceId: string | null;
  }): Observable<BusinessCard[]> {
    if (params.locationId && params.serviceId) {
      return this.client
        .list<BusinessCard>('businesses', {
          select: `${BUSINESS_CARD_FIELDS},business_locations!inner(location_id),business_services!inner(service_id)`,
          'business_locations.location_id': `eq.${params.locationId}`,
          'business_services.service_id': `eq.${params.serviceId}`,
          order: 'business_name.asc',
        })
        .pipe(map(sortByName));
    }
    if (params.locationId) {
      return this.byLocation(params.locationId);
    }
    if (params.serviceId) {
      return this.byService(params.serviceId);
    }
    return of([]);
  }

  /**
   * Konuma en yakın aktif işletmeler (§49 "Yakınımdaki Taksiler").
   *
   * `nearby_businesses` RPC'sini çağırır — PostGIS `ST_DWithin` bunu Faz 2'de
   * kurulan GIST index üzerinden çalıştırır. RLS'i bypass etmez (RPC
   * `SECURITY INVOKER`); yalnızca zaten görünür olan satırlara mesafe filtresi
   * ekler.
   */
  nearby(
    latitude: number,
    longitude: number,
    radiusMeters = 15000,
  ): Observable<NearbyBusinessRow[]> {
    return this.client.rpc<NearbyBusinessRow[]>('nearby_businesses', {
      lat: latitude,
      lon: longitude,
      radius_meters: radiusMeters,
    });
  }

  /** Doğrulanmış çalışma saatleri (§75 — yalnızca gerçek kayıt varsa döner). */
  hours(businessId: string): Observable<BusinessHoursRow[]> {
    return this.client.list<BusinessHoursRow>('business_hours', {
      select: 'day_of_week,opens_at,closes_at,is_24h,is_closed',
      business_id: `eq.${businessId}`,
      order: 'day_of_week.asc',
    });
  }

  /**
   * Bulunamayan bir slug için 301 (taşınmış) / 410 (kaldırılmış) / 404
   * (hiç var olmamış) ayrımı yapar (§64). Yalnızca `bySlug()` `null` döndükten
   * SONRA, yani nadir durumda çağrılır — normal sayfa görüntülemede ekstra
   * bir istek yapılmaz.
   */
  resolveMissingSlug(slug: string): Observable<SlugResolution> {
    return this.client.rpc<SlugResolution>('resolve_missing_business_slug', {
      target_slug: slug,
    });
  }

  /**
   * Oturum açmış kullanıcının sahip olduğu işletmeler (panel, Faz 7).
   *
   * `owner_id=eq.<uid>` filtresi burada ZORUNLUDUR: `businesses_select_own` RLS
   * politikası `businesses_select_active`yle OR'lanır, yani filtre olmadan
   * sorgu TÜM aktif public işletmeleri de döndürürdü. Filtre, o OR'lanmış
   * kümeyi yalnızca gerçekten bu kullanıcıya ait satırlara daraltır — hangi
   * durumda olursa olsun (pending/suspended dahil), çünkü sahip olma koşulu
   * zaten görünürlüğü tek başına sağlıyor.
   */
  mine(ownerId: string): Observable<OwnedBusinessRow[]> {
    return this.client.list<OwnedBusinessRow>('businesses', {
      select: OWNED_BUSINESS_FIELDS,
      owner_id: `eq.${ownerId}`,
      order: 'business_name.asc',
    });
  }
}

function sortByName<T extends { business_name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.business_name.localeCompare(b.business_name, 'tr'));
}
