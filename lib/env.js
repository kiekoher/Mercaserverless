const { z } = require('zod');

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  LOG_FILE_PATH: z.string().optional(),
  LOG_MAX_SIZE: z.string().optional(),
  LOG_MAX_FILES: z.string().optional(),
  LOG_REMOTE_URL: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  GEOCODE_TIMEOUT_MS: z.coerce.number().optional(),
  GEOCODE_RETRIES: z.coerce.number().optional(),
});

const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  console.error('Invalid environment variables', _env.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = _env.data;

