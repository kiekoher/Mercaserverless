const WINDOW_MS = 60_000; // 1 minute
const hits = new Map();

// Limpieza periódica para evitar uso excesivo de memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.start > WINDOW_MS) {
      hits.delete(ip);
    }
  }
}, WINDOW_MS).unref();

export function checkRateLimit(req, limit = 10) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';

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

