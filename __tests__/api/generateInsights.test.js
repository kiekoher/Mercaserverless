/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import { requireUser } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rateLimiter';

jest.mock('../../lib/auth', () => ({ requireUser: jest.fn() }));
jest.mock('../../lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: jest.fn().mockReturnValue('{"kpi":"k","insight":"i","observation":"o","recommendation":"r"}') }
      })
    })
  }))
}));

describe('/api/generate-insights', () => {
  let handler;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_KEY = 'service';
    process.env.AI_TIMEOUT_MS = '10000';
    ({ default: handler } = await import('../../pages/api/generate-insights'));
  });

  it('returns 401 when unauthenticated', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const token = 'test-token';
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-csrf-token': token, cookie: `csrf-secret=${token}` },
      body: { rutaId: 1 },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 for invalid rutaId', async () => {
    requireUser.mockResolvedValue({ user: { id: '1' }, supabase: {}, error: null });
    const token = 'test-token';
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-csrf-token': token, cookie: `csrf-secret=${token}` },
      body: { rutaId: -1 },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 200 with insights for valid request', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [{ puntos_de_venta: { nombre: 'PDV' }, estado: 'ok', check_in_at: '2024-01-01', check_out_at: '2024-01-01', observaciones: '' }],
      error: null
    });
    const supabase = { from: () => ({ select: () => ({ eq }) }) };
    requireUser.mockResolvedValue({ user: { id: '1' }, supabase, error: null });

    const token = 'test-token';
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-csrf-token': token, cookie: `csrf-secret=${token}` },
      body: { rutaId: 1 },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toHaveProperty('kpi');
  });
});
