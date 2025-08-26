/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import { checkRateLimit } from '../../lib/rateLimiter';
import { fetchWithCsrf } from '../../lib/fetchWithCsrf';

jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn() }));

describe('/api/csrf', () => {
  let handler;
  beforeEach(async () => {
    checkRateLimit.mockResolvedValue(true);
    ({ default: handler } = await import('../../pages/api/csrf'));
  });

  it('returns a token when within rate limit', async () => {
    const { req, res } = createMocks();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toHaveProperty('csrfToken');
    expect(res.getHeader('Cache-Control')).toBe('no-store');
  });

  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimit.mockResolvedValue(false);
    const { req, res } = createMocks();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(429);
  });

  it('returns 405 for non-GET methods', async () => {
    const token = 'test-token';
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-csrf-token': token,
        'cookie': `csrf-secret=${token}`,
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
    expect(res.getHeader('Allow')).toBe('GET');
  });

  it('refreshes token on 403 response', async () => {
    const setToken = jest.fn();
    let called = 0;
    global.fetch = jest.fn((url) => {
      called += 1;
      if (url === '/api/csrf') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ csrfToken: 'new' }) });
      }
      if (called === 1) {
        return Promise.resolve({ status: 403, clone: () => ({ json: () => Promise.resolve({ error: 'csrf' }) }) });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
    await fetchWithCsrf('/test', { method: 'POST' }, 'old', setToken);
    expect(setToken).toHaveBeenCalledWith('new');
  });
});
