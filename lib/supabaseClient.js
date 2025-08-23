import { createBrowserClient } from '@supabase/ssr'
import logger from './logger.client'

// Lazily create a Supabase client. This avoids requiring credentials
// during the build step where environment variables may be absent.
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Supabase credentials missing')
    }
    throw new Error('Supabase credentials missing')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
