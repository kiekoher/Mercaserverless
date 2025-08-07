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

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createPagesServerClient: jest.fn(),
}));

describe('mi-ruta API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 when unauthenticated', async () => {
    const { createPagesServerClient } = await import('@supabase/auth-helpers-nextjs');
    createPagesServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const { default: handler } = await import('../../pages/api/mi-ruta.js');
    const req = { method: 'GET' };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

