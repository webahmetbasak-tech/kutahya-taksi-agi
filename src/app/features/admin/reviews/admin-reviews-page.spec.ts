import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminReviewsPage } from './admin-reviews-page';
import { provideAppConfig } from '@core/config/app-config';

const REVIEW_ROW = {
  id: 'review-1',
  business_id: 'biz-1',
  rating: 4,
  review_text: 'İyi hizmet.',
  status: 'pending',
  created_at: '2026-09-01T00:00:00Z',
  business: { business_name: 'Zümrüt Taksi', slug: 'zumrut-taksi' },
};

describe('AdminReviewsPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminReviewsPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminReviewsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminReviewsPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('bekleyen değerlendirmeyi işletme adıyla listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([REVIEW_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Zümrüt Taksi');
    expect(el.textContent).toContain('İyi hizmet.');
    expect(el.querySelector('button')?.textContent).toContain('Onayla');
  });

  it('onayla tıklanınca status=approved PATCH edilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([REVIEW_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const approveBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Onayla'),
    ) as HTMLButtonElement;
    approveBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/reviews') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ status: 'approved' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([]);
    await tick();
  });

  it('reddet tıklanınca status=rejected PATCH edilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([REVIEW_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const rejectBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reddet'),
    ) as HTMLButtonElement;
    rejectBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/reviews') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ status: 'rejected' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([]);
    await tick();
  });

  it('onaylanmış bir değerlendirmede aksiyon butonu gösterilmez', async () => {
    await setup();
    http
      .expectOne((r) => r.url.includes('/rest/v1/reviews'))
      .flush([{ ...REVIEW_ROW, status: 'approved' }]);
    await tick();

    expect(currentFixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('"Tümü" sekmesine geçince (durum=undefined) liste TEKRAR YÜKLENİR, sonsuza kadar yüklenmede kalmaz', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([REVIEW_ROW]);
    await tick();

    fixture.componentRef.setInput('durum', undefined);
    await tick();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/reviews'));
    expect(req.request.params.has('status')).toBe(false);
    req.flush([REVIEW_ROW]);
    await tick();

    expect(fixture.nativeElement.querySelectorAll('.review-item').length).toBe(1);
  });
});
