const WINDOW_MS = 60_000; // 1 minute
const hits = new Map();

export function checkRateLimit(req, limit = 10) {
  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count <= limit;
}

