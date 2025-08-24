// This file is executed by Jest's `setupFiles` configuration.
// It runs before the test environment is set up.
// Its purpose is to load environment variables from the .env.test file
// at the earliest possible moment, ensuring they are available to all modules.

const dotenv = require('dotenv');
dotenv.config({ path: '.env.test' });

process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS = process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS || 'true';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.GEMINI_API_KEY = 'dummy-gemini-key';
process.env.GOOGLE_MAPS_API_KEY = 'dummy-maps-key';
process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'example-token';
