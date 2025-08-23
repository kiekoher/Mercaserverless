const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { getCacheClient } = require('../../lib/redisCache');
const { checkRateLimit } = require('../../lib/rateLimiter');

async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const cache = getCacheClient();
  const cacheKey = 'dashboard:stats';
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    }
  }

  const { data, error } = await supabase.rpc('get_dashboard_stats');

  if (error) {
    throw error;
  }

  if (cache) {
    res.setHeader('X-Cache', 'MISS');
    await cache.set(cacheKey, JSON.stringify(data), { ex: 60 });
  }

  res.status(200).json(data);
}

module.exports = withLogging(handler);;
