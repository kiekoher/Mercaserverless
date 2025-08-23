const path = require('path');

describe('environment variable validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('throws when public env vars are missing', () => {
    const envPath = path.resolve(__dirname, '../lib/env.js');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => require(envPath)).toThrow('Invalid environment variables');
  });

  it('throws when server env vars are missing', () => {
    const envServerPath = path.resolve(__dirname, '../lib/env.server.js');
    delete process.env.SUPABASE_SERVICE_KEY;
    expect(() => require(envServerPath)).toThrow('Invalid environment variables');
  });
});
