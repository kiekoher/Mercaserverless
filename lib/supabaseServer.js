import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import logger from './logger';

export function getSupabaseServerClient(req, res) {
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseKey) {
    logger.error('SUPABASE_SERVICE_KEY is not defined. Server-side Supabase client cannot be created with admin privileges.');
    throw new Error('SUPABASE_SERVICE_KEY is not defined');
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey, // This will be undefined if the key is missing, causing an error in the client.
    {
      cookies: {
        get(name) {
          return req.cookies[name];
        },
        set(name, value, options) {
          const cookie = serialize(name, value, options);
          res.setHeader('Set-Cookie', cookie);
        },
        remove(name, options) {
          const cookie = serialize(name, '', { ...options, maxAge: -1 });
          res.setHeader('Set-Cookie', cookie);
        },
      },
    }
  );
}
