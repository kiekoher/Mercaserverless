/** @jest-environment node */
import { jest } from '@jest/globals';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

describe('getSupabaseServerClient', () => {
  it('throws if SUPABASE_SERVICE_KEY is missing', () => {
    const original = process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_SERVICE_KEY;
    const { getSupabaseServerClient } = require('../lib/supabaseServer');
    expect(() => getSupabaseServerClient({ cookies: {} }, { setHeader() {} })).toThrow('SUPABASE_SERVICE_KEY is not defined');
    process.env.SUPABASE_SERVICE_KEY = original;
  });
});
