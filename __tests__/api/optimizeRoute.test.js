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

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    directions: jest.fn().mockResolvedValue({
      data: { routes: [{ waypoint_order: [1, 0] }] },
    }),
  })),
}));

jest.mock('../../lib/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
}));

jest.mock('../../lib/logger', () => ({
  default: { error: jest.fn() },
}));

describe('optimize-route API', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  });

  it('returns 400 for invalid body', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = { method: 'POST', body: { puntos: [] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns optimized route', async () => {
    const { default: handler } = await import('../../pages/api/optimize-route.js');
    const req = {
      method: 'POST',
      body: {
        puntos: [
          { direccion: 'A', ciudad: 'X' },
          { direccion: 'B', ciudad: 'Y' },
          { direccion: 'C', ciudad: 'Z' },
        ],
      },
    };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.data.optimizedPuntos.length).toBe(3);
    expect(res.data.optimizedPuntos[1].direccion).toBe('C');
  });
});

