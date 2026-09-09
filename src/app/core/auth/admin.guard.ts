import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot, type UrlTree } from '@angular/router';
import { filter, map, take, type Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { AdminAccessService } from './admin-access.service';

/**
 * `/admin` altındaki TÜM route'ları korur — bu uygulamadaki İLK gerçek route
 * guard'ı (bkz. ARCHITECTURE.md/Faz 9 planı). Diğer oturum-gerektiren
 * sayfalar (`ClaimPage`, `DashboardPage`) bileşen-içi `effect()` yönlendirmesi
 * kullanır; admin altında 8+ ekran olacağı için o deseni tekrarlamak yerine
 * TEK bir guard, tek noktadan uygulanıyor.
 *
 * GÜVENLİK TEK YERDE DEĞİL — bu guard yalnızca UX'tir (yanlış sayfaya
 * gitmeyi önler). Gerçek yetkilendirme RLS'te (`businesses_select_admin`,
 * `claims_admin_all`, ...); guard'ı atlayan biri veri göremez, yalnızca boş
 * bir ekranla karşılaşır.
 */
export function adminGuard(
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): Observable<boolean | UrlTree> {
  const auth = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  return toObservable(adminAccess.ready).pipe(
    filter((ready) => ready),
    take(1),
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/giris'], { queryParams: { redirect: state.url } });
      }
      if (!adminAccess.isAdmin()) {
        return router.createUrlTree(['/']);
      }
      return true;
    }),
  );
}
