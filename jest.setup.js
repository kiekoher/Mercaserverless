// Polyfill for TextEncoder, which is not available in the default JSDOM environment.
// Required by dependencies of 'formidable'.
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { serverEnv } from './lib/env.server';
import logger, { flushLogger } from './lib/logger.server';
import { closeRedis } from './lib/rateLimiter';

// --- Global Mocks ---

// Mock the environment variables to ensure tests are hermetic
jest.mock('./lib/env', () => ({
  env: {
    // Provide a complete, self-contained mock environment
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GOOGLE_MAPS_API_KEY: 'test-maps-key',
    AI_TIMEOUT_MS: 10000,
    UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
    UPSTASH_REDIS_URL: 'redis://dummy.upstash.com:6379',
    RATE_LIMIT_FAIL_OPEN: true,
    LOG_LEVEL: 'info',
    LOGTAIL_SOURCE_TOKEN: 'test-logtail-token',
    GEOCODE_TIMEOUT_MS: 1000,
    GEOCODE_RETRIES: 3,
    GEOCODE_CONCURRENCY: 5,
    GEOCODE_RETRY_BASE_MS: 100,
    CYPRESS_ADMIN_ID: 'test-admin-id',
    CYPRESS_SUPERVISOR_ID: 'test-supervisor-id',
    CYPRESS_MERCADERISTA_ID: 'test-mercaderista-id',
    NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS: true,
    HEALTHCHECK_TOKEN: 'test-health-token',
  },
}));

// Mock the authentication utility
jest.mock('./lib/auth', () => ({
  requireUser: jest.fn().mockResolvedValue({
    id: 'test-user-id',
    role: 'mercaderista', // Default role for tests
  }),
}));

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    // Default mock resolutions
    data: null,
    error: null,
  };
  // Allow chaining and then resolving with mock data
  Object.keys(mockSupabase).forEach(key => {
    if (typeof mockSupabase[key] === 'function') {
      mockSupabase[key].mockImplementation(function() {
        // Resolve with a default success state unless overridden
        if (this.then) {
          return Promise.resolve({ data: this.data, error: this.error });
        }
        return this;
      });
    }
  });
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

jest.mock('@upstash/redis');

// Gracefully close open handles after all tests are done
afterAll(async () => {
  if (logger && typeof logger.close === 'function') {
    logger.close();
  }
  await flushLogger();
  closeRedis();
});
