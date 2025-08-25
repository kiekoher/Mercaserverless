import { createMocks } from 'node-mocks-http';

// Mock the logger HOC to isolate the handler
jest.mock('../../lib/api-logger', () => ({
  withLogging: (handler) => handler,
}));

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('../../lib/supabaseServer');
jest.mock('../../lib/auth');
jest.mock('../../lib/rateLimiter');
jest.mock('../../lib/redisCache');

import handler from '../../pages/api/generate-summary';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseServerClient } from '../../lib/supabaseServer';
import { requireUser } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rateLimiter';
import { getCacheClient } from '../../lib/redisCache';


describe('/api/generate-summary handler', () => {
  let mockGenerateContent;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI
    mockGenerateContent = jest.fn().mockResolvedValue({
      response: { text: () => 'Mock AI summary' },
    });
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: mockGenerateContent,
      }),
    }));

    // Mock Rate Limiter and Cache
    checkRateLimit.mockResolvedValue(true);
    getCacheClient.mockReturnValue({ get: jest.fn().mockResolvedValue(null), set: jest.fn() });
  });

  const mockDbSuccess = (data = [{ id: 1, created_at: new Date().toISOString() }]) => {
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data, error: null }),
      eq: jest.fn().mockResolvedValue({ data, error: null }),
    };
    getSupabaseServerClient.mockReturnValue(supabaseMock);
    requireUser.mockResolvedValue({ user: { id: 'user-supervisor' }, supabase: supabaseMock, error: null });
  };

  const mockDbFailure = (error = new Error('DB Error')) => {
    const supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({ data: null, error }),
      eq: jest.fn().mockResolvedValue({ data: null, error }),
    };
    getSupabaseServerClient.mockReturnValue(supabaseMock);
    requireUser.mockResolvedValue({ user: { id: 'user-supervisor' }, supabase: supabaseMock, error: null });
  };

  it('should return 401 if requireUser returns an auth error', async () => {
    requireUser.mockResolvedValue({ error: { status: 401, message: 'Unauthorized' } });
    const { req, res } = createMocks({ method: 'POST', body: { fecha_inicio: '2023-01-01', fecha_fin: '2023-01-31' } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('should return 200 and a summary on a valid request', async () => {
    mockDbSuccess();
    const { req, res } = createMocks({ method: 'POST', body: { fecha_inicio: '2023-01-01', fecha_fin: '2023-01-31' } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().summary).toBe('Mock AI summary');
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should return 404 if no data is found in the database', async () => {
    mockDbSuccess([]); // No visits found
    const { req, res } = createMocks({ method: 'POST', body: { fecha_inicio: '2023-01-01', fecha_fin: '2023-01-31' } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it('should throw an error if the database query fails', async () => {
    mockDbFailure();
    const { req, res } = createMocks({ method: 'POST', body: { fecha_inicio: '2023-01-01', fecha_fin: '2023-01-31' } });
    await expect(handler(req, res)).rejects.toThrow('DB Error');
  });
});
