jest.unmock('../lib/env');
jest.unmock('../lib/env.server');

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
    delete process.env.GEMINI_API_KEY;
    expect(() => require(envServerPath)).toThrow('Invalid environment variables');
  });

  it('throws when Redis configuration is missing', () => {
    const envServerPath = path.resolve(__dirname, '../lib/env.server.js');
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    expect(() => require(envServerPath)).toThrow('Invalid environment variables');
  });
});
