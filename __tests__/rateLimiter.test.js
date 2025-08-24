const httpMocks = require('node-mocks-http');

describe('rate limiter behavior without Redis', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Simulate Redis being unavailable for all tests in this suite
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    // Set NODE_ENV to 'development' to bypass the 'test' escape hatch in the limiter
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    // Restore original environment after all tests have run
    process.env = originalEnv;
  });

  it('should allow requests when fail-open is explicitly enabled', async () => {
    process.env.RATE_LIMIT_FAIL_OPEN = 'true';
    const { checkRateLimit } = require('../lib/rateLimiter');
    const req = httpMocks.createRequest({ method: 'GET', socket: { remoteAddress: '1.1.1.1' } });
    await expect(checkRateLimit(req)).resolves.toBe(true);
  });

  it('should block requests when fail-open is explicitly disabled', async () => {
    process.env.RATE_LIMIT_FAIL_OPEN = 'false';
    const { checkRateLimit } = require('../lib/rateLimiter');
    const req = httpMocks.createRequest({ method: 'GET', socket: { remoteAddress: '1.1.1.1' } });
    await expect(checkRateLimit(req)).resolves.toBe(false);
  });

  it('should block requests by default when fail-open is not set', async () => {
    // Ensure fail-open flag is undefined for this scenario
    delete process.env.RATE_LIMIT_FAIL_OPEN;
    const { checkRateLimit } = require('../lib/rateLimiter');
    const req = httpMocks.createRequest({ method: 'GET', socket: { remoteAddress: '1.1.1.1' } });
    await expect(checkRateLimit(req)).resolves.toBe(false);
  });
});
