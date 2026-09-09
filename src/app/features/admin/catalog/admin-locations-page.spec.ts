import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminLocationsPage } from './admin-locations-page';
import { provideAppConfig } from '@core/config/app-config';

const LOCATION_ROW = {
  id: 'loc-1',
  slug: 'merkez',
  name: 'Merkez',
  type: 'district',
  parent_id: null,
  latitude: 39.4167,
  longitude: 29.9833,
  description: null,
  source_type: 'osm',
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
};

describe('AdminLocationsPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminLocationsPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminLocationsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminLocationsPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  function setInput(el: HTMLElement, id: string, value: string) {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('lokasyonları tip rozetiyle listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([LOCATION_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Merkez');
    expect(el.textContent).toContain('İlçe');
  });

  it('slug/ad boşken eklemeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await tick();

    fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Slug ve ad zorunludur.');
    http.expectNone((r) => r.method === 'POST');
  });

  it('yalnızca enlem girilip boylam boş bırakılırsa hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'loc-slug', 'yeni-mahalle');
    setInput(el, 'loc-name', 'Yeni Mahalle');
    setInput(el, 'loc-lat', '39.5');
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Enlem ve boylam birlikte girilmeli');
    http.expectNone((r) => r.method === 'POST');
  });

  it('geçerli bilgilerle yeni lokasyon ekler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'loc-slug', 'yeni-mahalle');
    setInput(el, 'loc-name', 'Yeni Mahalle');
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/locations') && r.method === 'POST');
    expect(req.request.body).toEqual({
      type: 'neighborhood',
      slug: 'yeni-mahalle',
      name: 'Yeni Mahalle',
      description: null,
      latitude: null,
      longitude: null,
      source_type: 'manual',
    });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await tick();
  });

  it('düzenle tıklanınca formu doldurur, güncelle PATCH gönderir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([LOCATION_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((el.querySelector('#loc-slug') as HTMLInputElement).value).toBe('merkez');

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/locations') && r.method === 'PATCH');
    expect(req.request.body).toMatchObject({ slug: 'merkez', name: 'Merkez', type: 'district' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await tick();
  });

  it('Pasife Al tıklanınca is_active=false PATCH edilir ve listeyi yeniler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([LOCATION_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aktif');

    const toggleBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Pasife Al',
    ) as HTMLButtonElement;
    toggleBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/locations') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ is_active: false });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([{ ...LOCATION_ROW, is_active: false }]);
    await tick();

    expect(el.textContent).toContain('Pasif');
  });
});
