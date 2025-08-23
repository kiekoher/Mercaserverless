import { timingSafeEqual } from 'crypto';
import { getSupabaseServerClient } from '../../lib/supabaseServer';
import logger from '../../lib/logger.server';
import { getRedisClient } from '../../lib/rateLimiter';

export default async function handler(req, res) {
  const healthCheckToken = process.env.HEALTHCHECK_TOKEN;
  const authorizationHeader = req.headers.authorization;

  // --- 1. Authenticate the request securely ---
  if (!healthCheckToken) {
    logger.error('HEALTHCHECK_TOKEN is not configured on the server.');
    // This is a server-side configuration issue, so we return 503.
    return res.status(503).json({ status: 'error', message: 'Health check is misconfigured.' });
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const providedToken = authorizationHeader.substring(7); // Length of "Bearer "
  const providedTokenBuffer = Buffer.from(providedToken, 'utf8');
  const expectedTokenBuffer = Buffer.from(healthCheckToken, 'utf8');

  // Use timingSafeEqual to prevent timing attacks.
  // It requires buffers of the same length.
  if (
    providedTokenBuffer.length !== expectedTokenBuffer.length ||
    !timingSafeEqual(providedTokenBuffer, expectedTokenBuffer)
  ) {
    return res.status(403).json({ status: 'error', message: 'Forbidden: Invalid token.' });
  }

  // --- 2. Perform health checks on critical dependencies ---
  let supabaseStatus = 'ok';
  let redisStatus = 'ok';
  let overallStatus = 'ok';

  try {
    // Check Supabase connection by trying to get a session
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) {
      supabaseStatus = 'error';
      throw supaError;
    }

    // Check Redis connection if it's configured
    if (process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) {
      const redis = getRedisClient();
      if (redis) {
        await redis.ping();
      } else {
        // This case should ideally not happen if URL is set
        redisStatus = 'degraded';
        logger.warn('Health check: Redis client could not be initialized despite URL being present.');
      }
    } else {
      redisStatus = 'not_configured';
    }
  } catch (err) {
    logger.error({ err }, 'Health check dependency failed');
    // If any check fails, the overall status is degraded.
    overallStatus = 'degraded';
    if (err.message.includes('supabase')) supabaseStatus = 'error';
    if (err.message.includes('Redis') || err.name === 'RedisError') redisStatus = 'error';
  }

  const dependencies = {
    supabase: supabaseStatus,
    redis: redisStatus,
  };

  // If any dependency reported an error, the service is considered degraded.
  if (supabaseStatus === 'error' || redisStatus === 'error') {
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;

  return res.status(statusCode).json({
    status: overallStatus,
    dependencies,
  });
}
