const { createMocks } = require('node-mocks-http');
const fs = require('fs');

const mockParse = jest.fn();
jest.mock('formidable', () => jest.fn(() => ({ parse: mockParse })), { virtual: true });
jest.mock('../../lib/auth');
jest.mock('../../lib/rateLimiter');
jest.mock('../../lib/supabaseServer');
jest.mock('../../lib/logger.server');

const { requireUser } = require('../../lib/auth');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getSupabaseServerClient } = require('../../lib/supabaseServer');

describe('/api/upload-foto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockResolvedValue(true);
    requireUser.mockResolvedValue({ user: { id: 'u1' }, error: null });
    fs.promises.readFile = jest.fn().mockResolvedValue(Buffer.from('file'));
    fs.promises.unlink = jest.fn().mockResolvedValue();
    getSupabaseServerClient.mockReturnValue({
      storage: {
        from: () => ({
          upload: jest.fn().mockResolvedValue({ error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/img.jpg' } }),
        }),
      },
    });
  });

  it('rejects non-image files', async () => {
    mockParse.mockImplementation((req, cb) => {
      cb(null, {}, { file: [{ filepath: '/tmp/file', mimetype: 'text/plain' }] });
    });
    const handler = require('../../pages/api/upload-foto');
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('uploads image and returns url', async () => {
    mockParse.mockImplementation((req, cb) => {
      cb(null, {}, { file: [{ filepath: '/tmp/file', mimetype: 'image/png', originalFilename: 'a.png' }] });
    });
    const handler = require('../../pages/api/upload-foto');
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toEqual(JSON.stringify({ url: 'http://example.com/img.jpg' }));
    expect(fs.promises.unlink).toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), { userId: 'u1' });
  });
});
