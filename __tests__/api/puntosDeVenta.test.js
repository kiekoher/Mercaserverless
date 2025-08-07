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

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesServerClient: jest.fn(),
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
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
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
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
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

  it('allows supervisors to update points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
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
    const req = { method: 'PUT', body: { id: 1, nombre: 'N', direccion: 'D', ciudad: 'C' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('allows supervisors to delete points', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
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
