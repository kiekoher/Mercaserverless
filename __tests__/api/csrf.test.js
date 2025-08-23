/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import { checkRateLimit } from '../../lib/rateLimiter';

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
  });

  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimit.mockResolvedValue(false);
    const { req, res } = createMocks();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(429);
  });
});
