/** @jest-environment node */
const { createClient } = require('@supabase/supabase-js');
const { requireUser } = require('../../lib/auth');
const { createMockReq, createMockRes } = require('../../lib/test-utils');
const { rawHandler: handler } = require('../../pages/api/users');

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
      order: jest.fn(),
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
    supabase.order.mockResolvedValue({ data: [{ id: 'u2', full_name: 'Test User', role: 'mercaderista' }], count: 1, error: null });

    const req = createMockReq('GET');
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json.data.length).toBe(1);
    expect(json.totalCount).toBe(1);
  });

  it('updates a user role for admin', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'admin', supabase });
    const updatedUser = { id: 'u2', full_name: 'Test User', role: 'supervisor' };
    supabase.single.mockResolvedValue({ data: updatedUser, error: null });

    const req = createMockReq('PUT', { userId: '00000000-0000-0000-0000-000000000000', newRole: 'supervisor' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().role).toBe('supervisor');
  });

  it('returns 400 for invalid role on update', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1' }, role: 'admin', supabase });
    const req = createMockReq('PUT', { userId: '00000000-0000-0000-0000-000000000000', newRole: 'invalid-role' });
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
