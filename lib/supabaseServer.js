import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export function getSupabaseServerClient(req, res) {
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
