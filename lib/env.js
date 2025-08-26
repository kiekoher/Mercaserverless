const { z } = require('zod');

// Base schema for all public (client-side) environment variables.
const basePublicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ required_error: "NEXT_PUBLIC_SUPABASE_URL is required." }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required." }),
  NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS: z.enum(['true', 'false']).optional().default('false'),
});

// Stricter schema for production, enforcing security best practices.
const productionPublicSchema = basePublicSchema.refine(
  (env) => env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'false',
  {
    path: ['NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS'],
    message: 'CRITICAL: NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS must be explicitly set to "false" in production.',
  }
);

// Choose the schema based on the environment.
const publicSchema = process.env.NODE_ENV === 'production'
  ? productionPublicSchema
  : basePublicSchema;


const _env = publicSchema.safeParse(process.env);
if (!_env.success) {
  const formatted = _env.error.flatten().fieldErrors;
  console.error(
    '❌ Invalid public environment variables:',
    JSON.stringify(formatted, null, 2)
  );
  throw new Error('Invalid public environment variables. Check the logs for details.');
}

module.exports = _env.data;
