import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';
import logger from './logger.server';

const WINDOW_MS = 60 * 1000; // 1 minute
const localHits = new LRUCache({ max: 1000, ttl: WINDOW_MS });
let redisClient;
let upstashClient;
const FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN === 'true';
let degradedLogged = false;

// Attempt Upstash REST client first
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
} else if (process.env.UPSTASH_REDIS_URL) {
  // Fallback to ioredis connection
  try {
    redisClient = new Redis(process.env.UPSTASH_REDIS_URL, {
      connectTimeout: 5000,
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
    redisClient = null;
  }
} else {
  logger.warn('No Redis configuration found. Rate limiter will fall back to in-memory store.');
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

  // --- Primary Strategy: Upstash REST ---
  if (upstashClient) {
    try {
      const count = await upstashClient.incr(key);
      if (count === 1) {
        await upstashClient.pexpire(key, WINDOW_MS);
      }
      return count <= limit;
    } catch (error) {
      logger.error({ err: error, identifier }, 'Upstash REST command failed.');
      if (FAIL_OPEN) {
        logger.warn({ identifier }, 'Fail-open is enabled. Allowing request.');
        return true;
      }
    }
  }

  // --- Secondary Strategy: Redis connection ---
  if (redisClient && redisClient.status === 'ready') {
    try {
      const results = await redisClient.multi().incr(key).exec();
      if (!Array.isArray(results) || !results[0]) {
        throw new Error('Redis exec returned null');
      }
      const count = results[0][1];
      if (count === 1) {
        await redisClient.pexpire(key, WINDOW_MS);
      }
      return count <= limit;
    } catch (error) {
      logger.error({ err: error, identifier }, 'Redis command failed.');
      if (FAIL_OPEN) {
        logger.warn({ identifier }, 'Fail-open is enabled. Allowing request.');
        return true;
      }
    }
  }

  if (!degradedLogged) {
    logger.warn({ event: 'ratelimit_degraded' }, 'Rate limiter degraded to in-memory store.');
    degradedLogged = true;
  }
  if (FAIL_OPEN) {
    logger.warn({ identifier }, 'Fail-open is enabled. Allowing request.');
    return true;
  }
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

export function getRedisClient() {
  return redisClient;
}
