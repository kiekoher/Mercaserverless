/** @jest-environment node */
import { jest } from '@jest/globals';

function createMockRes() {
  return {
    statusCode: 0,
    data: null,
    headers: {},
    setHeader(k,v){ this.headers[k]=v; },
    status(code){ this.statusCode=code; return this; },
    json(payload){ this.data=payload; return this; },
    end(payload){ this.data=payload; return this; }
  };
}

jest.mock('../../lib/supabaseServer', () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock('../../lib/csrf', () => ({ verifyCsrf: jest.fn(() => true) }));

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    geocode: jest.fn().mockResolvedValue({ data: { results: [] } }),
  })),
}));

describe('puntos-de-venta API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 if user not authenticated', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows supervisors to create points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'supervisor' } })
              })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 1 } })
              })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = { method: 'POST', body: { nombre: 'P', direccion: 'D', ciudad: 'C' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.data.id).toBe(1);
  });

  it('sanitizes input before inserting', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    let insertedPayload;
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'supervisor' } })
              })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return {
            insert: (payload) => {
              insertedPayload = payload;
              return {
                select: () => ({ single: () => Promise.resolve({ data: { id: 1 } }) })
              };
            }
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = { method: 'POST', body: { nombre: '<b>P</b>', direccion: '<i>D</i>', ciudad: 'C' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(insertedPayload.nombre).toBe('P');
    expect(insertedPayload.direccion).toBe('D');
  });

  it('denies access to mercaderistas', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u2' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ single: () => Promise.resolve({ data: { role: 'mercaderista' } }) })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = { method: 'GET', query: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('allows supervisors to update points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'supervisor' } })
              })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 1 } })
                })
              })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = {
      method: 'PUT',
      body: {
        id: 1,
        nombre: 'N',
        direccion: 'D',
        ciudad: 'C',
        cuota: '',
        tipologia: '',
        frecuencia_mensual: '',
        minutos_servicio: '',
      }
    };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('allows supervisors to delete points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'supervisor' } })
              })
            })
          };
        }
        if (table === 'puntos_de_venta') {
          return {
            delete: () => ({
              eq: () => ({
                error: null
              })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/puntos-de-venta.js');
    const req = { method: 'DELETE', query: { id: '1' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
