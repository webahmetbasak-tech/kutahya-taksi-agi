-- Kütahya Taksi Ağı — kayıp slug çözümleme (§64: 301 / 410 / 404 ayrımı)
--
-- Bir /taksi/:slug isteği eşleşmediğinde üç farklı gerçek durum olabilir ve
-- her biri farklı bir HTTP anlamına gelir:
--   1. Slug DEĞİŞMİŞ, işletme hâlâ aktif  -> 301 (kalıcı yönlendirme)
--   2. İşletme kalıcı olarak kaldırılmış  -> 410 (Gone)
--   3. Hiç var olmamış                    -> 404
--
-- anon normal şartlarda business_slug_history'yi ve arşivlenmiş isletmeleri
-- RLS altında kısmen görebilir/göremez; burada SECURITY DEFINER kullanmamizin
-- nedeni davranışı TEK bir sorguda, tutarlı şekilde belirlemektir — is_admin()
-- ile aynı gerekçe. Fonksiyon YALNIZCA sınıflandırma + yeni slug döner; isim,
-- telefon, adres gibi hiçbir işletme verisi sızdırmaz.

create type public.slug_resolution as (
  outcome  text,  -- 'redirect' | 'archived' | 'not_found'
  new_slug text   -- yalnizca outcome = 'redirect' iken dolu
);

create or replace function public.resolve_missing_business_slug(target_slug text)
returns public.slug_resolution
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result public.slug_resolution;
  history_slug text;
  history_status public.business_status;
  direct_status public.business_status;
begin
  -- 1) Bu slug daha once baska bir isletmenin ESKI slug'i mi, ve o isletme
  --    hala aktif mi?
  select b.slug, b.status
    into history_slug, history_status
  from public.business_slug_history h
  join public.businesses b on b.id = h.business_id
  where h.old_slug = target_slug;

  if found and history_status = 'active' then
    result.outcome := 'redirect';
    result.new_slug := history_slug;
    return result;
  end if;

  -- 2) Slug DOGRUDAN bir isletmeye ait ama o isletme artik aktif degil mi?
  select status into direct_status
  from public.businesses
  where slug = target_slug;

  if found and direct_status = 'archived' then
    result.outcome := 'archived';
    return result;
  end if;

  -- 3) Hicbir zaman var olmamis (ya da pending/suspended/rejected — bunlar
  --    public'e "hic yok" gibi davranir, cunku henuz yayinlanmadilar).
  result.outcome := 'not_found';
  return result;
end;
$$;

comment on function public.resolve_missing_business_slug(text) is
  'Bulunamayan bir /taksi/:slug icin 301 (redirect) / 410 (archived) / 404 (not_found) '
  'ayrimini yapar. Yalnizca siniflandirma doner, isletme verisi sizdirmaz (§64).';

revoke execute on function public.resolve_missing_business_slug(text) from public;
grant execute on function public.resolve_missing_business_slug(text) to anon, authenticated;
