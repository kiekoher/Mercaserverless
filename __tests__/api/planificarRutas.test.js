import { createMocks } from 'node-mocks-http';
import * as auth from '../../lib/auth';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';
import { getISOWeek, getISOWeekYear } from 'date-fns';

// Mock dependencies first
jest.mock('../../lib/auth');
jest.mock('../../lib/logger.server', () => ({ error: jest.fn(), warn: jest.fn() }));
jest.mock('../../lib/csrf', () => ({ verifyCsrf: jest.fn(() => true) }));
jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

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
  let auth, csrf, rateLimiter;

  beforeEach(() => {
    jest.resetModules();

    // Re-require the mocked modules to configure them
    auth = require('../../lib/auth');
    csrf = require('../../lib/csrf');
    rateLimiter = require('../../lib/rateLimiter');

    // Set default mock implementations for every test
    auth.requireUser.mockResolvedValue({ user: { id: 'test-user-id' }, error: null });
    csrf.verifyCsrf.mockReturnValue(true);
    rateLimiter.checkRateLimit.mockResolvedValue(true);

    mockGt.mockClear();
    mockRpc.mockClear();
    mockRpc.mockResolvedValue({ error: null });

    // Load the handler
    handler = require('../../pages/api/planificar-rutas').default;
  });

  it('should return 405 if method is not POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 for invalid body parameters', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { mercaderistaId: '123' }, // Missing dates
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().error).toBe('Parámetros inválidos.');
  });

  it('should return 404 if no points of sale are found', async () => {
    // The second call to gt resolves the promise with empty data
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
    // The second call to gt resolves with the mock data
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
    expect(mockRpc).toHaveBeenCalledWith('bulk_insert_planned_routes', expect.any(Object));
  });

  it('should generate a detailed daily plan respecting constraints', async () => {
    const mockPuntos = [
        // Total weekly minutes: (20 * 120) + (1 * 241) = 2400 + 241 = 2641. Should not fit.
        { id: 1, nombre: 'Punto A', frecuencia_mensual: 20, minutos_servicio: 120 }, // High frequency, 2 hours
        { id: 2, nombre: 'Punto B', frecuencia_mensual: 1, minutos_servicio: 241 }, // Just over 4 hours, will be hard to place
        { id: 3, nombre: 'Punto C', frecuencia_mensual: 5, minutos_servicio: 60 }, // 1 hour
    ];
    mockGt.mockImplementationOnce(() => ({
        gt: jest.fn().mockResolvedValue({ data: mockPuntos, error: null })
    }));

    const { req, res } = createMocks({
        method: 'POST',
        body: {
            mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            startDate: '2024-08-01', // A month with known working days
            endDate: '2024-08-31',
        },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const { summary } = res._getJSONData();

    // Just check the summary values, as the full plan is not returned.
    expect(summary.totalVisitsToPlan).toBe(26);
    expect(summary.totalVisitsPlanned).toBeLessThanOrEqual(26);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('should handle week transitions across year boundaries', async () => {
    const mockPuntos = [
      { id: 1, nombre: 'Punto A', frecuencia_mensual: 50, minutos_servicio: 60 },
    ];
    mockGt.mockImplementationOnce(() => ({
      gt: jest.fn().mockResolvedValue({ data: mockPuntos, error: null })
    }));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-12-23',
        endDate: '2025-01-05',
      },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const { summary } = res._getJSONData();
    expect(summary.workingDays).toBeGreaterThan(5); // Check that it found working days in both weeks
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('should return 403 when CSRF validation fails', async () => {
    // This mock needs to simulate the real function's behavior of setting the response code
    csrf.verifyCsrf.mockImplementation((req, res) => {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return false;
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
  });

  it('should return 429 when rate limit exceeded', async () => {
    rateLimiter.checkRateLimit.mockResolvedValue(false);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(429);
  });

  it('should handle cases where no visits can be scheduled', async () => {
    const mockPuntos = [
      // All points have service time greater than the daily limit of 480 minutes
      { id: 1, nombre: 'Impossible Point A', frecuencia_mensual: 1, minutos_servicio: 500 },
      { id: 2, nombre: 'Impossible Point B', frecuencia_mensual: 1, minutos_servicio: 600 },
    ];
    mockGt.mockImplementationOnce(() => ({
        gt: jest.fn().mockResolvedValue({ data: mockPuntos, error: null })
    }));

    const { req, res } = createMocks({
        method: 'POST',
        body: {
            mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            startDate: '2024-08-01',
            endDate: '2024-08-31',
        },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const { plan } = res._getJSONData();

    expect(plan.summary.totalVisitsToPlan).toBe(2);
    expect(plan.summary.totalVisitsPlanned).toBe(0);
    expect(plan.dailyRoutes.length).toBe(0);
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
