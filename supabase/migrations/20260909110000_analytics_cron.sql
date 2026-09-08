-- Kütahya Taksi Ağı — analytics zamanlanmış işleri (§16, §28, §56)
--
-- Faz 2'de `rollup_analytics_daily()` ve `prune_analytics_events()`
-- fonksiyonları yazıldı ama HİÇ ZAMANLANMAMIŞTI — Faz 6'nın gerçek eksiği bu.
-- Supabase'de pg_cron zaten `shared_preload_libraries`'e yüklü gelir; burada
-- yalnızca uzantıyı etkinleştirip iki gecelik iş tanımlıyoruz.
--
-- Saatler UTC'dir (pg_cron varsayılanı). 03:00/03:30 UTC = Türkiye saatiyle
-- (UTC+3) gece 06:00/06:30 — düşük trafik penceresi.

create extension if not exists pg_cron;

-- Bir önceki günün ham event'lerini analytics_daily'ye özetler (idempotent —
-- aynı gün için tekrar çalışırsa üzerine yazar, toplamaz; bkz. fonksiyonun
-- kendi yorumu, Faz 2 migration'ı).
select cron.schedule(
  'analytics-rollup-nightly',
  '0 3 * * *',
  $$select public.rollup_analytics_daily();$$
);

-- 90 günden eski ham event'leri siler (KVKK veri minimizasyonu, §56).
-- Özet (analytics_daily) kalıcıdır; yalnızca ham kayıt silinir.
select cron.schedule(
  'analytics-prune-nightly',
  '30 3 * * *',
  $$select public.prune_analytics_events();$$
);
