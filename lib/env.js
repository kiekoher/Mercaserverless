const { z } = require('zod');

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  const formatted = _env.error.flatten().fieldErrors;
  console.error('Invalid environment variables', formatted);
  throw new Error('Invalid environment variables');
}

module.exports = _env.data;
