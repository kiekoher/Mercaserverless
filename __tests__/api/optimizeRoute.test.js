/** @jest-environment node */
import { jest } from '@jest/globals';

function createMockRes() {
  return {
    statusCode: 0,
    data: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
}

const mockDirections = jest.fn().mockResolvedValue({
  data: { routes: [{ waypoint_order: [1, 0] }] },
});

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    directions: mockDirections,
  })),
}));

jest.mock('../../lib/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
}));

jest.mock('../../lib/logger', () => ({
  default: { error: jest.fn() },
}));

jest.mock('../../lib/supabaseServer', () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock('../../lib/csrf', () => ({ verifyCsrf: jest.fn(() => true) }));

describe('optimize-route API', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = require('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { role: 'supervisor' } }) })
        })
      })
    });
  });

  it('returns 400 for invalid body', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = { method: 'POST', body: { puntos: [] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for malformed points', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = {
      method: 'POST',
      body: { puntos: [{ direccion: 'A' }, { direccion: 'B', ciudad: 'Y' }] },
    };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when id is not a number', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = {
      method: 'POST',
      body: { puntos: [{ id: 'a', direccion: 'A', ciudad: 'X' }, { id: 2, direccion: 'B', ciudad: 'Y' }] },
    };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('sanitizes addresses before calling Google Maps', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = {
      method: 'POST',
      body: {
        puntos: [
          { id: 1, direccion: '<b>A</b>', ciudad: '<i>X</i>' },
          { id: 2, direccion: 'B', ciudad: 'Y' },
          { id: 3, direccion: 'C', ciudad: 'Z' },
        ],
      },
    };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockDirections).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          origin: 'A, X, Colombia',
          waypoints: expect.arrayContaining(['optimize:true', 'B, Y, Colombia', 'C, Z, Colombia']),
        }),
      })
    );
  });
});

