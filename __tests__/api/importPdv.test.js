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

jest.mock('../../lib/supabaseServer', () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock('../../lib/csrf', () => ({ verifyCsrf: jest.fn(() => true) }));

const mockGeocode = jest.fn();
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({ geocode: mockGeocode })),
}));

jest.mock('p-limit', () => jest.fn(() => (fn) => fn()));

describe('import-pdv API', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_MAPS_API_KEY = 'key';
  });

  it('returns 401 when unauthenticated', async () => {
      const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
      getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/import-pdv.js');
    const req = { method: 'POST', body: { puntos: [] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('sanitizes each imported point', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    let inserted;
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { role: 'supervisor' } }) })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return {
            insert: (arr) => {
              inserted = arr;
              return { error: null };
            }
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/import-pdv.js');
    const req = { method: 'POST', body: { puntos: [{ nombre: '<b>N</b>', direccion: '<i>D</i>', ciudad: 'C' }] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(inserted[0].nombre).toBe('N');
    expect(inserted[0].direccion).toBe('D');
  });

  it('sanitizes address before geocoding', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    mockGeocode.mockResolvedValue({ data: { results: [] } });
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { role: 'supervisor' } }) })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return { insert: () => ({ error: null }) };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/import-pdv.js');
    const req = { method: 'POST', body: { puntos: [{ nombre: 'N', direccion: '<b>D</b>', ciudad: '<i>C</i>' }] } };
    const res = createMockRes();
    await handler(req, res);
    expect(mockGeocode).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ address: 'D, C, Colombia' })
      })
    );
  });
});

