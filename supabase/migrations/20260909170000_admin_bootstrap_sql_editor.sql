-- Kütahya Taksi Ağı — R9 bootstrap yolunu Supabase Studio'dan da açar
--
-- Canlıda keşfedilen gerçek sorun: `protect_profile_role()`'un (20260909140000)
-- bootstrap istisnası `new.id = (select auth.uid())` şartına bağlıydı. Ama
-- Supabase Studio'nun SQL Editor'ü ve Table Editor'ü veritabanına kullanıcının
-- kendi oturumuyla değil, `postgres` superuser rolüyle bağlanır — bu bağlamda
-- `auth.uid()` HER ZAMAN NULL döner. Sonuç: dokümante edilen "en basit yol"
-- (Table Editor'de role'ü elle admin yapmak) hiçbir zaman çalışmadı, yalnızca
-- README'deki `curl` (gerçek JWT ile PATCH) yolu çalışıyordu.
--
-- Bu istisna, `session_user = 'postgres'` kontrolüyle SQL Editor/Table
-- Editor'den yapılan bootstrap'a da izin verir. Bu güvenli: Supabase
-- projesine SQL Editor ile bağlanabilmek zaten yalnızca proje sahibinin
-- Supabase hesabıyla mümkün — genel API/anon/authenticated istekleri asla
-- `postgres` rolüyle gelmez. Diğer tüm kısıtlar (yalnızca KENDİ satırını,
-- yalnızca sistemde HİÇ admin yokken) aynen korunuyor — arka kapı değil,
-- tek seferlik ve kendiliğinden kapanan bir istisna.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if public.is_admin() then
      return new;
    end if;

    if new.role = 'admin'
       and not exists (select 1 from public.profiles where role = 'admin')
       and (
         new.id = (select auth.uid())
         or session_user = 'postgres'
       )
    then
      return new;
    end if;

    raise exception 'Kullanici kendi rolunu degistiremez.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
