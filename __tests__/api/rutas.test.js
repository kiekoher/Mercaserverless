/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/rutas');

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');

describe('rutas API', () => {
  let supabase;
  const VALID_UUID = '00000000-0000-0000-0000-000000000000';

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(),
    };
    createClient.mockReturnValue(supabase);
  });

  it('returns 401 if user not authenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows supervisors to get routes', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const mockRoutes = [{ id: 1, fecha: '2024-01-01', mercaderista_id: VALID_UUID, puntos_de_venta_ids: [1] }];
    supabase.range.mockResolvedValue({ data: mockRoutes, error: null, count: 1 });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json.data[0].id).toBe(1);
    expect(json.totalCount).toBe(1);
  });

  it('allows supervisors to create routes', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const newRoute = { fecha: '2024-01-01', mercaderistaId: VALID_UUID, puntosDeVentaIds: [1, 2] };
    const expectedData = { id: 1, ...newRoute };

    supabase.single.mockResolvedValue({ data: expectedData, error: null });

    const req = createMockReq('POST', newRoute);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res._getJSONData()).toEqual(expectedData);
  });

  it('allows supervisors to update routes', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const updatedRoute = { id: 1, fecha: '2024-01-02', mercaderistaId: VALID_UUID, puntosDeVentaIds: [3, 4] };

    supabase.single.mockResolvedValue({ data: updatedRoute, error: null });

    const req = createMockReq('PUT', updatedRoute);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(updatedRoute);
  });

  it('allows supervisors to delete routes', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    supabase.eq.mockResolvedValue({ error: null });

    const req = createMockReq('DELETE', {}, { id: '1' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
  });
});
