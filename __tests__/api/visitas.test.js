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
jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

describe('visitas API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 if user not authenticated', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows mercaderistas to create visits', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'mercaderista' } })
              })
            })
          };
        }
        if (table === 'rutas') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { mercaderista_id: 'u1', puntos_de_venta_ids: [2] } })
              })
            })
          };
        }
        if (table === 'visitas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ single: () => Promise.resolve({ data: null }) })
                })
              })
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 1 } })
              })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = { method: 'POST', body: { ruta_id: 1, punto_de_venta_id: 2 } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.data.id).toBe(1);
  });

  it('prevents duplicate check-in for same point', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'mercaderista' } })
              })
            })
          };
        }
        if (table === 'rutas') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { mercaderista_id: 'u1', puntos_de_venta_ids: [2] } })
              })
            })
          };
        }
        if (table === 'visitas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({ single: () => Promise.resolve({ data: { id: 1 } }) })
                })
              })
            }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 1 } })
              })
            })
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = { method: 'POST', body: { ruta_id: 1, punto_de_venta_id: 2 } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
  });

  it('sanitizes observaciones on update', async () => {
    const selectBeforeUpdate = jest.fn().mockReturnValue({
      eq: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { check_out_at: null } }) })
      })
    });
    const updateMock = jest.fn().mockReturnValue({
      eq: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: {} })
          })
        })
      })
    });
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'mercaderista' } })
              })
            })
          };
        }
        if (table === 'visitas') {
          return { select: selectBeforeUpdate, update: updateMock };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = {
      method: 'PUT',
      body: { visita_id: 1, estado: 'Completada', observaciones: '<script>bad()</script>' }
    };
    const res = createMockRes();
    await handler(req, res);
    expect(updateMock).toHaveBeenCalled();
    const sent = updateMock.mock.calls[0][0];
    expect(sent.observaciones).toBe('');
  });

  it('prevents double check-out', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    const updateMock = jest.fn();
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: (table) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'mercaderista' } })
              })
            })
          };
        }
        if (table === 'visitas') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ single: () => Promise.resolve({ data: { check_out_at: 'now' } }) })
              })
            }),
            update: updateMock,
          };
        }
      }
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = { method: 'PUT', body: { visita_id: 1, estado: 'Completada' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
