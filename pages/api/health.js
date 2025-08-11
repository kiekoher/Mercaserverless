import { getSupabaseServerClient } from '../../lib/supabaseServer';
import Redis from 'ioredis';
import logger from '../../lib/logger';

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) throw supaError;

    if (process.env.REDIS_URL) {
      const redis = new Redis(process.env.REDIS_URL);
      await redis.ping();
      await redis.quit();
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(500).json({ status: 'error' });
  }
}
