import { Redis as UpstashRedis } from '@upstash/redis';
import logger from './logger.server';

const WINDOW_MS = 60 * 1000; // 1 minute
let upstashClient;

// Fail closed by default; explicitly set RATE_LIMIT_FAIL_OPEN=true to bypass
// rate limiting when Upstash is unavailable.
const FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN === 'true';

// Initialize the Upstash REST client. It's designed for serverless and edge environments.
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  try {
    upstashClient = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    logger.info('Using Upstash REST client for rate limiting.');
  } catch (err) {
    logger.error({ err }, 'Failed to create Upstash REST client.');
    upstashClient = null;
  }
} else if (process.env.NODE_ENV !== 'test') {
  logger.warn('No Upstash Redis configuration found. Rate limiting will be disabled.');
}

const getIdentifier = (req, userId) => {
  if (userId) return userId;
  // Use `x-forwarded-for` as Vercel sets this. Fallback for local dev.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded || req.ip || 'unknown';
};

export async function checkRateLimit(req, { limit = 20, userId = null } = {}) {
  // Always allow requests in test environment for simplicity
  if (process.env.NODE_ENV === 'test') return null;

  // If the client is not configured, respect the FAIL_OPEN flag.
  if (!upstashClient) {
    if (FAIL_OPEN) {
      logger.warn('Rate limiter not configured, allowing request due to FAIL_OPEN=true.');
      return null; // Allowed
    }
    logger.error('Rate limiter is not configured and FAIL_OPEN is false. Blocking request.');
    return { error: 'Internal Server Error' }; // Blocked
  }

  const identifier = getIdentifier(req, userId);
  if (identifier === 'unknown') {
    logger.warn('Could not determine a unique identifier for rate limiting. Request allowed.');
    return null; // Cannot enforce limit without a stable identifier
  }

  const key = `ratelimit:${identifier}`;

  try {
    const count = await upstashClient.incr(key);

    // Set expiry only on the first increment in the window
    if (count === 1) {
      await upstashClient.pexpire(key, WINDOW_MS);
    }

    if (count > limit) {
      return { error: 'Too many requests' }; // Blocked
    }

    return null; // Allowed
  } catch (error) {
    logger.error({ err: error, identifier }, 'Upstash command failed during rate limiting.');
    if (FAIL_OPEN) {
      return null; // Allowed
    }
    return { error: 'Internal Server Error' }; // Blocked
  }
}
