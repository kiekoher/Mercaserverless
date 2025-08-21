/** @jest-environment node */
import { jest } from '@jest/globals';

function createMockRes() {
  return {
    statusCode: 0,
    data: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; }
  };
}

jest.mock('../../lib/supabaseServer', () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock('../../lib/logger.server', () => ({
  error: jest.fn()
}));

const mockPing = jest.fn().mockResolvedValue('PONG');
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockPing,
    on: jest.fn(),
  }));
});

describe('health API', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { getSupabaseServerClient } = require('../../lib/supabaseServer');
    getSupabaseServerClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({}) }
    });
  });

  it('reuses redis connection across calls', async () => {
    const { default: handler } = await import('../../pages/api/health.js');
    const req = {};
    const res = createMockRes();
    await handler(req, res);
    await handler(req, res);
    const Redis = require('ioredis');
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});

