const { z } = require('zod');
const publicEnv = require('./env');

// Base schema for server-side environment variables, shared across all environments
const baseServerSchema = z.object({
  // Made optional to allow build without full configuration
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

// Schema for production-specific environment variables, extending the base schema
// We keep this lenient to allow deploying without all keys present.
// Features will degrade gracefully or fail at runtime if keys are missing.
const productionServerSchema = baseServerSchema
  .extend({
    // These are no longer strictly required at build time.
    LOGTAIL_SOURCE_TOKEN: z.string().optional(),
    HEALTHCHECK_TOKEN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .refine((env) => env.RATE_LIMIT_FAIL_OPEN !== 'true', {
    path: ['RATE_LIMIT_FAIL_OPEN'],
    message: 'RATE_LIMIT_FAIL_OPEN must not be true in production for security reasons. The system must fail-closed.',
  });

// Refinement to check for Redis connection details, applied to both schemas
const redisRefinement = (env, ctx) => {
  const hasRest = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
  const hasUrl = !!env.UPSTASH_REDIS_URL;

  if (!hasRest && !hasUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['UPSTASH_REDIS_URL'],
      message: 'A Redis connection method is required: either UPSTASH_REDIS_URL or both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    });
  }
  if (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['UPSTASH_REDIS_REST_TOKEN'],
      message: 'UPSTASH_REDIS_REST_TOKEN is required when UPSTASH_REDIS_REST_URL is provided.',
    });
  }
  if (!env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['UPSTASH_REDIS_REST_URL'],
      message: 'UPSTASH_REDIS_REST_URL is required when UPSTASH_REDIS_REST_TOKEN is provided.',
    });
  }
};

// Determine which schema to use based on the environment
const serverSchema = process.env.NODE_ENV === 'production'
  ? productionServerSchema.superRefine(redisRefinement)
  : baseServerSchema.superRefine(redisRefinement);

const _env = serverSchema.safeParse(process.env);

if (!_env.success) {
  const formatted = _env.error.flatten().fieldErrors;
  console.error('❌ Invalid environment variables:', formatted);
  throw new Error('Invalid environment variables. See logs for details.');
}

module.exports = {
  ...publicEnv,
  ..._env.data,
  /**
   * The Zod schema for server-side environment variables.
   * @type {z.ZodObject<any, any, any>}
   */
  serverSchema,
};
