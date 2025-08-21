/** @jest-environment node */

describe('checkRateLimit', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.REDIS_URL;
    jest.resetModules();
  });

  it('blocks requests when REDIS_URL is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    // Explicitly delete both REDIS_URL and the fail-open override
    // to ensure we are testing the production default (fail-closed).
    delete process.env.REDIS_URL;
    delete process.env.RATE_LIMIT_FAIL_OPEN;

    const { checkRateLimit } = await import('../lib/rateLimiter');
    const allowed = await checkRateLimit({ headers: {}, socket: { remoteAddress: '1.1.1.1' } });
    expect(allowed).toBe(false);
  });
});
