/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/dashboard-stats');
const { getCacheClient } = require('../../lib/redisCache');

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');
jest.mock('../../lib/redisCache');

describe('dashboard-stats API', () => {
  let supabase;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();

    supabase = {
      rpc: jest.fn(),
    };
    createClient.mockReturnValue(supabase);

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    getCacheClient.mockReturnValue(mockRedisClient);
  });

  it('returns 401 when unauthenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when authenticated as mercaderista', async () => {
    requireUser.mockResolvedValue({ error: { status: 403, message: 'Forbidden' } });
    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it('returns data from RPC for supervisor', async () => {
    const mockStats = { total_users: 10 };
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    supabase.rpc.mockResolvedValue({ data: mockStats, error: null });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(mockStats);
  });

  it('returns data from cache if available', async () => {
    const mockStats = { total_users: 20 };
    mockRedisClient.get.mockResolvedValue(JSON.stringify(mockStats));
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'admin', supabase });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual(mockStats);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
