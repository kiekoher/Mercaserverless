/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import { checkRateLimit } from '../../lib/rateLimiter';

jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn() }));
jest.mock('../../lib/logger.server');

describe('/api/csp-report', () => {
  let handler;
  beforeEach(async () => {
    checkRateLimit.mockResolvedValue(true);
    ({ default: handler } = await import('../../pages/api/csp-report'));
  });

  it('accepts a valid report', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { 'csp-report': { 'violated-directive': 'img-src' } },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(204);
  });

  it('rejects invalid body', async () => {
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('rejects bodies that exceed size limit', async () => {
    const large = 'a'.repeat(2000);
    const { req, res } = createMocks({
      method: 'POST',
      body: { 'csp-report': { 'violated-directive': large } },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(413);
  });
});
