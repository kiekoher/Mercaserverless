/** @jest-environment node */
import { jest } from '@jest/globals';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

describe('getSupabaseServerClient', () => {
  it('throws if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { getSupabaseServerClient } = require('../lib/supabaseServer');
    expect(() => getSupabaseServerClient({ cookies: {} }, { setHeader() {} })).toThrow('Missing Supabase credentials');
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original;
  });
});
