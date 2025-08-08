import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export function getSupabaseServerClient(req, res) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
