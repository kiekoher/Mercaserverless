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

describe('visitas API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 if user not authenticated', async () => {
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/visitas.js');
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows mercaderistas to create visits', async () => {
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
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
});
