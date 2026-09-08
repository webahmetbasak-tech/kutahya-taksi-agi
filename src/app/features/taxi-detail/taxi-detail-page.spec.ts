import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TaxiDetailPage } from './taxi-detail-page';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';

const config: AppEnvironment = {
  environment: 'development',
  production: false,
  siteUrl: 'https://example.test',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon-test-key',
};

/**
 * Bu testlerin varlık nedeni: taxi-detail-page.ts'teki 301/410/404 mekanizması
 * (`RESPONSE_INIT.status`) yalnızca kod okuyarak doğrulanamaz — Angular'ın
 * resource + effect zamanlamasının gerçekten çalıştığını göstermek gerekir.
 * "İşletme bulunamadı → gerçek HTTP durum kodu" iddiası ARCHITECTURE.md ve
 * PROJECT_PLAN'da defalarca tekrarlanan bir söz (§64); burada kanıtlanıyor.
 */
describe('TaxiDetailPage', () => {
  let http: HttpTestingController;
  let responseInit: { status?: number; headers?: { Location?: string } };
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // `AnalyticsService.track()` gerçek `fetch` kullanır (bkz. analytics.service.ts) —
    // testlerde gerçek ağ isteği atılmasın diye stub'lanır.
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function setup(slug: string) {
    responseInit = {};

    await TestBed.configureTestingModule({
      imports: [TaxiDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: APP_CONFIG, useValue: config },
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(TaxiDetailPage);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    currentFixture = fixture;
    return fixture;
  }

  afterEach(() => http.verify());

  /**
   * `business` sonuçlanınca `hours`/`resolution` kaynakları ONA BAĞLI bir
   * `computed()` üzerinden tetiklenir. Bu zincir (sinyal güncellemesi ->
   * computed yeniden hesaplama -> resource'un kendi effect'i -> HTTP isteği)
   * birden fazla mikro görev/CD turu gerektiriyor; tek bir `whenStable()` bu
   * durumda YARDIMCI OLMAZ çünkü henüz var olmayan bir isteği "bekler" ve
   * zaman aşımına uğrar. Bu yüzden birkaç `detectChanges()` + görev kuyruğu
   * turu art arda uygulanıyor — ikinci isteğin gerçekten sıraya girdiğinden
   * emin olana kadar.
   */
  let currentFixture: ReturnType<typeof TestBed.createComponent<TaxiDetailPage>>;
  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  it('işletme bulunamazsa VE slug geçmişte de yoksa RESPONSE_INIT.status = 404 olur', async () => {
    const fixture = await setup('olmayan-slug');

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await tick();
    http
      .expectOne((r) => r.url.includes('/rpc/resolve_missing_business_slug'))
      .flush({ outcome: 'not_found', new_slug: null });

    await fixture.whenStable();

    expect(responseInit.status).toBe(404);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'İşletme profili bulunamadı',
    );
  });

  it('slug taşınmışsa (business_slug_history eşleşirse) 301 + Location header döner', async () => {
    const fixture = await setup('eski-slug');

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await tick();
    http
      .expectOne((r) => r.url.includes('/rpc/resolve_missing_business_slug'))
      .flush({ outcome: 'redirect', new_slug: 'yeni-slug' });

    await fixture.whenStable();

    expect(responseInit.status).toBe(301);
    expect(responseInit.headers?.Location).toBe('/taksi/yeni-slug');
  });

  it('işletme kalıcı olarak kaldırılmışsa 410 döner ve dedike bir mesaj gösterir', async () => {
    const fixture = await setup('kapatilan-isletme');

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await tick();
    http
      .expectOne((r) => r.url.includes('/rpc/resolve_missing_business_slug'))
      .flush({ outcome: 'archived', new_slug: null });

    await fixture.whenStable();

    expect(responseInit.status).toBe(410);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bu işletme kapatıldı');
  });

  it('işletme bulunursa RESPONSE_INIT.status DOKUNULMAZ ve içerik render edilir', async () => {
    const fixture = await setup('zumrut-taksi');

    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([
        {
          id: '1',
          slug: 'zumrut-taksi',
          business_name: 'Zümrüt Taksi',
          phone_e164: '+905551112233',
          phone_display: null,
          whatsapp_e164: null,
          district: 'Merkez',
          neighborhood: null,
          verification_status: 'unverified',
          last_verified_at: null,
          google_maps_url: null,
          description: null,
          address: null,
          city: 'Kütahya',
          latitude: null,
          longitude: null,
          website: null,
          source_type: 'manual',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/business_hours')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_services')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_locations')).flush([]);

    await fixture.whenStable();

    expect(responseInit.status).toBeUndefined();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Zümrüt Taksi');
    expect(text).not.toContain('İşletme profili bulunamadı');
  });

  it('işletme çözüldüğünde profile_view TAM OLARAK BİR KEZ takip edilir (§Faz 6)', async () => {
    await setup('zumrut-taksi');

    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([
        {
          id: '1',
          slug: 'zumrut-taksi',
          business_name: 'Zümrüt Taksi',
          phone_e164: '+905551112233',
          phone_display: null,
          whatsapp_e164: null,
          district: 'Merkez',
          neighborhood: null,
          verification_status: 'unverified',
          last_verified_at: null,
          google_maps_url: null,
          description: null,
          address: null,
          city: 'Kütahya',
          latitude: null,
          longitude: null,
          website: null,
          source_type: 'manual',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/business_hours')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_services')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_locations')).flush([]);

    await currentFixture.whenStable();

    const profileViewCalls = fetchSpy.mock.calls.filter((call) => {
      const body = JSON.parse((call[1] as RequestInit).body as string);
      return body.event_type === 'profile_view';
    });
    expect(profileViewCalls).toHaveLength(1);
    const [call] = profileViewCalls;
    expect(JSON.parse((call![1] as RequestInit).body as string).business_id).toBe('1');
  });

  it('bulunan işletme için LocalBusiness JSON-LD yazar, telefon yoksa telephone alanı hiç görünmez', async () => {
    const fixture = await setup('has-taksi');

    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([
        {
          id: '2',
          slug: 'has-taksi',
          business_name: 'Has Taksi',
          phone_e164: null,
          phone_display: null,
          whatsapp_e164: null,
          district: 'Merkez',
          neighborhood: null,
          verification_status: 'unverified',
          last_verified_at: null,
          google_maps_url: null,
          description: null,
          address: null,
          city: 'Kütahya',
          latitude: null,
          longitude: null,
          website: null,
          source_type: 'manual',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/business_hours')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_services')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/business_locations')).flush([]);

    await fixture.whenStable();

    const script = document.getElementById('ld-json-business');
    expect(script).not.toBeNull();
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data.name).toBe('Has Taksi');
    expect('telephone' in data).toBe(false);
  });

  it('işletmenin hizmet ve bölge ilişkilerine GERİ link verir (§42 entity ilişkileri)', async () => {
    const fixture = await setup('nur-taksi');

    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([
        {
          id: '3',
          slug: 'nur-taksi',
          business_name: 'Nur Taksi',
          phone_e164: null,
          phone_display: null,
          whatsapp_e164: null,
          district: 'Merkez',
          neighborhood: null,
          verification_status: 'unverified',
          last_verified_at: null,
          google_maps_url: null,
          description: null,
          address: null,
          city: 'Kütahya',
          latitude: null,
          longitude: null,
          website: null,
          source_type: 'manual',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/business_hours')).flush([]);
    http
      .expectOne((r) => r.url.includes('/rest/v1/business_services'))
      .flush([{ service: { id: 's1', slug: '724-taksi', name: '7/24 Taksi', description: null } }]);
    http
      .expectOne((r) => r.url.includes('/rest/v1/business_locations'))
      .flush([{ location: { id: 'l1', slug: 'merkez', name: 'Kütahya Merkez' } }]);

    await fixture.whenStable();

    const html = fixture.nativeElement as HTMLElement;
    const serviceLink = html.querySelector<HTMLAnchorElement>('a[href="/hizmet/724-taksi"]');
    const locationLink = html.querySelector<HTMLAnchorElement>('a[href="/bolge/merkez"]');

    expect(serviceLink?.textContent?.trim()).toBe('7/24 Taksi');
    expect(locationLink?.textContent?.trim()).toBe('Kütahya Merkez');
  });
});
