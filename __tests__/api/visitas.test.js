/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/visitas').default;

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');

describe('visitas API', () => {
  let supabase;

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    createClient.mockReturnValue(supabase);
  });

  it('returns 401 if user not authenticated', async () => {
    // Correctly mock the return object with the 'error' key
    requireUser.mockResolvedValue({
      error: { status: 401, message: 'Unauthorized' },
      user: null,
      role: null,
      supabase: null,
    });
    const req = createMockReq('POST');
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 if user is not a mercaderista for POST', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const req = createMockReq('POST');
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._getJSONData()).toEqual({ error: 'Solo los mercaderistas pueden registrar visitas.' });
  });

  it('allows mercaderistas to create (check-in) visits', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'mercaderista', supabase });

    // 1. Nueva lógica de validación: consulta a 'ruta_pdv'
    supabase.from.mockReturnValueOnce(supabase); // from('ruta_pdv')
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase); // eq('ruta_id', ...)
    supabase.eq.mockReturnValueOnce(supabase); // eq('pdv_id', ...)
    supabase.single.mockResolvedValueOnce({
      data: { id: 1, rutas: { mercaderista_id: 'u1' } }, // Devuelve el owner correcto
      error: null
    });

    // 2. Check for existing active visit
    supabase.from.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.is.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: null, error: null });

    // 3. Insert the new visit
    supabase.from.mockReturnValueOnce(supabase);
    supabase.insert.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: { id: 99, estado: 'En Progreso' }, error: null });

    const req = createMockReq('POST', { ruta_id: 1, punto_de_venta_id: 2 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res._getJSONData()).toEqual({ id: 99, estado: 'En Progreso' });
  });

  it('prevents duplicate check-in for the same point', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'mercaderista', supabase });

    // 1. Nueva lógica de validación: consulta a 'ruta_pdv'
    supabase.from.mockReturnValueOnce(supabase); // from('ruta_pdv')
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase); // eq('ruta_id', ...)
    supabase.eq.mockReturnValueOnce(supabase); // eq('pdv_id', ...)
    supabase.single.mockResolvedValueOnce({
      data: { id: 1, rutas: { mercaderista_id: 'u1' } },
      error: null
    });

    supabase.from.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.is.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: { id: 1 }, error: null }); // Existing visit found

    const req = createMockReq('POST', { ruta_id: 1, punto_de_venta_id: 2 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res._getJSONData()).toEqual({ error: 'Visita ya iniciada para este punto' });
  });

  it('allows mercaderistas to update (check-out) visits', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'mercaderista', supabase });

    supabase.from.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: { id: 1, check_out_at: null }, error: null });

    supabase.from.mockReturnValueOnce(supabase);
    supabase.update.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: { id: 1, estado: 'Completada' }, error: null });

    const req = createMockReq('PUT', { visita_id: 1, estado: 'Completada', observaciones: 'Test' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ id: 1, estado: 'Completada' });
  });

  it('prevents double check-out', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'mercaderista', supabase });

    supabase.from.mockReturnValueOnce(supabase);
    supabase.select.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.eq.mockReturnValueOnce(supabase);
    supabase.single.mockResolvedValueOnce({ data: { id: 1, check_out_at: '2024-01-01T12:00:00Z' }, error: null });

    const req = createMockReq('PUT', { visita_id: 1, estado: 'Completada' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Visita ya finalizada' });
    expect(supabase.update).not.toHaveBeenCalled();
  });
});
