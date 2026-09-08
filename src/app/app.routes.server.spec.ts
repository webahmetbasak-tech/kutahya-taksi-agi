import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';
import { routes } from './app.routes';

/**
 * Render modu yapılandırması sessizce bozulabilecek bir yerdir: yeni bir route
 * eklenip server route'u unutulursa sayfa yanlış modda render edilir ve bu
 * ancak production'da SEO kaybı olarak fark edilir. Bu testler o boşluğu kapatır.
 */
describe('sunucu route yapılandırması', () => {
  const byPath = new Map(serverRoutes.map((route) => [route.path, route]));

  it("her istemci route'unun bir sunucu karşılığı vardır", () => {
    const clientPaths = routes.map((route) => route.path).filter((path) => path !== undefined);

    for (const path of clientPaths) {
      expect(byPath.has(path)).toBe(true);
    }
  });

  it('public SEO sayfaları sunucuda render edilir', () => {
    for (const path of ['', 'taksi', 'taksi/:slug']) {
      expect(byPath.get(path)?.renderMode).toBe(RenderMode.Server);
    }
  });

  it("public sayfalar CDN cache header'ı taşır", () => {
    for (const path of ['', 'taksi', 'taksi/:slug']) {
      expect(byPath.get(path)?.headers?.['Cache-Control']).toContain('s-maxage');
    }
  });

  it('statik içerik sayfaları prerender edilir', () => {
    for (const path of ['hakkinda', 'gizlilik']) {
      expect(byPath.get(path)?.renderMode).toBe(RenderMode.Prerender);
    }
  });

  it("panel istemcide render edilir ve cache'lenmez", () => {
    const panel = byPath.get('panel');

    expect(panel?.renderMode).toBe(RenderMode.Client);
    expect(panel?.headers?.['Cache-Control']).toContain('no-store');
  });

  it('bilinmeyen URL gerçek 404 döner (soft 404 değil)', () => {
    const wildcard = byPath.get('**');

    expect(wildcard?.renderMode).toBe(RenderMode.Server);
    // `status` yalnızca prerender olmayan route'larda bulunur, bu yüzden daraltıyoruz.
    expect(wildcard && 'status' in wildcard ? wildcard.status : undefined).toBe(404);
  });
});
