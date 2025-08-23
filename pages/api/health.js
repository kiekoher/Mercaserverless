import { getSupabaseServerClient } from '../../lib/supabaseServer';
import logger from '../../lib/logger.server';
import { checkRateLimit, getRedisClient } from '../../lib/rateLimiter';

export default async function handler(req, res) {
  const token = req.headers['x-health-token'];
  if (!process.env.HEALTHCHECK_TOKEN || token !== process.env.HEALTHCHECK_TOKEN) {
    return res.status(401).json({ status: 'unauthorized' });
  }
  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ status: 'rate-limit' });
  }
  try {
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) throw supaError;

    let redisStatus = 'ok';
    if (process.env.UPSTASH_REDIS_URL) {
      const redis = getRedisClient();
      if (redis) {
        try {
          await redis.ping();
        } catch (e) {
          redisStatus = 'error';
          logger.error({ err: e }, 'Redis ping failed');
        }
      } else {
        redisStatus = 'degraded';
      }
    } else {
      redisStatus = 'unavailable';
      logger.warn('UPSTASH_REDIS_URL not configured for health check');
    }

    res.status(200).json({ status: redisStatus === 'ok' ? 'ok' : 'degraded', redis: redisStatus });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(500).json({ status: 'error' });
  }
}
