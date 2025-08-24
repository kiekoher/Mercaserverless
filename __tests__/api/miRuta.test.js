/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/mi-ruta');

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');

describe('mi-ruta API', () => {
  let supabase;

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = {
      rpc: jest.fn(),
    };
    createClient.mockReturnValue(supabase);
  });

  it('returns 401 when unauthenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns the route for an authenticated mercaderista', async () => {
    const mockUser = { id: 'user-mercaderista' };
    const mockRoute = { id: 1, fecha: '2025-08-18', puntos: [{ id: 1, nombre: 'Punto 1' }] };
    requireUser.mockResolvedValue({ user: mockUser, role: 'mercaderista', supabase });
    supabase.rpc.mockResolvedValue({ data: mockRoute, error: null });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(mockRoute);
    expect(supabase.rpc).toHaveBeenCalledWith('get_todays_route_for_user', {
      p_user_id: String(mockUser.id),
    });
  });

  it('returns 404 if no route is found', async () => {
    const mockUser = { id: 'user-mercaderista' };
    requireUser.mockResolvedValue({ user: mockUser, role: 'mercaderista', supabase });
    supabase.rpc.mockResolvedValue({ data: null, error: null }); // No data returned

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });
});
