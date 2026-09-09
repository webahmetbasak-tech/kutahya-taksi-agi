import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminClaimsPage } from './admin-claims-page';
import { provideAppConfig } from '@core/config/app-config';

const CLAIM_ROW = {
  id: 'claim-1',
  business_id: 'biz-1',
  user_id: 'user-1',
  status: 'pending',
  verification_method: 'manual_admin',
  contact_phone_e164: '+905551112233',
  note: null,
  reviewer_note: null,
  submitted_at: '2026-09-01T00:00:00Z',
  approved_at: null,
  rejected_at: null,
  reviewed_by: null,
};

describe('AdminClaimsPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminClaimsPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminClaimsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminClaimsPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('bekleyen talebi listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([CLAIM_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('+905551112233');
    expect(el.querySelector('button')?.textContent).toContain('Onayla');
  });

  it('onayla tıklanınca approve_claim RPC çağrılır ve not gönderilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([CLAIM_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const noteInput = el.querySelector('input[type="text"]') as HTMLInputElement;
    noteInput.value = 'Telefonla doğrulandı';
    noteInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const approveBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Onayla'),
    ) as HTMLButtonElement;
    approveBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rpc/approve_claim'));
    expect(req.request.body).toEqual({ p_claim_id: 'claim-1', p_note: 'Telefonla doğrulandı' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await tick();
  });

  it('reddet tıklanınca reject_claim RPC çağrılır', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([CLAIM_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const rejectBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reddet'),
    ) as HTMLButtonElement;
    rejectBtn.click();

    const req = http.expectOne((r) => r.url.includes('/rpc/reject_claim'));
    expect(req.request.body).toEqual({ p_claim_id: 'claim-1' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await tick();
  });

  it('RPC hata dönerse (ör. talep zaten işlenmiş) hata mesajı gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([CLAIM_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const approveBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Onayla'),
    ) as HTMLButtonElement;
    approveBtn.click();

    http
      .expectOne((r) => r.url.includes('/rpc/approve_claim'))
      .flush({ message: 'already processed' }, { status: 400, statusText: 'Bad Request' });
    await tick();

    expect(el.textContent).toContain('zaten işlenmiş');
  });

  it('"Tümü" sekmesine geçince (durum=undefined) liste TEKRAR YÜKLENİR, sonsuza kadar yüklenmede kalmaz', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([CLAIM_ROW]);
    await tick();

    // `withComponentInputBinding()` "Tümü" sekmesine tıklanınca `durum` query
    // param'ını URL'den kaldırır ve input'u `undefined` yapar — tam olarak bu.
    fixture.componentRef.setInput('durum', undefined);
    await tick();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/claims'));
    expect(req.request.params.has('status')).toBe(false);
    req.flush([CLAIM_ROW, { ...CLAIM_ROW, id: 'claim-2', status: 'approved' }]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.claim-item').length).toBe(2);
  });
});
