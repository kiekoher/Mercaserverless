/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/users').default;

jest.mock('../../lib/auth');
jest.mock('@supabase/supabase-js');

describe('users API', () => {
  let supabase;

  beforeEach(() => {
    jest.clearAllMocks();
    supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    createClient.mockReturnValue(supabase);
  });

  it('returns 401 when unauthenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns a list of users for admin', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'admin', supabase });
    supabase.range.mockResolvedValue({ data: [{ id: 'u2', full_name: 'Test User', role: 'mercaderista' }], count: 1, error: null });

    const req = createMockReq('GET', undefined, { page: '1', pageSize: '10' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json.data.length).toBe(1);
    expect(json.totalCount).toBe(1);
  });

  it('returns a list of users for supervisor', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'supervisor', supabase });
    supabase.range.mockResolvedValue({ data: [{ id: 'u2', full_name: 'Test User', role: 'mercaderista' }], count: 1, error: null });

    const req = createMockReq('GET', undefined, { page: '1', pageSize: '10' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json.data.length).toBe(1);
    expect(json.totalCount).toBe(1);
  });

  it('returns 405 for non-GET methods', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'admin', supabase });
    const req = createMockReq('PUT', { userId: 'u2', newRole: 'supervisor' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
