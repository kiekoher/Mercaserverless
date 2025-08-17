import { getSupabaseServerClient } from '../../lib/supabaseServer';
import Redis from 'ioredis';
import logger from '../../lib/logger';

let redis;

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) throw supaError;

    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL not configured');
    }
    if (!redis) {
      redis = new Redis(process.env.REDIS_URL);
      redis.on('error', (e) => logger.error({ err: e }, 'Redis error'));
    }
    await redis.ping();

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(500).json({ status: 'error' });
  }
}
