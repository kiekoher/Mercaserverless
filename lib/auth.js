import logger from './logger';
import { getSupabaseServerClient } from './supabaseServer';

/**
 * Ensure the request has an authenticated user and optionally restrict roles.
 * Returns an object with { supabase, user, role } or { error: { status, message } }.
 */
export async function requireUser(req, res, allowedRoles = []) {
  const supabase = getSupabaseServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logger.warn('Unauthorized access attempt');
    return { error: { status: 401, message: 'Unauthorized' } };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.error({ err: profileError }, 'Error fetching profile');
    return { error: { status: 500, message: 'Error fetching user profile' } };
  }

  const role = profile?.role;
  if (allowedRoles.length && !allowedRoles.includes(role)) {
    logger.warn({ userId: user.id, role }, 'Forbidden access');
    return { error: { status: 403, message: 'Forbidden' } };
  }

  return { supabase, user, role };
}
