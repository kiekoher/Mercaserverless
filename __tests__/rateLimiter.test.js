const httpMocks = require('node-mocks-http');

describe('rate limiter fail open', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('allows requests when Redis is unavailable and fail open', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    const { checkRateLimit } = require('../lib/rateLimiter');
    const req = httpMocks.createRequest({ method: 'GET' });
    req.socket = { remoteAddress: '1.1.1.1' };
    await expect(checkRateLimit(req)).resolves.toBe(true);
  });

  it('blocks when fail open is disabled', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', RATE_LIMIT_FAIL_OPEN: 'false' };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    const { checkRateLimit } = require('../lib/rateLimiter');
    const req = httpMocks.createRequest({ method: 'GET' });
    req.socket = { remoteAddress: '1.1.1.1' };
    await expect(checkRateLimit(req)).resolves.toBe(false);
  });
});
