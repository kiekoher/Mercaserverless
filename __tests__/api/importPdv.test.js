const { createMocks } = require('node-mocks-http');
const fs = require('fs');

// Mock dependencies
jest.mock('../../lib/auth');
jest.mock('../../lib/logger.server');
jest.mock('papaparse');
jest.mock('@googlemaps/google-maps-services-js');
jest.mock('formidable');
jest.mock('../../lib/redisCache', () => ({
    getCacheClient: jest.fn().mockReturnValue(null), // Default to no cache
}));

const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
  })),
}));

const { requireUser } = require('../../lib/auth');
const Papa = require('papaparse');
const { Client } = require('@googlemaps/google-maps-services-js');
const formidable = require('formidable');

describe('/api/import-pdv', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    handler = require('../../pages/api/import-pdv');

    requireUser.mockResolvedValue({
      user: { id: 'test-user' },
      role: 'admin',
      supabase: { rpc: mockRpc },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('should return 403 for non-admin/supervisor roles', async () => {
    requireUser.mockResolvedValue({
        user: { id: 'test-mercaderista' },
        role: 'mercaderista',
        error: { status: 403, message: 'Forbidden' }
    });
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
  });

  it('should return 400 if no CSV file is provided', async () => {
    formidable.mockImplementation(() => ({
      parse: (req, cb) => cb(null, {}, {}),
    }));
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('should process a valid CSV', async () => {
    const mockFile = { filepath: 'test.csv', mimetype: 'text/csv' };
    formidable.mockImplementation(() => ({
      parse: (req, cb) => cb(null, {}, { csvfile: [mockFile] }),
    }));

    const validPdvs = [{ nombre: 'Store A', direccion: '123 Main St', ciudad: 'Anytown' }];
    Papa.parse.mockImplementation((stream, config) => {
      validPdvs.forEach(pdv => config.step({ data: pdv }));
      config.complete();
    });

    Client.mockImplementation(() => ({
      geocode: jest.fn().mockResolvedValue({ data: { results: [] } }),
    }));

    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('bulk_upsert_pdv', expect.any(Object));
  });
});
