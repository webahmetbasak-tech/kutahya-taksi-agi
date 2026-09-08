import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * JSON-LD `<script>` enjeksiyonu.
 *
 * `textContent` kullanılır, `innerHTML` DEĞİL — JSON.stringify çıktısı script
 * içeriğine metin olarak yazılır, HTML olarak parse edilmez. Bu yüzden XSS
 * riski yoktur (§33: yapılandırılmış veri güvenli şekilde yazılır).
 *
 * SPA NAVİGASYONUNDA TEMİZLİK: sunucu tarafında her istek zaten taze bir
 * `document` ile başlar, bu yüzden orada sorun yok. Ama tarayıcıda, kullanıcı
 * bir taksi detay sayfasından (LocalBusiness + BreadcrumbList yazan) ana
 * sayfaya (hiçbirini yazmayan) geçerse, eski script'ler AKTİF KALIRDI — kimse
 * onları temizlemediği sürece. Bu servis her navigasyon başında o ana kadar
 * aktif olan tüm id'leri "aday" işaretler; yeni sayfa bir id'yi tekrar
 * `set()` ederse aday listesinden çıkar, navigasyon bitince adaylıktan
 * kurtulamayanlar (yeni sayfanın hiç dokunmadığı eski script'ler) silinir.
 *
 * KALICI BLOKLAR: `Organization`/`WebSite` gibi site geneli bloklar KÖK
 * `App` bileşeninde, uygulama ömrü boyunca BİR KEZ yazılır — hiçbir sayfa
 * onları tekrar `set()` etmez. `persistent: true` olmadan bu bloklar İLK
 * navigasyonda "adaylıktan kurtulamayan eski script" sayılıp silinirdi.
 */
@Injectable({ providedIn: 'root' })
export class SchemaService {
  private readonly document = inject(DOCUMENT);
  private readonly prefix = 'ld-json-';
  private readonly activeIds = new Set<string>();
  private readonly persistentIds = new Set<string>();
  private staleCandidates = new Set<string>();

  constructor() {
    const router = inject(Router, { optional: true });
    const destroyRef = inject(DestroyRef);

    const subscription = router?.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.staleCandidates = new Set(this.activeIds);
        for (const id of this.persistentIds) {
          this.staleCandidates.delete(id);
        }
      } else if (event instanceof NavigationEnd) {
        for (const id of this.staleCandidates) {
          this.removeInternal(id);
        }
        this.staleCandidates.clear();
      }
    });

    destroyRef.onDestroy(() => subscription?.unsubscribe());
  }

  set(id: string, data: unknown, options?: { persistent?: boolean }): void {
    this.staleCandidates.delete(id);
    this.activeIds.add(id);
    if (options?.persistent) {
      this.persistentIds.add(id);
    }

    const scriptId = this.prefix + id;
    let script = this.document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      this.document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }

  remove(id: string): void {
    this.staleCandidates.delete(id);
    this.persistentIds.delete(id);
    this.removeInternal(id);
  }

  private removeInternal(id: string): void {
    this.activeIds.delete(id);
    this.document.getElementById(this.prefix + id)?.remove();
  }
}
