import Redis from 'ioredis';
import logger from './logger';

const WINDOW_MS = 60 * 1000; // 1 minute
const localHits = new Map();
let redisClient;
const FAIL_OPEN = process.env.RATE_LIMITER_FAIL_OPEN === 'true';

// Attempt to connect to Redis if the URL is provided
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      // Add a connect timeout to prevent hanging
      connectTimeout: 5000,
      // Automatically resend commands on connection loss
      enableOfflineQueue: true,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error. Rate limiter may fail closed.');
    });

    redisClient.on('connect', () => {
      logger.info('Successfully connected to Redis for rate limiting.');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create Redis client instance.');
    redisClient = null; // Ensure client is null if instantiation fails
  }
} else {
  logger.warn('REDIS_URL not configured. Rate limiter will use a less reliable in-memory store.');
}

// Periodic cleanup for the in-memory fallback store
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of localHits.entries()) {
    if (now - entry.start > WINDOW_MS) {
      localHits.delete(key);
    }
  }
}).unref();

const getIdentifier = (req, userId) => {
  if (userId) return userId;
  const forwarded = req.headers['x-forwarded-for'];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

export async function checkRateLimit(req, { limit = 10, userId = null } = {}) {
  const identifier = getIdentifier(req, userId);

  if (identifier === 'unknown') {
    logger.warn('Could not determine a unique identifier for rate limiting. Request allowed.');
    return true; // Cannot enforce limit without a stable identifier
  }

  const key = `ratelimit:${identifier}`;

  // --- Primary Strategy: Redis ---
  if (redisClient && redisClient.status === 'ready') {
    try {
      const [[, count]] = await redisClient
        .multi()
        .incr(key)
        .pexpire(key, WINDOW_MS)
        .exec();
      return count <= limit;
    } catch (error) {
      logger.error({ err: error, identifier }, 'Redis command failed during rate limiting. Failing closed.');
      return false; // Fail closed: Block request if Redis command fails
    }
  }

  // --- Fallback Strategy ---
  if (!FAIL_OPEN && process.env.NODE_ENV === 'production') {
    logger.error('Redis is not available for rate limiting in PRODUCTION. Request blocked.');
    return false;
  }

  const fallbackLimit = FAIL_OPEN ? Math.min(limit, 5) : limit;
  logger.warn({ identifier }, 'Redis not available. Using in-memory rate limiting.');
  const now = Date.now();
  const entry = localHits.get(key) || { count: 0, start: now };

  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  localHits.set(key, entry);

  return entry.count <= fallbackLimit;
}
