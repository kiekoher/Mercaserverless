import Redis from 'ioredis';
import logger from './logger'; // Importar el logger

const WINDOW_MS = 60_000; // 1 minute window
let redisClient;
const localHits = new Map();

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

// Limpieza periódica para el fallback en memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of localHits) {
    if (now - entry.start > WINDOW_MS) {
      localHits.delete(ip);
    }
  }
}).unref();

const getIdentifier = (req, userId) => {
  if (userId) {
    return userId;
  }
  const forwarded = req.headers?.['x-forwarded-for'];
  return Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
};

export async function checkRateLimit(req, { limit = 10, userId = null } = {}) {
  const identifier = getIdentifier(req, userId);

  if (identifier === 'unknown') {
    logger.warn('Could not determine identifier for rate limiting.');
    return true; // Fail open if we can't identify the user/ip
  }

  if (redisClient) {
    try {
      const key = `ratelimit:${identifier}`;
      const [[, count]] = await redisClient
        .multi()
        .incr(key)
        .pexpire(key, WINDOW_MS)
        .exec();
      return count <= limit;
    } catch (error) {
      logger.error({ err: error, identifier }, 'Redis rate limit failed, falling back to in-memory.');
    }
  }

  // Fallback to in-memory store
  const now = Date.now();
  const entry = localHits.get(identifier) || { count: 0, start: now };

  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  localHits.set(identifier, entry);

  return entry.count <= limit;
}

