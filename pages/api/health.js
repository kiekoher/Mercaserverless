const { timingSafeEqual } = require('crypto');
const { getSupabaseServerClient } = require('../../lib/supabaseServer');
const logger = require('../../lib/logger.server');
const { getRedisClient } = require('../../lib/rateLimiter');

async function handler(req, res) {
  const healthCheckToken = process.env.HEALTHCHECK_TOKEN;
  const authorizationHeader = req.headers.authorization;

  // --- 1. Authenticate the request securely ---
  if (!healthCheckToken) {
    logger.error('HEALTHCHECK_TOKEN is not configured on the server.');
    return res.status(503).json({ status: 'error', message: 'Health check is misconfigured.' });
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const providedToken = authorizationHeader.substring(7);
  const providedTokenBuffer = Buffer.from(providedToken, 'utf8');
  const expectedTokenBuffer = Buffer.from(healthCheckToken, 'utf8');

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
    const supabase = getSupabaseServerClient(req, res);
    const { error: supaError } = await supabase.auth.getSession();
    if (supaError) {
      supabaseStatus = 'error';
      throw supaError;
    }

    if (process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) {
      const redis = getRedisClient();
      if (redis) {
        await redis.ping();
      } else {
        redisStatus = 'degraded';
      }
    } else {
      redisStatus = 'not_configured';
    }
  } catch (err) {
    logger.error({ err }, 'Health check dependency failed');
    overallStatus = 'degraded';
    if (err.message.includes('supabase')) supabaseStatus = 'error';
    if (err.message.includes('Redis') || err.name === 'RedisError') redisStatus = 'error';
  }

  const dependencies = {
    supabase: supabaseStatus,
    redis: redisStatus,
  };

  if (supabaseStatus === 'error' || redisStatus === 'error') {
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;

  return res.status(statusCode).json({
    status: overallStatus,
    dependencies,
  });
}

module.exports = handler;
