import handler from '../../pages/api/planificar-rutas';
import { createMocks } from 'node-mocks-http';
import * as auth from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';
import { getISOWeek, getISOWeekYear } from 'date-fns';

// Mock the auth middleware
jest.mock('../../lib/auth');

// This is the mock for the 'gt' function that will be chained
const mockGt = jest.fn();

// Mock the entire Supabase client factory
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        gt: mockGt, // The first call to gt returns the mock function
      })),
    })),
  })),
}));

// Mock the logger to prevent console noise
jest.mock('../../lib/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
}));

jest.mock('../../lib/csrf', () => ({ verifyCsrf: jest.fn(() => true) }));
jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

describe('/api/planificar-rutas', () => {
  beforeEach(() => {
    // Reset mocks before each test
    auth.requireUser.mockResolvedValue({ user: { id: 'test-user-id' }, error: null });
    createClient().from().select().gt.mockClear();
    mockGt.mockClear();
    verifyCsrf.mockReturnValue(true);
    checkRateLimit.mockResolvedValue(true);
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
    expect(data.message).toBe('Planificación generada con éxito.');
    expect(data.plan.summary.totalVisitsToPlan).toBe(6);
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
    const { plan } = res._getJSONData();

    // 1. Check summary values
    expect(plan.summary.totalVisitsToPlan).toBe(26);
    expect(plan.summary.totalVisitsPlanned).toBeLessThanOrEqual(26);

    // 2. Check daily constraints
    const DAILY_LIMIT = 8 * 60;
    plan.dailyRoutes.forEach(route => {
        expect(route.totalMinutes).toBeLessThanOrEqual(DAILY_LIMIT);
    });

    // 3. Check weekly constraints
    const WEEKLY_LIMIT = 40 * 60;
    const weeklyWorkload = new Map();
    plan.dailyRoutes.forEach(route => {
        const day = new Date(route.date + 'T00:00:00Z');
        const weekKey = `${getISOWeekYear(day)}-${getISOWeek(day)}`;
        const currentLoad = weeklyWorkload.get(weekKey) || 0;
        weeklyWorkload.set(weekKey, currentLoad + route.totalMinutes);
    });

    for (const [week, load] of weeklyWorkload.entries()) {
        expect(load).toBeLessThanOrEqual(WEEKLY_LIMIT);
    }

    // 4. Check that a difficult-to-place visit might be unplanned
    const totalMinutesPlanned = plan.dailyRoutes.reduce((acc, r) => acc + r.totalMinutes, 0);
    const totalMinutesPossible = mockPuntos.reduce((acc, p) => acc + (p.frecuencia_mensual * p.minutos_servicio), 0);
    // Given the constraints, it's likely the 241-minute visit wasn't scheduled.
    if (plan.summary.totalVisitsPlanned < plan.summary.totalVisitsToPlan) {
        expect(totalMinutesPlanned).toBeLessThan(totalMinutesPossible);
    }
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
    const { plan } = res._getJSONData();
    const weeks = new Set(plan.dailyRoutes.map(r => {
      const d = new Date(r.date + 'T00:00:00Z');
      return `${getISOWeekYear(d)}-${getISOWeek(d)}`;
    }));
    expect(weeks.size).toBeGreaterThan(1);
  });

  it('should return 403 when CSRF validation fails', async () => {
    verifyCsrf.mockImplementationOnce((req, res) => {
      res.status(403).json({});
      return false;
    });
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
  });

  it('should return 429 when rate limit exceeded', async () => {
    checkRateLimit.mockResolvedValueOnce(false);
    const { req, res } = createMocks({ method: 'POST', body: { mercaderistaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', startDate: '2024-01-01', endDate: '2024-01-31' } });
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
});
