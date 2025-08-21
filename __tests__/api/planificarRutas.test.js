import handler from '../../pages/api/planificar-rutas';
import { createMocks } from 'node-mocks-http';
import * as auth from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';

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
}));

describe('/api/planificar-rutas', () => {
  beforeEach(() => {
    // Reset mocks before each test
    auth.requireUser.mockResolvedValue({ user: { id: 'test-user-id' }, error: null });
    createClient().from().select().gt.mockClear();
    mockGt.mockClear();
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
        const weekNumber = Math.floor(day.getUTCDate() / 7);
        const currentLoad = weeklyWorkload.get(weekNumber) || 0;
        weeklyWorkload.set(weekNumber, currentLoad + route.totalMinutes);
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
});
