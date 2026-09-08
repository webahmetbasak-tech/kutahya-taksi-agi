/**
 * RLS doğrulama testleri — Kütahya Taksi Ağı
 *
 * Bu testler şemayı değil, GÜVENLİK SINIRINI doğrular: anon anahtar client
 * bundle'a girdiği için, saldırganın elinde olan tam olarak bu anahtardır.
 * Yani buradaki "anon ne yapabiliyor?" soruları teorik değil, gerçek saldırı
 * yüzeyidir.
 *
 * Çalıştırma:
 *   node --env-file=.env scripts/rls-test.mjs
 *
 * SUPABASE_SERVICE_ROLE_KEY tanımlıysa fixture gerektiren testler de çalışır
 * (pending işletme oluşturup anon'un göremediğini kanıtlamak gibi). Tanımlı
 * değilse o testler ATLANIR ve sonuçta açıkça belirtilir — sessizce "geçti"
 * denmez.
 */

const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !anonKey) {
  console.error('SUPABASE_URL ve SUPABASE_ANON_KEY gerekli. node --env-file=.env ile çalıştırın.');
  process.exit(1);
}

const rest = `${url}/rest/v1`;
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function headers(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function req(path, { key = anonKey, method = 'GET', body, prefer } = {}) {
  const h = headers(key, { 'Content-Type': 'application/json' });
  if (prefer) h['Prefer'] = prefer;
  const res = await fetch(`${rest}${path}`, {
    method,
    headers: h,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, body: json };
}

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  – ${name} (atlandı: ${reason})`);
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------

async function testPublicReads() {
  section('Public okuma — referans verisi anon tarafından okunabilmeli');

  const cats = await req('/categories?select=slug');
  check('kategoriler okunabiliyor', cats.status === 200 && Array.isArray(cats.body));

  const services = await req('/services?select=slug');
  check(
    'hizmetler okunabiliyor',
    services.status === 200 && Array.isArray(services.body) && services.body.length > 0,
  );

  const locations = await req('/locations?select=slug,type');
  check(
    'lokasyonlar okunabiliyor',
    locations.status === 200 && Array.isArray(locations.body) && locations.body.length > 0,
  );

  const businesses = await req('/businesses?select=id,slug');
  check(
    'işletme listesi okunabiliyor (boş olsa da hata vermemeli)',
    businesses.status === 200 && Array.isArray(businesses.body),
    `status=${businesses.status}`,
  );
}

async function testAnonCannotRead() {
  section('Gizlilik — anon okumaMAmalı');

  const profiles = await req('/profiles?select=id,full_name,phone_e164');
  check(
    'anon profilleri OKUYAMAZ (işletme sahiplerinin telefonu sızmamalı)',
    profiles.status === 401 || profiles.status === 403 || isEmptyArray(profiles.body),
    `status=${profiles.status} body=${JSON.stringify(profiles.body)?.slice(0, 120)}`,
  );

  const claims = await req('/claims?select=id,business_id,user_id');
  check(
    'anon sahiplenme taleplerini OKUYAMAZ',
    claims.status === 401 || claims.status === 403 || isEmptyArray(claims.body),
    `status=${claims.status}`,
  );

  const events = await req('/analytics_events?select=id,business_id,event_type');
  check(
    'anon analytics olaylarını OKUYAMAZ (rakip istatistiği görülemez)',
    events.status === 401 || events.status === 403 || isEmptyArray(events.body),
    `status=${events.status}`,
  );

  const daily = await req('/analytics_daily?select=business_id,event_count');
  check(
    'anon günlük istatistikleri OKUYAMAZ',
    daily.status === 401 || daily.status === 403 || isEmptyArray(daily.body),
    `status=${daily.status}`,
  );

  const unpublished = await req('/landing_pages?select=slug&is_published=eq.false');
  check(
    'anon yayınlanmamış landing page GÖREMEZ',
    unpublished.status === 200 && isEmptyArray(unpublished.body),
    `status=${unpublished.status}`,
  );
}

async function testAnonCannotWrite() {
  section('Yazma koruması — anon yazamaMAlı');

  const insertBusiness = await req('/businesses', {
    method: 'POST',
    body: {
      business_name: 'RLS Test Sahte Isletme',
      slug: 'rls-test-sahte-isletme',
      source_type: 'manual',
      category_id: '00000000-0000-0000-0000-000000000000',
    },
  });
  check(
    "anon işletme EKLEYEMEZ (rehber spam'e kapalı)",
    insertBusiness.status >= 400,
    `status=${insertBusiness.status}`,
  );

  const insertService = await req('/services', {
    method: 'POST',
    body: { slug: 'rls-test-hizmet', name: 'RLS Test' },
  });
  check('anon hizmet EKLEYEMEZ', insertService.status >= 400, `status=${insertService.status}`);

  const insertLocation = await req('/locations', {
    method: 'POST',
    body: { slug: 'rls-test-lokasyon', name: 'RLS Test', type: 'city' },
  });
  check('anon lokasyon EKLEYEMEZ', insertLocation.status >= 400, `status=${insertLocation.status}`);

  const updateService = await req('/services?slug=eq.724-taksi', {
    method: 'PATCH',
    body: { name: 'ELE GECIRILDI' },
  });
  check(
    'anon mevcut hizmeti GÜNCELLEYEMEZ',
    updateService.status >= 400,
    `status=${updateService.status}`,
  );

  const deleteLocation = await req('/locations?slug=eq.kutahya', { method: 'DELETE' });
  check('anon lokasyon SİLEMEZ', deleteLocation.status >= 400, `status=${deleteLocation.status}`);

  const insertReview = await req('/reviews', {
    method: 'POST',
    body: { business_id: '00000000-0000-0000-0000-000000000000', rating: 5 },
  });
  check(
    "anon değerlendirme EKLEYEMEZ (V1'de review yazma kapalı)",
    insertReview.status >= 400,
    `status=${insertReview.status}`,
  );
}

async function testAnalyticsInsertBoundary() {
  section('Analytics insert sınırı — ölçüm açık ama istismara kapalı');

  const orphan = await req('/analytics_events', {
    method: 'POST',
    body: {
      business_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'profile_view',
      session_id: crypto.randomUUID(),
    },
  });
  check('var olmayan işletme için olay YAZILAMAZ', orphan.status >= 400, `status=${orphan.status}`);

  const badType = await req('/analytics_events', {
    method: 'POST',
    body: { event_type: 'uydurma_olay', session_id: crypto.randomUUID() },
  });
  check('tanımsız event_type YAZILAMAZ', badType.status >= 400, `status=${badType.status}`);

  // business_id'siz 'search_performed' meşrudur; yazılabilmeli ama okunamamalı.
  const search = await req('/analytics_events', {
    method: 'POST',
    body: { event_type: 'search_performed', session_id: crypto.randomUUID() },
  });
  check(
    'işletmesiz arama olayı yazılabiliyor (meşru ölçüm)',
    search.status === 201 || search.status === 200 || search.status === 204,
    `status=${search.status}`,
  );

  const readBack = await req('/analytics_events?select=id&limit=1');
  check(
    'yazdıktan sonra bile anon okuyamıyor',
    readBack.status >= 400 || isEmptyArray(readBack.body),
    `status=${readBack.status}`,
  );
}

async function testFixtures() {
  section('Fixture testleri — pending/suspended görünürlüğü');

  if (!serviceKey) {
    skip("pending işletme anon'a görünmüyor", 'SUPABASE_SERVICE_ROLE_KEY yok');
    skip("suspended işletme anon'a görünmüyor", 'SUPABASE_SERVICE_ROLE_KEY yok');
    skip('pending işletmenin alt kayıtları görünmüyor', 'SUPABASE_SERVICE_ROLE_KEY yok');
    skip('slug/telefon biçim kısıtları uygulanıyor', 'SUPABASE_SERVICE_ROLE_KEY yok');
    return;
  }

  const catRes = await req('/categories?select=id&slug=eq.taksi', { key: serviceKey });
  const categoryId = catRes.body?.[0]?.id;
  if (!categoryId) {
    check('taksi kategorisi bulundu', false, 'kategori yok');
    return;
  }

  const stamp = Date.now();
  const made = [];

  async function createBusiness(slug, status) {
    const res = await req('/businesses', {
      key: serviceKey,
      method: 'POST',
      prefer: 'return=representation',
      body: {
        category_id: categoryId,
        business_name: `RLS Test ${slug}`,
        slug,
        status,
        source_type: 'manual',
        source_note: 'RLS test fixture — otomatik silinir',
      },
    });
    const id = res.body?.[0]?.id;
    if (id) made.push(id);
    return { res, id };
  }

  try {
    const pending = await createBusiness(`rls-test-pending-${stamp}`, 'pending');
    const active = await createBusiness(`rls-test-active-${stamp}`, 'active');
    const suspended = await createBusiness(`rls-test-suspended-${stamp}`, 'suspended');

    check(
      'fixture işletmeler oluşturuldu',
      Boolean(pending.id && active.id && suspended.id),
      `pending=${pending.res.status} active=${active.res.status} suspended=${suspended.res.status}`,
    );

    const anonPending = await req(`/businesses?select=id&slug=eq.rls-test-pending-${stamp}`);
    check(
      'anon PENDING işletmeyi GÖREMEZ',
      anonPending.status === 200 && isEmptyArray(anonPending.body),
      `status=${anonPending.status} body=${JSON.stringify(anonPending.body)?.slice(0, 100)}`,
    );

    const anonSuspended = await req(`/businesses?select=id&slug=eq.rls-test-suspended-${stamp}`);
    check(
      'anon SUSPENDED işletmeyi GÖREMEZ',
      anonSuspended.status === 200 && isEmptyArray(anonSuspended.body),
      `status=${anonSuspended.status}`,
    );

    const anonActive = await req(`/businesses?select=id,slug&slug=eq.rls-test-active-${stamp}`);
    check(
      'anon ACTIVE işletmeyi GÖREBİLİR',
      anonActive.status === 200 && anonActive.body?.length === 1,
      `status=${anonActive.status}`,
    );

    // Pending işletmenin alt kayıtları da gizli olmalı.
    const svc = await req('/services?select=id&limit=1', { key: serviceKey });
    const serviceId = svc.body?.[0]?.id;
    if (serviceId && pending.id) {
      await req('/business_services', {
        key: serviceKey,
        method: 'POST',
        body: { business_id: pending.id, service_id: serviceId },
      });
      const anonLink = await req(
        `/business_services?select=business_id&business_id=eq.${pending.id}`,
      );
      check(
        'anon PENDING işletmenin hizmetlerini GÖREMEZ',
        anonLink.status === 200 && isEmptyArray(anonLink.body),
        `status=${anonLink.status}`,
      );
    }

    // Anon aktif bir işletme için olay yazabilmeli (ölçüm çalışsın).
    if (active.id) {
      const ev = await req('/analytics_events', {
        method: 'POST',
        body: {
          business_id: active.id,
          event_type: 'call_click',
          session_id: crypto.randomUUID(),
        },
      });
      check(
        'anon AKTİF işletme için olay yazabiliyor',
        [200, 201, 204].includes(ev.status),
        `status=${ev.status}`,
      );
    }

    // Pending işletme için olay yazılamamalı (WITH CHECK).
    if (pending.id) {
      const ev = await req('/analytics_events', {
        method: 'POST',
        body: {
          business_id: pending.id,
          event_type: 'profile_view',
          session_id: crypto.randomUUID(),
        },
      });
      check('anon PENDING işletme için olay YAZAMAZ', ev.status >= 400, `status=${ev.status}`);
    }

    // Biçim kısıtları
    const badSlug = await req('/businesses', {
      key: serviceKey,
      method: 'POST',
      body: {
        category_id: categoryId,
        business_name: 'Kotu Slug',
        slug: 'Kötü Slug!',
        source_type: 'manual',
      },
    });
    check('geçersiz slug REDDEDİLİYOR', badSlug.status >= 400, `status=${badSlug.status}`);

    const badPhone = await req('/businesses', {
      key: serviceKey,
      method: 'POST',
      body: {
        category_id: categoryId,
        business_name: 'Kotu Telefon',
        slug: `rls-test-badphone-${stamp}`,
        source_type: 'manual',
        phone_e164: '0555 111 22 33',
      },
    });
    check(
      'E.164 olmayan telefon REDDEDİLİYOR',
      badPhone.status >= 400,
      `status=${badPhone.status}`,
    );

    const orphanClaim = await req('/businesses', {
      key: serviceKey,
      method: 'POST',
      body: {
        category_id: categoryId,
        business_name: 'Sahipsiz Claim',
        slug: `rls-test-orphanclaim-${stamp}`,
        source_type: 'manual',
        verification_status: 'owner_claimed',
      },
    });
    check(
      'sahipsiz owner_claimed REDDEDİLİYOR (tutarsız güven rozeti engellendi)',
      orphanClaim.status >= 400,
      `status=${orphanClaim.status}`,
    );
  } finally {
    // Test verisi production veritabanında bırakılmaz.
    for (const id of made) {
      await req(`/businesses?id=eq.${id}`, { key: serviceKey, method: 'DELETE' });
    }
    await req(`/businesses?slug=like.rls-test-*`, { key: serviceKey, method: 'DELETE' });
    console.log(`  (temizlik: ${made.length} fixture silindi)`);
  }
}

function isEmptyArray(body) {
  return Array.isArray(body) && body.length === 0;
}

// ---------------------------------------------------------------------------

console.log(`RLS testleri — ${url}`);
console.log(
  serviceKey
    ? 'servis anahtarı: VAR (tüm testler)'
    : 'servis anahtarı: YOK (fixture testleri atlanacak)',
);

await testPublicReads();
await testAnonCannotRead();
await testAnonCannotWrite();
await testAnalyticsInsertBoundary();
await testFixtures();

console.log(`\n${'='.repeat(60)}`);
console.log(`geçti: ${passed}   başarısız: ${failed}   atlandı: ${skipped}`);
if (failures.length > 0) {
  console.log('\nBAŞARISIZ:');
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
