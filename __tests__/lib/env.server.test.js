describe('Environment Variable Validation (env.server.js)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // This is key to re-running the module initialization
    process.env = { ...originalEnv }; // Reset to a clean state
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original env after all tests
  });

  // A minimal but valid environment for development/testing
  const getValidDevEnv = () => ({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'http://test.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
    // Note: Most keys are optional in dev
  });

  // A complete and valid environment for production
  const getValidProdEnv = () => ({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'http://test.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
    SUPABASE_SERVICE_KEY: 'prod-service-key',
    GEMINI_API_KEY: 'prod-gemini-key',
    GOOGLE_MAPS_API_KEY: 'prod-maps-key',
    UPSTASH_REDIS_URL: 'redis://prod.redis.io:6379',
    LOGTAIL_SOURCE_TOKEN: 'prod-logtail-token',
    HEALTHCHECK_TOKEN: 'prod-healthcheck-token',
    RESEND_API_KEY: 'prod-resend-key',
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

  // Test that required production variables cause an error if missing
  const requiredProdKeys = [
    'SUPABASE_SERVICE_KEY',
    'RESEND_API_KEY',
    'LOGTAIL_SOURCE_TOKEN',
    'HEALTHCHECK_TOKEN',
    'GEMINI_API_KEY',
    'GOOGLE_MAPS_API_KEY',
  ];

  requiredProdKeys.forEach((key) => {
    it(`should throw an error if required prod key ${key} is missing in production`, () => {
      const invalidProdEnv = getValidProdEnv();
      delete invalidProdEnv[key];
      process.env = { ...invalidProdEnv };
      expect(() => require('../../lib/env.server')).toThrow('Invalid environment variables');
    });
  });

  it('should throw an error if Redis config is missing in production', () => {
    const invalidProdEnv = getValidProdEnv();
    delete invalidProdEnv.UPSTASH_REDIS_URL;
    process.env = { ...invalidProdEnv };
    expect(() => require('../../lib/env.server')).toThrow('Invalid environment variables');
  });

  it('should throw an error if RATE_LIMIT_FAIL_OPEN is not "false" in production', () => {
    const invalidEnv = { ...getValidProdEnv(), RATE_LIMIT_FAIL_OPEN: 'true' };
    process.env = { ...invalidEnv };
    expect(() => require('../../lib/env.server')).toThrow('Invalid environment variables');
  });

  it('should not throw if an optional variable like RESEND_API_KEY is missing in dev', () => {
    const devEnv = getValidDevEnv();
    delete devEnv.RESEND_API_KEY;
    process.env = { ...devEnv };
    expect(() => require('../../lib/env.server')).not.toThrow();
  });
});
