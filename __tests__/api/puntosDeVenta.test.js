/** @jest-environment node */
let createClient;
let requireUser;
const { createMockReq, createMockRes } = require('../../lib/test-utils');
let geocodeAddress;
let getCacheClient;

let handler;

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');
jest.mock('../../lib/geocode');
jest.mock('../../lib/redisCache');

describe('puntos-de-venta API', () => {
  let supabase;
  let mockRedisClient;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    ({ createClient } = require('@supabase/supabase-js'));
    ({ requireUser } = require('../../lib/auth'));
    ({ geocodeAddress } = require('../../lib/geocode'));
    ({ getCacheClient } = require('../../lib/redisCache'));

    process.env.GOOGLE_MAPS_API_KEY = 'test-key';

    supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    };
    createClient.mockReturnValue(supabase);

    geocodeAddress.mockResolvedValue({ lat: 4.60971, lng: -74.08175 });

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    getCacheClient.mockReturnValue(mockRedisClient);

    handler = require('../../pages/api/puntos-de-venta').rawHandler;
  });

  it('returns 401 if user not authenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const req = createMockReq('POST', { nombre: 'P', direccion: 'D', ciudad: 'C' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('allows supervisors to create points and uses geocoding', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const newPdv = { nombre: 'PDV Test', direccion: 'Calle Falsa 123', ciudad: 'Bogota' };

    const req = createMockReq('POST', newPdv);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(geocodeAddress).toHaveBeenCalled();
  });

  it('allows supervisors to update points', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    const updatedPdv = {
      id: 1,
      nombre: 'Updated PDV',
      direccion: 'Calle Real 456',
      ciudad: 'Bogota',
      cuota: null,
      tipologia: null,
      frecuencia_mensual: null,
      minutos_servicio: null,
    };

    const req = createMockReq('PUT', updatedPdv);
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('allows supervisors to delete points', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    supabase.eq.mockResolvedValue({ error: null });

    const req = createMockReq('DELETE', {}, { id: '1' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
  });
});
