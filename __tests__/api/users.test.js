/** @jest-environment node */
import { jest } from '@jest/globals';

function createMockRes() {
  return {
    statusCode: 0,
    data: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
    end(payload){ this.data = payload; return this; }
  };
}

jest.mock('../../lib/supabaseServer', () => ({
  getSupabaseServerClient: jest.fn(),
}));

describe('users API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/users.js');
    const req = { method: 'GET' };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when role is invalid', async () => {
    const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { role: 'admin' } }) })
        })
      })
    });
    const { default: handler } = await import('../../pages/api/users.js');
    const req = { method: 'PUT', body: { userId: 'u2', newRole: 'invalid' } };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

