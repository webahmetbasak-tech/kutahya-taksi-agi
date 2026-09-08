-- Kütahya Taksi Ağı — Storage bucket'lari ve politikalari
--
-- Klasor duzeni: business-media/<business_id>/<dosya>
-- Yol icindeki ilk segment isletme kimligidir; politikalar bunu kullanarak
-- "yalnizca kendi isletmesinin klasoru" kuralini uygular.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  true,                                    -- gorseller public okunur (rehber sitesi)
  5 * 1024 * 1024,                         -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- ---------------------------------------------------------------------------
-- Okuma: herkese acik. Bucket public oldugu icin CDN uzerinden servis edilir.
-- ---------------------------------------------------------------------------
create policy "business_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'business-media');

-- ---------------------------------------------------------------------------
-- Yazma: yalnizca isletme sahibi kendi klasorune, ya da admin.
--
-- `storage.foldername(name)` yol segmentlerini dizi olarak verir; [1] ilk klasor,
-- yani business_id. Gecersiz UUID'li yollar exists sorgusunda eslesmez.
-- ---------------------------------------------------------------------------
create or replace function public.can_write_business_media(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text;
  business uuid;
begin
  if public.is_admin() then
    return true;
  end if;

  folder := (storage.foldername(object_name))[1];
  if folder is null then
    return false;
  end if;

  begin
    business := folder::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1 from public.businesses b
    where b.id = business and b.owner_id = (select auth.uid())
  );
end;
$$;

comment on function public.can_write_business_media(text) is
  'Storage yolu <business_id>/... icin yazma yetkisi. Yalnizca isletme sahibi veya admin.';

create policy "business_media_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'business-media'
    and public.can_write_business_media(name)
  );

create policy "business_media_owner_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'business-media' and public.can_write_business_media(name))
  with check (bucket_id = 'business-media' and public.can_write_business_media(name));

create policy "business_media_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'business-media' and public.can_write_business_media(name));
