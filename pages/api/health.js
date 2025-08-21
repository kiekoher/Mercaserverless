import { getSupabaseServerClient } from '../../lib/supabaseServer';
import Redis from 'ioredis';
import logger from '../../lib/logger.server';

let redis;

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) throw supaError;

    let redisStatus = 'ok';
    if (process.env.REDIS_URL) {
      if (!redis) {
        redis = new Redis(process.env.REDIS_URL);
        redis.on('error', (e) => logger.error({ err: e }, 'Redis error'));
      }
      await redis.ping();
    } else {
      redisStatus = 'unavailable';
      logger.warn('REDIS_URL not configured for health check');
    }

    res.status(200).json({ status: redisStatus === 'ok' ? 'ok' : 'degraded', redis: redisStatus });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(500).json({ status: 'error' });
  }
}
