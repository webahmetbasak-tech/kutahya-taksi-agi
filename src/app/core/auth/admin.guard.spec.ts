import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, UrlTree, type RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { AdminAccessService } from './admin-access.service';

function mockAuth(isAuthenticated: boolean) {
  return { isAuthenticated: signal(isAuthenticated) };
}

function mockAdminAccess(ready: boolean, isAdmin: boolean) {
  return { ready: signal(ready), isAdmin: signal(isAdmin) };
}

function configure(auth: ReturnType<typeof mockAuth>, adminAccess: ReturnType<typeof mockAdminAccess>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: AdminAccessService, useValue: adminAccess },
    ],
  });
}

const STATE = { url: '/admin/isletmeler' } as RouterStateSnapshot;

describe('adminGuard', () => {
  it('oturum yoksa /girise redirect query param ile UrlTree döner', async () => {
    configure(mockAuth(false), mockAdminAccess(true, false));

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as never, STATE)),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/giris?redirect=%2Fadmin%2Fisletmeler');
  });

  it('oturum açık ama admin değilse /ye UrlTree döner', async () => {
    configure(mockAuth(true), mockAdminAccess(true, false));

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as never, STATE)),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('oturum açık ve admin ise true döner', async () => {
    configure(mockAuth(true), mockAdminAccess(true, true));

    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as never, STATE)),
    );

    expect(result).toBe(true);
  });

  it('admin erişim durumu hazır olana kadar bekler', async () => {
    const adminAccess = mockAdminAccess(false, false);
    configure(mockAuth(true), adminAccess);

    const resultPromise = firstValueFrom(
      TestBed.runInInjectionContext(() => adminGuard({} as never, STATE)),
    );

    adminAccess.ready.set(true);
    adminAccess.isAdmin.set(true);

    expect(await resultPromise).toBe(true);
  });
});
