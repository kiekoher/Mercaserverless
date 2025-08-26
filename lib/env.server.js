const { z } = require('zod');
const publicEnv = require('./env');

// Base schema for server-side environment variables.
// These are optional for local development and testing.
const baseServerSchema = z.object({
  SUPABASE_SERVICE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  UPSTASH_REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.string().optional().default('info'),
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),
  GEOCODE_TIMEOUT_MS: z.coerce.number().optional(),
  GEOCODE_RETRIES: z.coerce.number().optional(),
  GEOCODE_CONCURRENCY: z.coerce.number().optional(),
  GEOCODE_RETRY_BASE_MS: z.coerce.number().optional(),
  AI_TIMEOUT_MS: z.coerce.number().optional(),
  HEALTHCHECK_TOKEN: z.string().optional(),
  RATE_LIMIT_FAIL_OPEN: z.enum(['true', 'false']).optional().default('false'),
  RESEND_API_KEY: z.string().optional(),
});

// Schema for PRODUCTION environment variables.
// This schema enforces the presence of critical keys for a fail-fast startup.
const productionServerSchema = baseServerSchema.extend({
  // In production, these variables are STRICTLY REQUIRED.
  SUPABASE_SERVICE_KEY: z.string({ required_error: "SUPABASE_SERVICE_KEY is required in production." }).min(1),
  RESEND_API_KEY: z.string({ required_error: "RESEND_API_KEY is required for email functionality." }).min(1),
  LOGTAIL_SOURCE_TOKEN: z.string({ required_error: "LOGTAIL_SOURCE_TOKEN is required for production logging." }).min(1),
  HEALTHCHECK_TOKEN: z.string({ required_error: "HEALTHCHECK_TOKEN is required for monitoring." }).min(1),
  GEMINI_API_KEY: z.string({ required_error: "GEMINI_API_KEY is required for AI features."}).min(1),
  GOOGLE_MAPS_API_KEY: z.string({ required_error: "GOOGLE_MAPS_API_KEY is required for maps and geocoding."}).min(1),
}).refine((env) => env.RATE_LIMIT_FAIL_OPEN === 'false', {
  path: ['RATE_LIMIT_FAIL_OPEN'],
  message: 'RATE_LIMIT_FAIL_OPEN must be "false" in production for security reasons. The system must fail-closed.',
}).refine(env => {
    // In production, a Redis connection is mandatory for rate limiting and caching.
    const hasRest = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
    const hasUrl = !!env.UPSTASH_REDIS_URL;
    return hasRest || hasUrl;
}, {
    path: ['UPSTASH_REDIS_URL'],
    message: 'A Redis connection method is required in production (UPSTASH_REDIS_URL or both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).',
});


// Determine which schema to use based on the environment
const serverSchema = process.env.NODE_ENV === 'production'
  ? productionServerSchema
  : baseServerSchema;

const parsedEnv = serverSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsedEnv.error.flatten().fieldErrors, null, 2),
  );
  throw new Error('Invalid environment variables. Check the logs for details.');
}

module.exports = {
  ...publicEnv,
  ...parsedEnv.data,
  /**
   * The Zod schema for server-side environment variables.
   * @type {z.ZodObject<any, any, any>}
   */
  serverSchema,
};
