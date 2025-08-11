/** @jest-environment node */

describe('checkRateLimit', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.REDIS_URL;
    jest.resetModules();
  });

  it('rejects requests in production when Redis is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    jest.resetModules();
    const { checkRateLimit } = await import('../lib/rateLimiter');
    const allowed = await checkRateLimit({ headers: {}, socket: { remoteAddress: '1.1.1.1' } });
    expect(allowed).toBe(false);
  });
});
