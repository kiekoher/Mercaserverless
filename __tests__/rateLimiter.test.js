/** @jest-environment node */

describe('checkRateLimit', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.RATE_LIMIT_FAIL_OPEN;
    jest.resetModules();
  });

  it('blocks requests when Redis is unavailable in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_FAIL_OPEN = 'true'; // should be ignored in production
    delete process.env.UPSTASH_REDIS_URL;

    const { checkRateLimit } = await import('../lib/rateLimiter');
    const allowed = await checkRateLimit({ headers: {}, socket: { remoteAddress: '1.1.1.1' } });
    expect(allowed).toBe(false);
  });
});
