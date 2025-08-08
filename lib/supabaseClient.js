import { createBrowserClient } from '@supabase/ssr'

// These variables are expected to be in a .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Supabase credentials missing')
  }
  throw new Error('Supabase credentials missing')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
