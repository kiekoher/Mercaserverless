import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
import logger from './logger.server';

const WINDOW_MS = 60 * 1000; // 1 minute
const localHits = new LRUCache({ max: 1000, ttl: WINDOW_MS });
let redisClient;

// Attempt to connect to Redis if the URL is provided
if (process.env.UPSTASH_REDIS_URL) {
  try {
    redisClient = new Redis(process.env.UPSTASH_REDIS_URL, {
      // Add a connect timeout to prevent hanging
      connectTimeout: 5000,
      // Disable offline queue to avoid memory growth when Redis is unreachable
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error. Rate limiter may degrade.');
    });

    redisClient.on('connect', () => {
      logger.info('Successfully connected to Redis for rate limiting.');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create Redis client instance.');
    redisClient = null; // Ensure client is null if instantiation fails
  }
} else {
  logger.warn('UPSTASH_REDIS_URL not configured. Rate limiter will fall back to in-memory store.');
  redisClient = null;
}

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
  const failOpen =
    process.env.NODE_ENV === 'production'
      ? false
      : process.env.RATE_LIMIT_FAIL_OPEN === 'true';
  if (!failOpen && process.env.NODE_ENV === 'production') {
    logger.error({ identifier }, 'Redis not available for rate limiting in PRODUCTION. Request blocked.');
    return false;
  }

  logger.warn({ identifier }, 'Redis not available. Using in-memory rate limiting.');
  const entry = localHits.get(key) || { count: 0 };
  entry.count += 1;
  localHits.set(key, entry);
  return entry.count <= limit;
}

export function closeRedis() {
  if (redisClient) {
    redisClient.quit();
    redisClient = null;
  }
}
