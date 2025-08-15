/** @jest-environment node */

describe('checkRateLimit', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.REDIS_URL;
    jest.resetModules();
  });

  it('throws on startup if REDIS_URL is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    await expect(import('../lib/rateLimiter')).rejects.toThrow('REDIS_URL not configured in production');
  });
});
