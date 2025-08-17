import logger from '../../lib/logger';
import { checkRateLimit } from '../../lib/rateLimiter';
import { requireUser } from '../../lib/auth';

export default async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!await checkRateLimit(req, { userId: user.id })) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { data, error } = await supabase.rpc('get_dashboard_stats');

  if (error) {
    logger.error({ err: error }, 'Error calling dashboard stats function');
    return res.status(500).json({ error: 'Error al obtener las estadísticas.' });
  }

  res.status(200).json(data);
}
