const { createMocks } = require('node-mocks-http');

const mockDirections = jest.fn().mockResolvedValue({
  data: { routes: [{ waypoint_order: [1, 0] }] },
});

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    directions: mockDirections,
  })),
}));
jest.mock('../../lib/rateLimiter');
jest.mock('../../lib/logger.server');
jest.mock('../../lib/auth');
jest.mock('../../lib/csrf');

describe('optimize-route API', () => {
  let handler, requireUser, checkRateLimit, verifyCsrf;

  beforeEach(() => {
    jest.resetModules();

    requireUser = require('../../lib/auth').requireUser;
    checkRateLimit = require('../../lib/rateLimiter').checkRateLimit;
    verifyCsrf = require('../../lib/csrf').verifyCsrf;
    handler = require('../../pages/api/optimize-route');

    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    requireUser.mockResolvedValue({ user: { id: 'u1' }, error: null });
    checkRateLimit.mockResolvedValue(true);
    verifyCsrf.mockReturnValue(true);
    mockDirections.mockClear();
  });

  it('returns 400 for invalid body', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { puntos: [] } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 for malformed points', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { puntos: [{ direccion: 'A' }, { direccion: 'B', ciudad: 'Y' }] },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('sanitizes addresses before calling Google Maps', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        puntos: [
          { id: 1, direccion: '<b>A</b>', ciudad: '<i>X</i>' },
          { id: 2, direccion: 'B', ciudad: 'Y' },
          { id: 3, direccion: 'C', ciudad: 'Z' },
        ],
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockDirections).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          origin: 'A, X, Colombia',
          waypoints: expect.arrayContaining(['optimize:true', 'B, Y, Colombia', 'C, Z, Colombia']),
        }),
      })
    );
  });

  it('passes the transport mode to Google Maps API', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        puntos: [
          { id: 1, direccion: 'A', ciudad: 'X' },
          { id: 2, direccion: 'B', ciudad: 'Y' },
        ],
        modo_transporte: 'walking',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(mockDirections).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          mode: 'walking',
        }),
      })
    );
  });
});
