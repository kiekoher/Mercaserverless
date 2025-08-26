jest.unmock('../lib/env');
jest.unmock('../lib/env.server');

const path = require('path');

describe('environment variable validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env and modules before each test to ensure isolation
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('throws when public env vars are missing', () => {
    // This test checks the public-facing environment file (lib/env.js)
    const envPath = path.resolve(__dirname, '../lib/env.js');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Expect the more specific error message from the updated validation logic
    expect(() => require(envPath)).toThrow('Invalid public environment variables. Check the logs for details.');
  });

  it('throws when server env vars are missing', () => {
    // This test checks the server-side environment file (lib/env.server.js)
    const envServerPath = path.resolve(__dirname, '../lib/env.server.js');
    // Provide valid public envs to ensure we are testing the server-side logic
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    process.env.NODE_ENV = 'production'; // Force production schema
    process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS = 'false'; // Satisfy public schema

    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.GEMINI_API_KEY;
    // Expect the server-side error message
    expect(() => require(envServerPath)).toThrow('Invalid environment variables. Check the logs for details.');
  });

  it('throws when Redis configuration is missing', () => {
    // This test also checks the server-side environment file
    const envServerPath = path.resolve(__dirname, '../lib/env.server.js');
    // Provide valid public envs to ensure we are testing the server-side logic
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    process.env.NODE_ENV = 'production'; // Force production schema
    process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS = 'false'; // Satisfy public schema
    // Also provide other required server vars
    process.env.SUPABASE_SERVICE_KEY = 'test';
    process.env.RESEND_API_KEY = 'test';
    process.env.LOGTAIL_SOURCE_TOKEN = 'test';
    process.env.HEALTHCHECK_TOKEN = 'test';
    process.env.GEMINI_API_KEY = 'test';
    process.env.GOOGLE_MAPS_API_KEY = 'test';

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_URL;
    // Expect the server-side error message
    expect(() => require(envServerPath)).toThrow('Invalid environment variables. Check the logs for details.');
  });
});
