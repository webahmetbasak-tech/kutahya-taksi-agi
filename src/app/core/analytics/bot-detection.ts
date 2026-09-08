/**
 * En iyi çaba (best-effort) bot tespiti — saf fonksiyon, DOM'suz test edilebilir.
 *
 * NEDEN GEREKLİ? SSR event ÜRETMEZ (AnalyticsService yalnızca tarayıcıda
 * çalışır) — ama bazı crawler'lar (Googlebot'un render aşaması, ChatGPT-User
 * gibi ajan tabanlı erişimler) sayfayı GERÇEKTEN tarayıcıda gibi JS ile
 * render edebilir. Bu durumda `profile_view` gibi tıklama gerektirmeyen bir
 * event yanlışlıkla "gerçek insan" sayılabilir. Bu liste KESİN bir güvenlik
 * sınırı değildir — yalnızca bilinen user-agent imzalarını eleyen bir
 * istatistik temizliği katmanıdır (ARCHITECTURE.md §11).
 *
 * Liste PROJECT_PLAN.md Faz 5'te doğrulanan resmî AI crawler adlarını
 * (OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot,
 * PerplexityBot, Perplexity-User, GPTBot) ve klasik arama motoru
 * bot'larını içerir.
 */
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|headlesschrome|ia_archiver|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-searchbot|claude-user|perplexitybot|perplexity-user|applebot|semrushbot|ahrefsbot|mj12bot|dotbot/i;

export function isLikelyBot(userAgent: string | undefined | null): boolean {
  if (!userAgent) {
    // User-agent hiç yoksa (bazı headless araçlar) şüpheli kabul edilir —
    // gerçek bir tarayıcı her zaman bir user-agent gönderir.
    return true;
  }
  return BOT_UA_PATTERN.test(userAgent);
}
