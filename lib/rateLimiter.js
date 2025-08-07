import Redis from 'ioredis';

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

export async function checkRateLimit(req, limit = 10) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';

  if (!ip) return true;

  if (redisClient) {
    const key = `ratelimit:${ip}`;
    const [[, count]] = await redisClient
      .multi()
      .incr(key)
      .pexpire(key, WINDOW_MS)
      .exec();
    return count <= limit;
  }

  const now = Date.now();
  const entry = localHits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  localHits.set(ip, entry);
  return entry.count <= limit;
}

