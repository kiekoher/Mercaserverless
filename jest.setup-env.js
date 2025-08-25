import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';
import { MessagePort } from 'worker_threads';

// --- JSDOM Polyfills ---
// These are web APIs that are not available in the JSDOM/Node.js environment used by Jest.
// We need to provide them globally for libraries like 'undici' (used by Next.js middleware tests) to work.
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  ReadableStream,
  MessagePort,
});

// --- Default Environment Variables ---
// Set up a default, consistent environment for all test suites.
// Tests that need to manipulate the environment should do so carefully.
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key-anon',
  SUPABASE_SERVICE_KEY: 'test-key-service',
  GEMINI_API_KEY: 'test-gemini-key',
  GOOGLE_MAPS_API_KEY: 'test-maps-key',
  UPSTASH_REDIS_URL: 'redis://test.redis.io:6379',
  UPSTASH_REDIS_REST_URL: 'https://test.redis.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
  LOGTAIL_SOURCE_TOKEN: 'test-logtail-token',
  HEALTHCHECK_TOKEN: 'test-healthcheck-token',
  RESEND_API_KEY: 'test-resend-key',
  RATE_LIMIT_FAIL_OPEN: 'true', // Default to fail-open for tests
};
