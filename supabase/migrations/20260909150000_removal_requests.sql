-- Kütahya Taksi Ağı — profil kaldırma talebi kuyruğu (Faz 9c, KVKK, §56)
--
-- ARCHITECTURE.md §12: "her profilde görünür 'Bu profilin kaldırılmasını
-- talep et' bağlantısı" — kamuya açık bir taksi işletmesinin telefon numarası
-- kişisel veridir, kamuya açık olması işlemeyi otomatik meşru kılmaz. Bu
-- migration o talebi kaydeden kuyruğu ekliyor: HERKES (oturum açmamış bir
-- taksici dahil) talep edebilmeli, admin inceleyip karar verir. OTOMATİK
-- SİLME YOK — §52'nin (olası kopya) aynı felsefesi: işaretlenir, admin karar
-- verir.

create type public.removal_request_status as enum ('pending', 'completed', 'dismissed');

create table public.removal_requests (
  id            uuid primary key default extensions.gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  -- Oturum açmamış bir ziyaretçi de talep edebilir (§56) — bu yüzden nullable.
  requested_by  uuid references public.profiles(id) on delete set null,
  reason        text not null,
  contact_email text,
  status        public.removal_request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null,

  constraint removal_requests_reason_not_blank check (nullif(trim(reason), '') is not null),
  constraint removal_requests_resolved_consistent check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (status in ('completed', 'dismissed') and resolved_at is not null)
  )
);

comment on table public.removal_requests is
  'KVKK profil kaldirma talepleri (§56). OTOMATIK SILME YOK — yalnizca admin inceler.';

alter table public.removal_requests enable row level security;

-- Okuma/karar yalnizca admin — talep sahibi (varsa) bile kendi talebini
-- GERI OKUYAMAZ; bu bir "durum takibi" ekrani degil, tek yonlu bir bildirim
-- kutusu (basitlik icin bilincli — Faz 9c kapsaminda takip ekrani yok).
create policy removal_requests_admin_all
  on public.removal_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Dogrudan INSERT policy'si BILEREK yok (businesses/submit_business ile ayni
-- desen) — anon'a serbest insert vermek spam'e acardi. Tek giris yolu asagidaki
-- SECURITY DEFINER RPC.
revoke all on public.removal_requests from anon, authenticated;
grant select, update, delete on public.removal_requests to authenticated;

-- ---------------------------------------------------------------------------
-- request_business_removal — kontrollü kaldırma talebi RPC'si.
--
-- `anon`a da açık (submit_business'tan FARKI budur) — bu profilin kaldırılmasını
-- isteyen kişi hiç hesap açmamış bir taksici olabilir.
-- ---------------------------------------------------------------------------
create or replace function public.request_business_removal(
  p_business_id   uuid,
  p_reason        text,
  p_contact_email text default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_email  text;
  v_new_id uuid;
begin
  v_reason := nullif(trim(p_reason), '');
  if v_reason is null then
    raise exception 'Kaldirma sebebi zorunludur.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'Isletme bulunamadi.' using errcode = '22023';
  end if;

  v_email := nullif(trim(coalesce(p_contact_email, '')), '');

  insert into public.removal_requests (business_id, requested_by, reason, contact_email)
  values (p_business_id, (select auth.uid()), v_reason, v_email)
  returning removal_requests.id into v_new_id;

  return query select v_new_id;
end;
$$;

comment on function public.request_business_removal(uuid, text, text) is
  'Profil kaldirma talebi RPC''si (§56). anon dahil herkes cagirabilir; tek giris yolu budur.';

revoke execute on function public.request_business_removal(uuid, text, text) from public;
grant execute on function public.request_business_removal(uuid, text, text) to anon, authenticated;
