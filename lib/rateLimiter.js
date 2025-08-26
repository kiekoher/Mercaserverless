import { Redis as UpstashRedis } from '@upstash/redis';
import logger from './logger.server';

const WINDOW_MS = 60 * 1000; // 1 minute
let upstashClient;

// Fail closed by default; explicitly set RATE_LIMIT_FAIL_OPEN=true to bypass
// rate limiting when Upstash encounters an error while configured.
const FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN === 'true';

// In the test environment (identified by the custom flag), we explicitly disable the Upstash client.
if (process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'true') {
  upstashClient = null;
} else if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
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
} else {
  logger.warn('No Upstash Redis configuration found. Rate limiting will be disabled.');
  upstashClient = null;
}

const getIdentifier = (req, userId) => {
  if (userId) return userId;
  // Use `x-forwarded-for` as Vercel sets this. Fallback for local dev.
  const headers = req.headers || {};
  const forwarded = typeof headers.get === 'function' ? headers.get('x-forwarded-for') : headers['x-forwarded-for'];
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

export async function checkRateLimit(req, { limit = 20, userId = null } = {}) {
  // Always allow requests in test environment for simplicity
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'true') {
    return true;
  }

  // If the client is not configured, allow the request but log the event.
  if (!upstashClient) {
    logger.warn('Rate limiter not configured, allowing request.');
    return true;
  }

  const identifier = getIdentifier(req, userId);
  if (identifier === 'unknown') {
    logger.warn('Could not determine a unique identifier for rate limiting. Request allowed.');
    return true; // Cannot enforce limit without a stable identifier
  }

  const key = `ratelimit:${identifier}`;

  try {
    const count = await upstashClient.incr(key);

    // Set expiry only on the first increment in the window
    if (count === 1) {
      await upstashClient.pexpire(key, WINDOW_MS);
    }

    if (count > limit) {
      return false; // Blocked
    }

    return true; // Allowed
  } catch (error) {
    logger.error({ err: error, identifier }, 'Upstash command failed during rate limiting.');
    return FAIL_OPEN ? true : false;
  }
}

export function closeRedis() {
  // The Upstash REST client does not maintain persistent connections,
  // but this function is provided for API compatibility in tests.
  upstashClient = null;
}
