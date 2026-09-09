import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminQuickAddPage } from './admin-quick-add-page';
import { provideAppConfig } from '@core/config/app-config';

describe('AdminQuickAddPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminQuickAddPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminQuickAddPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminQuickAddPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('işletme adı boşken göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('İşletme adı gerekli');
    http.expectNone((r) => r.url.includes('/rpc/admin_quick_add_business'));
  });

  it('geçersiz telefonla göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#qa-name') as HTMLInputElement;
    nameInput.value = 'Hızlı Taksi';
    nameInput.dispatchEvent(new Event('input'));
    const phoneInput = el.querySelector('#qa-phone') as HTMLInputElement;
    phoneInput.value = '123';
    phoneInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Geçerli bir telefon numarası girin');
    http.expectNone((r) => r.url.includes('/rpc/admin_quick_add_business'));
  });

  it('geçerli bilgilerle gönderim başarılıysa RPC çağrılır, sonuç ve İşletmeyi Gör linki gösterilir', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#qa-name') as HTMLInputElement;
    nameInput.value = 'Hızlı Taksi';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/admin_quick_add_business'));
    expect(req.request.body).toEqual({ p_business_name: 'Hızlı Taksi' });
    req.flush([{ id: 'biz-1', slug: 'hizli-taksi' }]);
    await tick();

    expect(el.textContent).toContain('eklendi ve yayında');
    expect(el.querySelector('a[href="/admin/isletmeler/biz-1"]')).not.toBeNull();
  });

  it('RPC hata dönerse dürüst bir hata mesajı gösterir', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#qa-name') as HTMLInputElement;
    nameInput.value = 'Hızlı Taksi';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    http
      .expectOne((r) => r.url.includes('/rpc/admin_quick_add_business'))
      .flush({ message: 'not admin' }, { status: 403, statusText: 'Forbidden' });
    await tick();

    expect(el.textContent).toContain('Eklenemedi');
  });

  it('"Yeni Ekle" tıklanınca forma geri döner', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#qa-name') as HTMLInputElement;
    nameInput.value = 'Hızlı Taksi';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    http.expectOne((r) => r.url.includes('/rpc/admin_quick_add_business')).flush([{ id: 'biz-1', slug: 'hizli-taksi' }]);
    await tick();

    (el.querySelector('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('#qa-name')).not.toBeNull();
    expect((el.querySelector('#qa-name') as HTMLInputElement).value).toBe('');
  });
});
