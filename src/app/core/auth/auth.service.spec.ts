import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { AuthTokenStore } from './auth-token-store';
import { AuthService } from './auth.service';
import type { AppEnvironment } from '@env';

const config: AppEnvironment = {
  environment: 'development',
  production: false,
  siteUrl: 'https://example.test',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon-test-key',
};

const { getSession, onAuthStateChange, signUp, signInWithPassword, signOut, createClient } = vi.hoisted(
  () => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    createClient: vi.fn(),
  }),
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

/**
 * `getSession().then(...)`in mikro görev kuyruğuna gerçekten yerleşmesini
 * bekler. İki sabit `await Promise.resolve()` normalde yeterliydi, ancak bu
 * dosya paylaşımlı bir worker'da BAŞKA test dosyalarının mikro görevleriyle
 * aynı kuyruğa düşebiliyor (`isolate:false` havuzu) — sabit "iki tık" varsayımı
 * o durumda kırılgan. Bir makro görev (`setTimeout`) tüm bekleyen mikro
 * görevleri, kaynağı ne olursa olsun, tüketmeyi garanti eder.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function session(overrides: Partial<{ access_token: string; id: string; email: string }> = {}) {
  return {
    access_token: overrides.access_token ?? 'jwt-abc',
    user: { id: overrides.id ?? 'user-1', email: overrides.email ?? 'sahip@example.test' },
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    signUp.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset().mockResolvedValue({ error: null });
    createClient.mockReset().mockReturnValue({
      auth: { getSession, onAuthStateChange, signUp, signInWithPassword, signOut },
    });
  });

  function setup(platformId: 'browser' | 'server' = 'browser'): AuthService {
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return TestBed.inject(AuthService);
  }

  it('SSR ortamında supabase-js istemcisi hiç oluşturulmaz, ready senkron true olur', async () => {
    const auth = setup('server');

    expect(auth.ready()).toBe(true);
    expect(auth.user()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('tarayıcıda başlangıçta oturum yoksa ready true, user null olur', async () => {
    const auth = setup();
    await flush();

    expect(auth.ready()).toBe(true);
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('mevcut bir oturum varsa user doldurulur ve AuthTokenStore güncellenir', async () => {
    getSession.mockResolvedValue({ data: { session: session() }, error: null });
    const auth = setup();
    await flush();

    expect(auth.user()).toEqual({ id: 'user-1', email: 'sahip@example.test' });
    expect(TestBed.inject(AuthTokenStore).accessToken()).toBe('jwt-abc');
  });

  it('onAuthStateChange tetiklenince user ve token güncellenir (giriş)', async () => {
    const auth = setup();
    await flush();

    const callback = onAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      s: unknown,
    ) => void;
    callback('SIGNED_IN', session({ id: 'user-2', access_token: 'jwt-2' }));

    expect(auth.user()?.id).toBe('user-2');
    expect(TestBed.inject(AuthTokenStore).accessToken()).toBe('jwt-2');
  });

  it('onAuthStateChange null oturum verince (çıkış) user ve token temizlenir', async () => {
    getSession.mockResolvedValue({ data: { session: session() }, error: null });
    const auth = setup();
    await flush();

    const callback = onAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      s: unknown,
    ) => void;
    callback('SIGNED_OUT', null);

    expect(auth.user()).toBeNull();
    expect(TestBed.inject(AuthTokenStore).accessToken()).toBeNull();
  });

  it('signUp(): e-posta onayı bekleniyorsa (oturum yok, hata yok) confirmed:false döner', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const auth = setup();

    const result = await auth.signUp('yeni@example.test', 'Passw0rd!');

    expect(result).toEqual({ confirmed: false });
  });

  it('signUp(): zaten kayıtlı e-posta Türkçe hata mesajına çevrilir', async () => {
    signUp.mockResolvedValue({
      data: { session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    });
    const auth = setup();

    const result = await auth.signUp('var@example.test', 'Passw0rd!');

    expect(result).toEqual({ error: 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.' });
  });

  it('signIn(): hatalı şifre Türkçe mesaja çevrilir', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const auth = setup();

    const result = await auth.signIn('sahip@example.test', 'yanlis');

    expect(result).toEqual({ error: 'E-posta veya şifre hatalı.' });
  });

  it('signIn(): başarılıysa undefined döner', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const auth = setup();

    const result = await auth.signIn('sahip@example.test', 'Passw0rd!');

    expect(result).toBeUndefined();
  });

  it('signOut(): supabase-js signOut çağrılır', async () => {
    const auth = setup();

    await auth.signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
