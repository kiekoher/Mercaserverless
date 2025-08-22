import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import logger from './logger.server';

/**
 * Create a Supabase client using the user's session cookies by default.
 * Pass `{ admin: true }` as the third argument to obtain a client with
 * service-role privileges. Admin clients should be used sparingly as they
 * bypass Row Level Security.
 */
export function getSupabaseServerClient(req, res, { admin = false } = {}) {
  const supabaseKey = admin
    ? process.env.SUPABASE_SERVICE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    logger.error(
      admin
        ? 'SUPABASE_SERVICE_KEY is not defined. Unable to create admin Supabase client.'
        : 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Supabase client cannot be created.'
    );
    throw new Error('Missing Supabase credentials');
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey,
    {
      cookies: {
        get(name) {
          return req.cookies[name];
        },
        set(name, value, options) {
          const cookie = serialize(name, value, options);
          const existing = res.getHeader('Set-Cookie');
          res.setHeader(
            'Set-Cookie',
            [
              ...(Array.isArray(existing)
                ? existing
                : existing
                ? [existing]
                : []),
              cookie,
            ]
          );
        },
        remove(name, options) {
          const cookie = serialize(name, '', { ...options, maxAge: -1 });
          const existing = res.getHeader('Set-Cookie');
          res.setHeader(
            'Set-Cookie',
            [
              ...(Array.isArray(existing)
                ? existing
                : existing
                ? [existing]
                : []),
              cookie,
            ]
          );
        },
      },
    }
  );
}
