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
      rpc: jest.fn(), // Añadimos el mock para rpc
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
    // Mock data con la nueva estructura anidada
    const mockRoutes = [{
      id: 1,
      fecha: '2024-01-01',
      mercaderista_id: VALID_UUID,
      profiles: { full_name: 'Test User' },
      ruta_pdv: [
        { puntos_de_venta: { id: 101, nombre: 'PDV A' } },
        { puntos_de_venta: { id: 102, nombre: 'PDV B' } }
      ]
    }];
    supabase.range.mockResolvedValue({ data: mockRoutes, error: null, count: 1 });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json.data[0].id).toBe(1);
    expect(json.data[0].mercaderista_name).toBe('Test User');
    expect(json.data[0].puntos_de_venta).toHaveLength(2);
    expect(json.data[0].puntos_de_venta[0].nombre).toBe('PDV A');
    expect(json.totalCount).toBe(1);
  });

  it('allows supervisors to create routes via RPC', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    // El payload ahora usa pdvIds
    const newRoute = { fecha: '2024-01-01', mercaderistaId: VALID_UUID, pdvIds: [1, 2] };
    const expectedData = [{ id: 1, fecha: '2024-01-01', mercaderista_id: VALID_UUID }];

    // Mockeamos la llamada a rpc
    supabase.rpc.mockResolvedValue({ data: expectedData, error: null });

    const req = createMockReq('POST', newRoute);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(supabase.rpc).toHaveBeenCalledWith('create_or_update_route', {
      p_ruta_id: null,
      p_fecha: newRoute.fecha,
      p_mercaderista_id: newRoute.mercaderistaId,
      p_pdv_ids: newRoute.pdvIds,
    });
    expect(res._getJSONData()).toEqual(expectedData);
  });

  it('allows supervisors to update routes via RPC', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    // El payload ahora usa pdvIds
    const updatedRoute = { id: 1, fecha: '2024-01-02', mercaderistaId: VALID_UUID, pdvIds: [3, 4] };
    const expectedData = [{ id: 1, fecha: '2024-01-02', mercaderista_id: VALID_UUID }];

    // Mockeamos la llamada a rpc
    supabase.rpc.mockResolvedValue({ data: expectedData, error: null });

    const req = createMockReq('PUT', updatedRoute);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith('create_or_update_route', {
      p_ruta_id: updatedRoute.id,
      p_fecha: updatedRoute.fecha,
      p_mercaderista_id: updatedRoute.mercaderistaId,
      p_pdv_ids: updatedRoute.pdvIds,
    });
    expect(res._getJSONData()).toEqual(expectedData);
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
