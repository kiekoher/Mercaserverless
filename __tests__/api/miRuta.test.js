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

describe('mi-ruta API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/mi-ruta.js');
    const req = { method: 'GET' };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns the route for an authenticated mercaderista', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    const { requireUser } = await import('../../lib/auth');

    function createMockRes() {
      return {
        statusCode: 0,
        data: null,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.data = payload; return this; }
      };
    }

    const mockUser = { id: 'user-mercaderista', role: 'mercaderista' };
    const mockRoute = { id: 1, fecha: '2025-08-18', puntos: [{ id: 1, nombre: 'Punto 1' }] };

    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { role: 'mercaderista' } })
          })
        })
      }),
      rpc: jest.fn().mockResolvedValue({ data: mockRoute, error: null }),
    });

    const { default: handler } = await import('../../pages/api/mi-ruta.js');
    const req = { method: 'GET' };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual(mockRoute);

    // We need to get the Supabase client instance that the handler would have used
    const supaClient = getSupabaseServerClient(req, res);
    expect(supaClient.rpc).toHaveBeenCalledWith('get_todays_route_for_user', { p_user_id: String(mockUser.id) });
  });
});

