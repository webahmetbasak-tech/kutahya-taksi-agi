import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminServicesPage } from './admin-services-page';
import { provideAppConfig } from '@core/config/app-config';

const SERVICE_ROW = {
  id: 'svc-1',
  slug: '724-taksi',
  name: '7/24 Taksi',
  description: null,
  sort_order: 0,
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
};

describe('AdminServicesPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminServicesPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminServicesPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminServicesPage);
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

  it('hizmetleri listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([SERVICE_ROW]);
    await tick();

    expect(fixture.nativeElement.textContent).toContain('7/24 Taksi');
  });

  it('yeni hizmet eklerken slug/ad boşsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();

    fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Slug ve ad zorunludur.');
    http.expectNone((r) => r.method === 'POST');
  });

  it('geçerli bilgilerle yeni hizmet ekler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'svc-slug', 'havalimani-transferi');
    setInput(el, 'svc-name', 'Havalimanı Transferi');
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/services') && r.method === 'POST');
    expect(req.request.body).toEqual({
      slug: 'havalimani-transferi',
      name: 'Havalimanı Transferi',
      description: null,
      sort_order: 0,
    });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();
  });

  it('düzenle tıklanınca formu doldurur, güncelle PATCH gönderir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([SERVICE_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((el.querySelector('#svc-slug') as HTMLInputElement).value).toBe('724-taksi');

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/services') && r.method === 'PATCH');
    expect(req.request.body).toMatchObject({ slug: '724-taksi', name: '7/24 Taksi' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();
  });

  it('aktif/pasif geçişi doğru PATCH gönderir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([SERVICE_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const toggleBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pasife Al'),
    ) as HTMLButtonElement;
    toggleBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/services') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ is_active: false });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([{ ...SERVICE_ROW, is_active: false }]);
    await tick();
  });
});
