import { createMocks } from 'node-mocks-http';
import * as auth from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_KEY = 'service-key';

// Mock auth middleware
jest.mock('../../lib/auth');

// Mock Supabase client
const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
  })),
}));

// Mock logger
jest.mock('../../lib/logger.server');
jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

describe('/api/dashboard-projections', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    auth.requireUser.mockResolvedValue({ user: { id: 'test-user' }, error: null });
  });

  it('should return 405 if method is not GET', async () => {
    const { default: handler } = await import('../../pages/api/dashboard-projections');
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should return projection data successfully', async () => {
    const { default: handler } = await import('../../pages/api/dashboard-projections');
    const mockWorkloadData = [
      { mercaderista_id: 'uuid1', mercaderista_nombre: 'Test User 1', total_horas: 35 },
      { mercaderista_id: 'uuid2', mercaderista_nombre: 'Test User 2', total_horas: 45 },
    ];
    const mockFrequencyData = [{ total_required_visits: 100, total_planned_visits: 80 }];

    mockRpc
      .mockResolvedValueOnce({ data: mockWorkloadData, error: null }) // for get_weekly_workload
      .mockResolvedValueOnce({ data: mockFrequencyData, error: null }); // for get_frequency_compliance

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();

    expect(data.workload).toEqual([
      { mercaderista: 'Test User 1', hours: 35 },
      { mercaderista: 'Test User 2', hours: 45 },
    ]);
    expect(data.frequency).toEqual({
      planned: 80,
      required: 100,
      percentage: '80.0',
    });
    expect(mockRpc).toHaveBeenCalledWith('get_weekly_workload');
    expect(mockRpc).toHaveBeenCalledWith('get_frequency_compliance');
  });

  it('should handle database errors gracefully', async () => {
    const { default: handler } = await import('../../pages/api/dashboard-projections');
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData().error).toBe('Failed to fetch projection data');
  });
});
