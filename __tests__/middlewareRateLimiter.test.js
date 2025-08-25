/** @jest-environment node */

const httpMocks = require('node-mocks-http');

describe('middleware rate limiter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.LOGTAIL_SOURCE_TOKEN;
    process.env.RATE_LIMIT_FAIL_OPEN = 'true';
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows requests and does not warn when Redis is unavailable and fail-open is true', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { applyRateLimit } = require('../middleware');
    const req = httpMocks.createRequest({ method: 'GET', socket: { remoteAddress: '1.1.1.1' } });
    const allowed = await applyRateLimit(req);
    expect(allowed).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
