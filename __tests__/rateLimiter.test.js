/** @jest-environment node */

describe('checkRateLimit', () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_URL;
    jest.resetModules();
  });

  it('uses in-memory fallback when Redis is unavailable', async () => {
    const { checkRateLimit } = await import('../lib/rateLimiter');
    const req = { headers: {}, socket: { remoteAddress: '1.1.1.1' } };
    expect(await checkRateLimit(req, { limit: 1 })).toBe(true);
    expect(await checkRateLimit(req, { limit: 1 })).toBe(false);
  });

  it('falls back when Redis command fails', async () => {
    process.env.UPSTASH_REDIS_URL = 'redis://localhost:6379';
    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => ({
        status: 'ready',
        multi() {
          return {
            incr() { return this; },
            pexpire() { return this; },
            exec() { throw new Error('fail'); },
          };
        },
        on: jest.fn(),
        quit: jest.fn(),
      }));
    });
    const { checkRateLimit } = await import('../lib/rateLimiter');
    const req = { headers: {}, socket: { remoteAddress: '2.2.2.2' } };
    expect(await checkRateLimit(req, { limit: 1 })).toBe(true);
    expect(await checkRateLimit(req, { limit: 1 })).toBe(false);
  });

  it('degrades when Redis returns null', async () => {
    process.env.UPSTASH_REDIS_URL = 'redis://localhost:6379';
    jest.doMock('ioredis', () => {
      return jest.fn().mockImplementation(() => ({
        status: 'ready',
        multi() {
          return {
            incr() { return this; },
            exec() { return null; },
          };
        },
        on: jest.fn(),
        quit: jest.fn(),
        pexpire: jest.fn(),
      }));
    });
    const { checkRateLimit } = await import('../lib/rateLimiter');
    const req = { headers: {}, socket: { remoteAddress: '3.3.3.3' } };
    expect(await checkRateLimit(req, { limit: 1 })).toBe(true);
    expect(await checkRateLimit(req, { limit: 1 })).toBe(false);
  });
});
