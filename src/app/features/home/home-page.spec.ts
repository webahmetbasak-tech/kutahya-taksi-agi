import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';
import { provideAppConfig } from '@core/config/app-config';
import type { BusinessCard } from '@core/data/models';

const DISTRICTS = [
  { id: 'loc-2', slug: 'tavsanli', name: 'Tavşanlı' },
  { id: 'loc-1', slug: 'merkez', name: 'Kütahya Merkez' },
  { id: 'loc-3', slug: 'simav', name: 'Simav' },
];

function business(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: 'biz-1',
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
    plan: 'free',
    ...overrides,
  };
}

describe('HomePage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<HomePage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HomePage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('Kütahya Merkez listenin başına alınır, vurgulu gösterilir ve varsayılan filtre olur', async () => {
    const fixture = await setup();
    // businesses isteği `districts` çözülene kadar ERTELENİR — ilk anda yalnızca
    // locations/services istekleri atılır.
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush(DISTRICTS);
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const chips = Array.from(el.querySelectorAll('.chip-row')[0]?.querySelectorAll('.chip') ?? []);
    expect(chips[0]?.textContent?.trim()).toBe('Kütahya Merkez');
    expect(chips[0]?.classList.contains('chip--active')).toBe(true);
    expect(chips[1]?.classList.contains('chip--active')).toBe(false);

    const req = http.expectOne((r) => r.url.includes('/rest/v1/business_locations'));
    expect(req.request.params.get('location_id')).toBe('eq.loc-1');
    req.flush([{ business: business() }]);
    await tick();

    expect(el.textContent).toContain('Kütahya Merkez Taksi İşletmeleri');
    expect(el.textContent).toContain('Zümrüt Taksi');
  });

  it('başka bir bölge çipine tıklanınca liste ve başlık o bölgeye göre değişir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush(DISTRICTS);
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/business_locations')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const chips = Array.from(
      el.querySelectorAll('.chip-row')[0]?.querySelectorAll('.chip') ?? [],
    ) as HTMLButtonElement[];
    const tavsanliChip = chips.find((c) => c.textContent?.trim() === 'Tavşanlı');
    if (!tavsanliChip) throw new Error('Tavşanlı çipi bulunamadı');
    tavsanliChip.click();
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/business_locations'));
    expect(req.request.params.get('location_id')).toBe('eq.loc-2');
    req.flush([{ business: business({ id: 'biz-2', slug: 'tavsanli-taksi', business_name: 'Tavşanlı Taksi' }) }]);
    await tick();

    expect(el.textContent).toContain('Tavşanlı Taksi İşletmeleri');
    expect(el.textContent).toContain('Tavşanlı Taksi');
    expect(tavsanliChip.classList.contains('chip--active')).toBe(true);
  });
});
