import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthPage } from './auth-page';
import { AuthService } from '@core/auth/auth.service';
import { provideAppConfig } from '@core/config/app-config';

function mockAuth(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ready: signal(true),
    isAuthenticated: signal(false),
    user: signal<{ id: string; email: string | null } | null>(null),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

async function setup(auth: ReturnType<typeof mockAuth>, redirect?: string) {
  await TestBed.configureTestingModule({
    imports: [AuthPage],
    providers: [provideRouter([]), provideAppConfig(), { provide: AuthService, useValue: auth }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthPage);
  if (redirect !== undefined) {
    fixture.componentRef.setInput('redirect', redirect);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function setValue(el: HTMLElement | null, value: string): void {
  const input = el as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('AuthPage', () => {
  it('varsayılan olarak giriş modunda render edilir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Giriş Yap');
    expect(el.textContent).not.toContain('Hesap Oluştur');
  });

  it('"Kayıt olun" tıklanınca kayıt moduna geçer', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.link-button')?.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Hesap Oluştur');
  });

  it('boş formla gönderilirse doğrulama hatalarını gösterir, signIn ÇAĞRILMAZ', async () => {
    const auth = mockAuth();
    const fixture = await setup(auth);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(el.textContent).toContain('E-posta gerekli.');
  });

  it('hatalı giriş bilgisi Türkçe hata mesajını banner olarak gösterir', async () => {
    const auth = mockAuth({ signIn: vi.fn().mockResolvedValue({ error: 'E-posta veya şifre hatalı.' }) });
    const fixture = await setup(auth);
    const el = fixture.nativeElement as HTMLElement;

    setValue(el.querySelector('#auth-email'), 'sahip@example.test');
    setValue(el.querySelector('#auth-password'), 'yanlis1');
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.signIn).toHaveBeenCalledWith('sahip@example.test', 'yanlis1');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('E-posta veya şifre hatalı.');
  });

  it('başarılı girişte redirect query paramına yönlendirir', async () => {
    const auth = mockAuth({ signIn: vi.fn().mockResolvedValue(undefined) });
    const fixture = await setup(auth, '/taksi/zumrut-taksi/sahiplen');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;

    setValue(el.querySelector('#auth-email'), 'sahip@example.test');
    setValue(el.querySelector('#auth-password'), 'Passw0rd!');
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/taksi/zumrut-taksi/sahiplen');
  });

  it('redirect verilmemişse başarılı girişte /panele yönlendirir', async () => {
    const auth = mockAuth({ signIn: vi.fn().mockResolvedValue(undefined) });
    const fixture = await setup(auth);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;

    setValue(el.querySelector('#auth-email'), 'sahip@example.test');
    setValue(el.querySelector('#auth-password'), 'Passw0rd!');
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/panel');
  });

  it('kayıt sonrası e-posta onayı bekleniyorsa (confirmed:false) yönlendirmez, banner gösterir', async () => {
    const auth = mockAuth({ signUp: vi.fn().mockResolvedValue({ confirmed: false }) });
    const fixture = await setup(auth);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.link-button')?.click();
    fixture.detectChanges();
    setValue(el.querySelector('#auth-email'), 'yeni@example.test');
    setValue(el.querySelector('#auth-password'), 'Passw0rd!');
    fixture.detectChanges();
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(el.textContent).toContain('E-postanızı kontrol edin.');
  });

  it('zaten oturum açıksa sayfa hiç render edilmeden hedefe yönlendirir', async () => {
    const auth = mockAuth({ isAuthenticated: signal(true) });
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [provideRouter([]), provideAppConfig(), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuthPage);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/panel');
  });
});
