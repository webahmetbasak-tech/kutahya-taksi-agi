import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminBusinessDetailPage } from './admin-business-detail-page';
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

describe('AdminBusinessDetailPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminBusinessDetailPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup(id = 'biz-1') {
    await TestBed.configureTestingModule({
      imports: [AdminBusinessDetailPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminBusinessDetailPage);
    fixture.componentRef.setInput('id', id);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  /** İşletme detayı artık lokasyon/hizmet listelerini ve mevcut etiketleri de çeker. */
  function flushTagRequests(opts?: {
    locations?: unknown[];
    services?: unknown[];
    businessLocations?: unknown[];
    businessServices?: unknown[];
  }) {
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush(opts?.locations ?? []);
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush(opts?.services ?? []);
    http.expectOne((r) => r.url.includes('/rest/v1/business_locations')).flush(opts?.businessLocations ?? []);
    http.expectOne((r) => r.url.includes('/rest/v1/business_services')).flush(opts?.businessServices ?? []);
  }

  it('işletme bulunamazsa mesaj gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    flushTagRequests();
    await tick();

    expect(fixture.nativeElement.textContent).toContain('İşletme bulunamadı');
  });

  it('pending işletmede Onayla ve Reddet butonlarını gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Onayla ve Yayınla');
    expect(buttons).toContain('Reddet');
  });

  it('Onayla ve Yayınla tıklanınca status=active PATCH edilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const approveBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Onayla ve Yayınla',
    ) as HTMLButtonElement;
    approveBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ status: 'active' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([{ ...BUSINESS_ROW, status: 'active' }]);
    await tick();

    expect(el.textContent).toContain('Askıya Al');
  });

  it('olası kopya işaretliyken banner + işareti kaldır butonu gösterir', async () => {
    const fixture = await setup();
    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([{ ...BUSINESS_ROW, possible_duplicate_of: 'biz-2' }]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Olası kopya işareti var');

    const dismissBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kopya değil'),
    ) as HTMLButtonElement;
    dismissBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ possible_duplicate_of: null });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
  });

  it('işletme adı boşken kaydetmeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const nameInput = el.querySelector('#edit-name') as HTMLInputElement;
    nameInput.value = '';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('İşletme adı gerekli');
    http.expectNone((r) => r.method === 'PATCH');
  });

  it('formu kaydedince plan dahil tüm alanlar PATCH edilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const planSelect = el.querySelector('#edit-plan') as HTMLSelectElement;
    planSelect.value = 'pro';
    planSelect.dispatchEvent(new Event('input'));
    planSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses') && r.method === 'PATCH');
    expect(req.request.body).toMatchObject({
      business_name: 'Zümrüt Taksi',
      phone_e164: '+905551112233',
      plan: 'pro',
      verification_status: 'unverified',
    });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush(BUSINESS_ROW ? [BUSINESS_ROW] : []);
    await tick();

    expect(el.textContent).toContain('Kaydedildi.');
  });

  it('mevcut bölge/hizmet etiketleri işaretli gelir; yeni bölge seçip kaydedince DELETE+POST gönderir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests({
      locations: [
        { id: 'loc-1', slug: 'merkez', name: 'Merkez', type: 'district' },
        { id: 'loc-2', slug: 'tavsanli', name: 'Tavşanlı', type: 'district' },
      ],
      services: [{ id: 'svc-1', slug: '724-taksi', name: '7/24 Taksi' }],
      businessLocations: [{ location_id: 'loc-1' }],
    });
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const lists = el.querySelectorAll('.checkbox-list');
    const locationChecks = Array.from(
      (lists[0] as HTMLElement).querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    const [locOne, locTwo] = locationChecks;
    if (!locOne || !locTwo) throw new Error('beklenen checkbox sayısı bulunamadı');
    expect(locOne.checked).toBe(true); // loc-1 zaten etiketli
    expect(locTwo.checked).toBe(false);

    locTwo.click();
    fixture.detectChanges();

    const saveBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Bölgeleri Kaydet',
    ) as HTMLButtonElement;
    saveBtn.click();

    const del = http.expectOne(
      (r) => r.url.includes('/rest/v1/business_locations') && r.method === 'DELETE',
    );
    expect(del.request.params.get('business_id')).toBe('eq.biz-1');
    del.flush(null);

    const post = http.expectOne(
      (r) => r.url.includes('/rest/v1/business_locations') && r.method === 'POST',
    );
    expect(post.request.body).toEqual([
      { business_id: 'biz-1', location_id: 'loc-1' },
      { business_id: 'biz-1', location_id: 'loc-2' },
    ]);
    post.flush(null);
    await tick();

    expect(el.textContent).toContain('Kaydedildi.');
  });

  it('İlçe/Mahalle ve Önemli Noktalar ayrı listelerde gösterilir (§21/§22 karmaşıklık düzeltmesi)', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests({
      locations: [
        { id: 'loc-1', slug: 'merkez', name: 'Merkez', type: 'district' },
        { id: 'loc-2', slug: 'dpu', name: 'Dumlupınar Üniversitesi', type: 'university' },
      ],
    });
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const lists = el.querySelectorAll('.checkbox-list');
    expect((lists[0] as HTMLElement).textContent).toContain('Merkez');
    expect((lists[0] as HTMLElement).textContent).not.toContain('Dumlupınar');
    expect((lists[1] as HTMLElement).textContent).toContain('Dumlupınar Üniversitesi');
    expect((lists[1] as HTMLElement).textContent).not.toContain('Merkez');
  });

  it('enlem yalnızca girilip boylam boş bırakılırsa kaydetmez, hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    flushTagRequests();
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const latInput = el.querySelector('#edit-lat') as HTMLInputElement;
    latInput.value = '39.5';
    latInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Enlem ve boylam birlikte girilmeli');
    http.expectNone((r) => r.method === 'PATCH');
  });
});
