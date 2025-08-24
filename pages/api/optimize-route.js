const { Client } = require('@googlemaps/google-maps-services-js');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getCacheClient } = require('../../lib/redisCache');
const { sanitizeInput } = require('../../lib/sanitize');

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }


  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY no configurada');
  }

  const { error: authError, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  const puntoSchema = z.object({
    id: z.number().int(),
    direccion: z.string().min(1),
    ciudad: z.string().min(1)
  });
  const schema = z.object({
    puntos: z.array(puntoSchema).min(2),
    modo_transporte: z.enum(['driving', 'walking', 'transit']).optional().default('driving')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Formato de puntos inválido o modo de transporte no soportado.' });
  }

  const { puntos, modo_transporte } = parsed.data;

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const client = new Client({});
  const addresses = puntos.map(p => `${sanitizeInput(p.direccion)}, ${sanitizeInput(p.ciudad)}, Colombia`);

  const cache = getCacheClient();
  const hasCache = cache && typeof cache.get === 'function';
  const cacheKey = hasCache
    ? `optimize:${modo_transporte}:${addresses.join('|')}`
    : null;
  if (hasCache && cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    }
  }

  try {
    const origin = addresses[0];
    const waypoints = addresses.slice(1);
    const directions = await client.directions({
      params: {
        origin,
        destination: origin,
        waypoints: ['optimize:true', ...waypoints],
        mode: modo_transporte,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const order = directions.data.routes[0].waypoint_order || [];
    const optimizedPuntos = [puntos[0], ...order.map(i => puntos[i + 1])];
    const payload = { optimizedPuntos };

    if (hasCache && cacheKey) {
      res.setHeader('X-Cache', 'MISS');
      await cache.set(cacheKey, JSON.stringify(payload), { ex: 60 * 60 });
    }
    res.status(200).json(payload);

  } catch (error) {
    logger.error({ err: error, userId: user.id }, 'Directions API optimization error');
    // Re-throw for the HOF to catch and log centrally
    throw new Error('No se pudo optimizar la ruta.');
  }
}

module.exports = withLogging(handler);;
