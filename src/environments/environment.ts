/**
 * Uygulamanın ortam yapılandırmasına tek giriş noktası.
 *
 * Kod her zaman buradan import eder (`@env`), üretilen dosyadan değil. Böylece
 * üretilen dosya gitignore'da kalabilir ve import yolları sabit olur.
 */
import { generatedEnvironment } from './environment.generated';
import type { AppEnvironment } from './environment.model';

export type { AppEnvironment };

export const environment: AppEnvironment = generatedEnvironment;

/** Mutlak URL üretir. Canonical, sitemap ve OpenGraph için kullanılır. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${environment.siteUrl}${suffix === '/' ? '' : suffix}`;
}
