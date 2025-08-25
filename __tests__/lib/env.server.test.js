describe('Environment Variable Validation (env.server.js)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Reset process.env to a snapshot of the original environment
    // This prevents pollution between tests
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original process.env after all tests
    process.env = originalEnv;
  });

  const getValidDevEnv = () => ({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'http://test.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GOOGLE_MAPS_API_KEY: 'test-maps-key',
    UPSTASH_REDIS_URL: 'redis://test.redis.io:6379',
  });

  const getValidProdEnv = () => ({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'http://test.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GOOGLE_MAPS_API_KEY: 'test-maps-key',
    UPSTASH_REDIS_URL: 'redis://test.redis.io:6379',
    LOGTAIL_SOURCE_TOKEN: 'test-logtail-token',
    HEALTHCHECK_TOKEN: 'test-healthcheck-token',
    RESEND_API_KEY: 'test-resend-key',
    RATE_LIMIT_FAIL_OPEN: 'false',
  });

  it('should load without error with a valid development environment', () => {
    process.env = { ...getValidDevEnv() };
    expect(() => require('../../lib/env.server')).not.toThrow();
  });

  it('should load without error with a valid production environment', () => {
    process.env = { ...getValidProdEnv() };
    expect(() => require('../../lib/env.server')).not.toThrow();
  });

  it('should load even if optional production variables like LOGTAIL_SOURCE_TOKEN are missing', () => {
    const invalidProdEnv = getValidProdEnv();
    delete invalidProdEnv.LOGTAIL_SOURCE_TOKEN;
    process.env = { ...invalidProdEnv };
    expect(() => require('../../lib/env.server')).not.toThrow();
  });

  it('should throw an error if RATE_LIMIT_FAIL_OPEN is true in production', () => {
    const invalidEnv = { ...getValidProdEnv(), RATE_LIMIT_FAIL_OPEN: 'true' };
    process.env = { ...invalidEnv };
    expect(() => require('../../lib/env.server')).toThrow('Invalid environment variables. See logs for details.');
  });

  it('should not throw if an optional variable like RESEND_API_KEY is missing in dev', () => {
    const devEnv = getValidDevEnv();
    delete devEnv.RESEND_API_KEY;
    process.env = { ...devEnv };
    expect(() => require('../../lib/env.server')).not.toThrow();
  });
});
