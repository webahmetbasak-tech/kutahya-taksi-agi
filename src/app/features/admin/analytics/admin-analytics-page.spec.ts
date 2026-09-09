import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminAnalyticsPage } from './admin-analytics-page';
import { provideAppConfig } from '@core/config/app-config';

const BUSINESS_ROW = {
  id: 'biz-1',
  slug: 'zumrut-taksi',
  business_name: 'Zümrüt Taksi',
  status: 'active',
  verification_status: 'unverified',
  plan: 'free',
  phone_e164: null,
  phone_display: null,
  whatsapp_e164: null,
  district: null,
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

describe('AdminAnalyticsPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminAnalyticsPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminAnalyticsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminAnalyticsPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('işletme seçilmeden istatistik isteği ATILMAZ', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    expect(fixture.nativeElement.querySelector('.stats')).toBeNull();
  });

  it('işletme seçilince istatistik isteği atılır ve özet gösterilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'biz-1';
    select.dispatchEvent(new Event('change'));
    await tick();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/analytics_daily'));
    expect(req.request.params.get('business_id')).toBe('eq.biz-1');
    req.flush([
      { day: '2026-09-01', event_type: 'profile_view', event_count: 7 },
      { day: '2026-09-01', event_type: 'call_click', event_count: 2 },
    ]);
    await tick();

    const dd = Array.from(el.querySelectorAll('.stats__item dd')).map((n) => n.textContent);
    expect(dd).toContain('7');
    expect(dd).toContain('2');
  });
});
