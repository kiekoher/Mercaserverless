// Import necessary modules
const { createMocks } = require('node-mocks-http');
const fs = require('fs');

// Mock dependencies using the factory pattern for formidable
const mockParse = jest.fn();
jest.mock('formidable', () => {
  // This is a factory function that returns the mock implementation
  return jest.fn(() => ({
    parse: mockParse,
  }));
});

jest.mock('../../lib/auth');
jest.mock('../../lib/logger.server');
jest.mock('papaparse');
jest.mock('@googlemaps/google-maps-services-js');
jest.mock('../../lib/redisCache', () => ({
  getCacheClient: jest.fn().mockReturnValue(null),
}));

const mockRpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
  })),
}));

// We need to import these after the mocks are defined
const { requireUser } = require('../../lib/auth');
const formidable = require('formidable');
const Papa = require('papaparse');
const { Client } = require('@googlemaps/google-maps-services-js');

describe('/api/import-pdv', () => {
  beforeEach(() => {
    // Clear mocks before each test to ensure isolation
    jest.clearAllMocks();
    mockParse.mockClear();
  });

  it('should return 403 for non-admin/supervisor roles', async () => {
    // Configure the mock for this specific test case
    requireUser.mockResolvedValue({
      user: null,
      role: 'mercaderista',
      error: { status: 403, message: 'Forbidden' },
    });

    // Dynamically require the handler inside the test
    // This ensures it gets the test-specific mock configuration
    const handler = require('../../pages/api/import-pdv');
    const { req, res } = createMocks({ method: 'POST' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    // The handler should have returned early, so formidable should not have been used
    expect(formidable).not.toHaveBeenCalled();
  });

  it('should return 400 if no CSV file is provided', async () => {
    // Configure a successful auth mock for this test
    requireUser.mockResolvedValue({
      user: { id: 'test-admin' },
      role: 'admin',
      error: null,
      supabase: { rpc: mockRpc },
    });

    // Configure the formidable mock's parse method for this test
    mockParse.mockImplementation((req, cb) => {
      // Simulate no files being uploaded
      cb(null, {}, {});
    });

    const handler = require('../../pages/api/import-pdv');
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    // Correct the expected error message to match the actual code's output
    expect(res._getJSONData().error).toBe('A CSV file is required.');
  });

  it('should process a valid CSV and call the RPC', async () => {
    // Configure a successful auth mock
    requireUser.mockResolvedValue({
      user: { id: 'test-admin' },
      role: 'admin',
      error: null,
      supabase: { rpc: mockRpc },
    });
    mockRpc.mockResolvedValue({ error: null }); // Mock a successful RPC call

    // Configure formidable to simulate a file upload
    const mockFile = { filepath: 'test.csv', mimetype: 'text/csv' };
    mockParse.mockImplementation((req, cb) => {
      cb(null, {}, { csvfile: [mockFile] });
    });

    // Mock PapaParse to simulate reading the CSV data
    const validPdvs = [{
      nombre: 'Store A',
      direccion: '123 Main St',
      ciudad: 'Anytown',
      cuota: '100.50',
      tipologia: 'Tipo A',
      frecuencia_mensual: '4',
      minutos_servicio: '30'
    }];
    Papa.parse.mockImplementation((stream, config) => {
      validPdvs.forEach(pdv => config.step({ data: pdv }));
      config.complete();
    });

    // Mock Google Maps Geocoding
    Client.mockImplementation(() => ({
      geocode: jest.fn().mockResolvedValue({ data: { results: [] } }),
    }));

    // Prevent fs.createReadStream from executing by mocking it.
    // This is the key to fixing the ENOENT error.
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => {});

    const handler = require('../../pages/api/import-pdv');
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().message).toContain('Import completed successfully');
    expect(mockRpc).toHaveBeenCalledWith('bulk_upsert_pdv', { pdvs_data: expect.any(Array) });
    expect(mockRpc.mock.calls[0][1].pdvs_data[0].nombre).toBe('Store A');
  });
});
