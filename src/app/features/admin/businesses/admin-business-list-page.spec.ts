import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminBusinessListPage } from './admin-business-list-page';
import { provideAppConfig } from '@core/config/app-config';

const BUSINESS_ROW = {
  id: 'biz-1',
  slug: 'zumrut-taksi',
  business_name: 'Zümrüt Taksi',
  status: 'pending',
  verification_status: 'unverified',
  plan: 'free',
  phone_e164: '+905551112233',
  phone_display: null,
  whatsapp_e164: null,
  district: 'Merkez',
  neighborhood: null,
  city: 'Kütahya',
  address: null,
  website: null,
  description: null,
  owner_id: 'user-1',
  possible_duplicate_of: null,
  source_type: 'owner_submitted',
  category_id: 'cat-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  last_verified_at: null,
};

describe('AdminBusinessListPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminBusinessListPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup(durum?: string) {
    await TestBed.configureTestingModule({
      imports: [AdminBusinessListPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminBusinessListPage);
    if (durum !== undefined) {
      fixture.componentRef.setInput('durum', durum);
    }
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('işletme yoksa "Bu durumda işletme yok." gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await tick();

    expect(fixture.nativeElement.textContent).toContain('Bu durumda işletme yok.');
  });

  it('işletmeleri listeler, olası kopya rozetini gösterir', async () => {
    const fixture = await setup();
    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([{ ...BUSINESS_ROW, possible_duplicate_of: 'biz-2' }]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Zümrüt Taksi');
    expect(el.textContent).toContain('İnceleniyor');
    expect(el.textContent).toContain('Olası kopya');
  });

  it('durum query param filtresiyle doğru istek atar', async () => {
    await setup('active');
    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses'));
    expect(req.request.params.get('status')).toBe('eq.active');
    req.flush([]);
    await tick();
  });

  it('işletme satırı detay sayfasına link verir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    const link = fixture.nativeElement.querySelector('a.business-item__link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/isletmeler/biz-1');
  });
});
