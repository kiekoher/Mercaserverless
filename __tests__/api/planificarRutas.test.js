const { createMocks } = require('node-mocks-http');

// Mock dependencies first
jest.mock('../../lib/auth');
jest.mock('../../lib/logger.server');
jest.mock('../../lib/rateLimiter');

const mockRpc = jest.fn();
const mockGt = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        gt: mockGt,
        rpc: mockRpc,
    })),
}));

describe('/api/planificar-rutas', () => {
  let handler;
  let auth, rateLimiter, logger;

  beforeEach(() => {
    jest.resetModules();

    auth = require('../../lib/auth');
    rateLimiter = require('../../lib/rateLimiter');
    logger = require('../../lib/logger.server');

    auth.requireUser.mockResolvedValue({ user: { id: 'test-user-id' }, error: null });
    rateLimiter.checkRateLimit.mockResolvedValue(true);

    mockGt.mockClear();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({ error: null });

    const planificarRutasModule = require('../../pages/api/planificar-rutas');
    handler = planificarRutasModule; // The default export
  });

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 for invalid body parameters', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { mercaderistaId: '123' },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toBe('Parámetros inválidos.');
  });

  it('should return 404 if no points of sale are found', async () => {
    mockGt.mockImplementationOnce(() => ({
        gt: jest.fn().mockResolvedValue({ data: [], error: null })
    }));
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it('should return 200 with a plan summary', async () => {
    const mockPuntos = [
      { id: 1, nombre: 'Punto A', frecuencia_mensual: 4, minutos_servicio: 30 },
      { id: 2, nombre: 'Punto B', frecuencia_mensual: 2, minutos_servicio: 45 },
    ];
    mockGt.mockImplementationOnce(() => ({
        gt: jest.fn().mockResolvedValue({ data: mockPuntos, error: null })
    }));
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(data.message).toContain('generada y guardada con éxito');
    expect(data.summary.totalVisitsToPlan).toBe(6);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('should return 500 if saving planned routes fails', async () => {
    const mockPuntos = [
      { id: 1, nombre: 'Punto A', frecuencia_mensual: 1, minutos_servicio: 30 },
    ];
    mockGt.mockImplementationOnce(() => ({
      gt: jest.fn().mockResolvedValue({ data: mockPuntos, error: null })
    }));
    mockRpc.mockResolvedValueOnce({ error: { message: 'rpc failed' } });
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(500);
  });
});
