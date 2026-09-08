import { isLikelyBot } from './bot-detection';

describe('isLikelyBot', () => {
  it('gerçek bir masaüstü tarayıcı user-agent için false döner', () => {
    expect(
      isLikelyBot(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('gerçek bir mobil tarayıcı user-agent için false döner', () => {
    expect(
      isLikelyBot(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });

  it('Googlebot için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      true,
    );
  });

  it('GPTBot için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toBe(true);
  });

  it('OAI-SearchBot için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)')).toBe(
      true,
    );
  });

  it('ChatGPT-User için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)')).toBe(true);
  });

  it('ClaudeBot için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe(true);
  });

  it('PerplexityBot için true döner', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)')).toBe(
      true,
    );
  });

  it('headless Chrome için true döner', () => {
    expect(
      isLikelyBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/128.0.0.0 Safari/537.36'),
    ).toBe(true);
  });

  it('user-agent boş string ise true döner', () => {
    expect(isLikelyBot('')).toBe(true);
  });

  it('user-agent undefined ise true döner', () => {
    expect(isLikelyBot(undefined)).toBe(true);
  });

  it('user-agent null ise true döner', () => {
    expect(isLikelyBot(null)).toBe(true);
  });
});
