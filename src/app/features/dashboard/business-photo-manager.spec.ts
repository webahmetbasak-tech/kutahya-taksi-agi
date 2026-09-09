import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BusinessPhotoManager } from './business-photo-manager';
import { BusinessMediaService } from '@core/storage/business-media.service';
import { provideAppConfig } from '@core/config/app-config';

describe('BusinessPhotoManager', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<BusinessPhotoManager>>;
  let mediaServiceStub: {
    validate: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup(plan: 'free' | 'pro' | 'premium' = 'free') {
    mediaServiceStub = {
      validate: vi.fn(() => null),
      upload: vi.fn(async () => ({ storagePath: 'biz-1/photo.jpg' })),
      remove: vi.fn(async () => undefined),
    };

    await TestBed.configureTestingModule({
      imports: [BusinessPhotoManager],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppConfig(),
        { provide: BusinessMediaService, useValue: mediaServiceStub },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BusinessPhotoManager);
    fixture.componentRef.setInput('businessId', 'biz-1');
    fixture.componentRef.setInput('plan', plan);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('free planda X/3 kullanım göstergesi gösterir', async () => {
    const fixture = await setup('free');
    http.expectOne((r) => r.url.includes('/rest/v1/business_media')).flush([]);
    await tick();

    expect(fixture.nativeElement.textContent).toContain('0/3');
  });

  it('pro planda sınırsız mesajı gösterir', async () => {
    const fixture = await setup('pro');
    http.expectOne((r) => r.url.includes('/rest/v1/business_media')).flush([]);
    await tick();

    expect(fixture.nativeElement.textContent).toContain('sınırsız');
  });

  it('alt metin olmadan yüklemeye çalışırsa hata gösterir, istek atılmaz', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET').flush([]);
    await tick();

    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const uploadBtn = fixture.nativeElement.querySelector('button.btn--secondary') as HTMLButtonElement;
    uploadBtn.click();
    await tick();

    expect(fixture.nativeElement.textContent).toContain('alt metin');
    expect(mediaServiceStub.upload).not.toHaveBeenCalled();
  });

  it('geçerli dosya + alt metinle yükleme başarılıysa listeye eklenir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET').flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    const altInput = el.querySelector('input[type="text"]') as HTMLInputElement;
    altInput.value = 'Durak fotoğrafı';
    altInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const uploadBtn = el.querySelector('button.btn--secondary') as HTMLButtonElement;
    uploadBtn.click();
    await tick();

    const insertReq = http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'POST');
    expect(insertReq.request.body).toEqual({
      business_id: 'biz-1',
      storage_path: 'biz-1/photo.jpg',
      alt_text: 'Durak fotoğrafı',
      sort_order: 0,
    });
    insertReq.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET').flush([
      { id: 'm1', storage_path: 'biz-1/photo.jpg', alt_text: 'Durak fotoğrafı', media_type: 'photo', sort_order: 0 },
    ]);
    await tick();

    expect(mediaServiceStub.upload).toHaveBeenCalledWith('biz-1', file);
    expect(el.querySelector('.photo-grid img')).not.toBeNull();
  });

  it('free plan limiti aşılırsa (23514) dürüst bir mesaj gösterir', async () => {
    const fixture = await setup('free');
    http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET').flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const fileInput = el.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    const altInput = el.querySelector('input[type="text"]') as HTMLInputElement;
    altInput.value = 'dördüncü fotoğraf';
    altInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('button.btn--secondary') as HTMLButtonElement).click();
    await tick();

    http
      .expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'POST')
      .flush({ code: '23514', message: 'limit' }, { status: 400, statusText: 'Bad Request' });
    await tick();

    expect(el.textContent).toContain('en fazla 3 fotoğraf');
  });

  it('fotoğraf silme DELETE isteği gönderir ve storage temizler', async () => {
    const fixture = await setup();
    http
      .expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET')
      .flush([{ id: 'm1', storage_path: 'biz-1/photo.jpg', alt_text: 'x', media_type: 'photo', sort_order: 0 }]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.photo-grid__remove') as HTMLButtonElement).click();

    const delReq = http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'DELETE');
    delReq.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/business_media') && r.method === 'GET').flush([]);
    await tick();

    expect(mediaServiceStub.remove).toHaveBeenCalledWith('biz-1/photo.jpg');
  });
});
