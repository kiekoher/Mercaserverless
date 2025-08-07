/** @jest-environment node */
import { jest } from '@jest/globals';

function createMockRes() {
  return {
    statusCode: 0,
    data: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
    end(payload){ this.data = payload; return this; }
  };
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesServerClient: jest.fn(),
}));

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({ geocode: jest.fn() })),
}));

jest.mock('p-limit', () => jest.fn(() => (fn) => fn));

describe('import-pdv API', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = 'key';
  });

  it.skip('returns 401 when unauthenticated', async () => {
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/import-pdv.js');
    const req = { method: 'POST', body: { puntos: [] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

