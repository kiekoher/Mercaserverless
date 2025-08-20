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
    expect(data.plan.summary.estimatedTotalHours).toBe('3.50');
  });
});
