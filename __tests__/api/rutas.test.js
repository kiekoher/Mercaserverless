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

describe('rutas API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 if user not authenticated', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/rutas.js');
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows supervisors to create routes', async () => {
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
        if (table === 'rutas') {
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
    const { default: handler } = await import('../../pages/api/rutas.js');
    const req = { method: 'POST', body: { fecha: '2024-01-01', mercaderistaId: '00000000-0000-0000-0000-000000000000', puntosDeVentaIds: [1] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.data.id).toBe(1);
  });

  it('allows supervisors to update routes', async () => {
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
        if (table === 'rutas') {
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
    const { default: handler } = await import('../../pages/api/rutas.js');
    const req = { method: 'PUT', body: { id: 1, fecha: '2024-01-01', mercaderistaId: '00000000-0000-0000-0000-000000000000', puntosDeVentaIds: [1] } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('allows supervisors to delete routes', async () => {
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
        if (table === 'rutas') {
          return {
            delete: () => ({
              eq: () => ({ error: null })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/rutas.js');
    const req = { method: 'DELETE', query: { id: '1' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
