const { z } = require('zod');
const publicEnv = require('./env');

const serverSchema = z
  .object({
    SUPABASE_SERVICE_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    UPSTASH_REDIS_URL: z.string().url().optional(),
    LOG_LEVEL: z.string().optional(),
    LOGTAIL_SOURCE_TOKEN: z.string().optional(),
    GEOCODE_TIMEOUT_MS: z.coerce.number().optional(),
    GEOCODE_RETRIES: z.coerce.number().optional(),
    GEOCODE_CONCURRENCY: z.coerce.number().optional(),
    GEOCODE_RETRY_BASE_MS: z.coerce.number().optional(),
    AI_TIMEOUT_MS: z.coerce.number().optional(),
    HEALTHCHECK_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const hasRest = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
    const hasUrl = !!env.UPSTASH_REDIS_URL;
    if (!hasRest && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_URL'],
        message: 'UPSTASH_REDIS_REST_URL+TOKEN or UPSTASH_REDIS_URL required',
      });
    }
    if ((env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) || (!env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['UPSTASH_REDIS_REST_TOKEN'],
        message: 'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided together',
      });
    }
  });

const _env = serverSchema.safeParse(process.env);
if (!_env.success) {
  const formatted = _env.error.flatten().fieldErrors;
  console.error('Invalid environment variables', formatted);
  throw new Error('Invalid environment variables');
}

module.exports = { ...publicEnv, ..._env.data };
