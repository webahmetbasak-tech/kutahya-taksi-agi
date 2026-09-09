import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TaxiCard } from './taxi-card';
import type { BusinessCard } from '@core/data/models';
import { provideAppConfig } from '@core/config/app-config';
import { AnalyticsService } from '@core/analytics/analytics.service';

function business(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: '1',
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

describe('TaxiCard', () => {
  async function setup(input: Partial<BusinessCard> = {}, distanceMeters?: number) {
    await TestBed.configureTestingModule({
      imports: [TaxiCard],
      providers: [provideRouter([]), provideAppConfig()],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaxiCard);
    fixture.componentRef.setInput('business', business(input));
    if (distanceMeters !== undefined) {
      fixture.componentRef.setInput('distanceMeters', distanceMeters);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('telefon varsa tel: bağlantısı gösterir', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    const callLink = el.querySelector<HTMLAnchorElement>('a.btn--primary');

    expect(callLink?.getAttribute('href')).toBe('tel:+905551112233');
  });

  it('telefon YOKSA "Ara" butonu göstermez, dürüst bir mesaj gösterir (§20)', async () => {
    const fixture = await setup({ phone_e164: null });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('a.btn--primary')).toBeNull();
    expect(el.textContent).toContain('Telefon bilgisi yok');
  });

  it('whatsapp_e164 doluysa WhatsApp butonu gösterir (§48)', async () => {
    const fixture = await setup({ whatsapp_e164: '+905551112233' });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('WhatsApp');
  });

  it('whatsapp_e164 NULL ise WhatsApp butonu HİÇ gösterilmez (§48)', async () => {
    const fixture = await setup({ whatsapp_e164: null });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('WhatsApp');
  });

  it('her zaman bir Yol Tarifi bağlantısı gösterir (koordinat/URL olmasa bile)', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Yol Tarifi');
  });

  it('doğrulanmamış işletmede güven rozeti GÖSTERMEZ', async () => {
    const fixture = await setup({ verification_status: 'unverified' });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.badge--verified')).toBeNull();
  });

  it('owner_claimed + last_verified_at doluyken güven rozeti gösterir (§41)', async () => {
    const fixture = await setup({
      verification_status: 'owner_claimed',
      last_verified_at: '2026-09-01T00:00:00Z',
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.badge--verified')?.textContent).toContain('İşletme sahibi doğruladı');
  });

  it('free planda "Öne Çıkan" rozeti göstermez', async () => {
    const fixture = await setup({ plan: 'free' });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Öne Çıkan');
  });

  it('pro/premium planda "Öne Çıkan" rozeti gösterir (§58 — sıralamayı etkilemez)', async () => {
    const fixture = await setup({ plan: 'pro' });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Öne Çıkan');
  });

  it('mesafe verilmişse km/m olarak gösterir', async () => {
    const fixture = await setup({}, 850);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('850 m uzaklıkta');
  });

  it('"Ara" tıklanınca call_click olayını işletme id\'siyle takip eder', async () => {
    const trackSpy = vi.fn();
    await TestBed.configureTestingModule({
      imports: [TaxiCard],
      providers: [
        provideRouter([]),
        provideAppConfig(),
        { provide: AnalyticsService, useValue: { track: trackSpy } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaxiCard);
    fixture.componentRef.setInput('business', business());
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLAnchorElement>('a.btn--primary')?.click();

    expect(trackSpy).toHaveBeenCalledWith({ eventType: 'call_click', businessId: '1' });
  });
});
