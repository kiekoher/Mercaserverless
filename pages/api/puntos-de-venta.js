const { Client } = require('@googlemaps/google-maps-services-js');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { verifyCsrf } = require('../../lib/csrf');
const geocodeConfig = require('../../lib/geocodeConfig');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { getCacheClient } = require('../../lib/redisCache');
const { sanitizeInput } = require('../../lib/sanitize');

const PDV_FIELDS =
  'id,nombre,direccion,ciudad,latitud,longitud,cuota,tipologia,frecuencia_mensual,minutos_servicio';

const googleMapsClient = new Client({});

async function handler(req, res) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY no configurada');
  }

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      nombre: z.string().min(1),
      direccion: z.string().min(1),
      ciudad: z.string().min(1),
      cuota: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseFloat(val)), z.number().nullable().optional()),
      tipologia: z.preprocess((val) => (val === '' || val === undefined ? null : val), z.string().nullable().optional()),
      frecuencia_mensual: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().nullable().optional()),
      minutos_servicio: z.preprocess((val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)), z.number().int().nullable().optional()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const { nombre, direccion, ciudad, cuota, tipologia, frecuencia_mensual, minutos_servicio } = parsed.data;
    const safeNombre = sanitizeInput(nombre);
    const safeDireccion = sanitizeInput(direccion);
    const safeCiudad = sanitizeInput(ciudad);

    let latitud = null;
    let longitud = null;

    try {
      const cache = getCacheClient();
      const hasCache = cache && typeof cache.get === 'function';
      const cacheKey = hasCache ? `geo:${sanitizeInput(direccion)}:${sanitizeInput(ciudad)}` : null;
      if (hasCache && cacheKey) {
        const cached = await cache.get(cacheKey);
        if (cached) [latitud, longitud] = JSON.parse(cached);
      }

      if (latitud === null || longitud === null) {
        const geocodeResponse = await googleMapsClient.geocode({
          params: { address: `${direccion}, ${ciudad}, Colombia`, key: process.env.GOOGLE_MAPS_API_KEY },
          timeout: geocodeConfig.GEOCODE_TIMEOUT_MS,
        });
        if (geocodeResponse.data.results.length > 0) {
          const location = geocodeResponse.data.results[0].geometry.location;
          latitud = location.lat;
          longitud = location.lng;
          if (hasCache && cacheKey) await cache.set(cacheKey, JSON.stringify([latitud, longitud]), { ex: 60 * 60 * 24 * 30 });
        } else {
          logger.warn({ direccion, ciudad, userId: user.id }, 'Geocoding failed for address');
        }
      }
    } catch (e) {
      logger.error({ err: e, userId: user.id }, 'Geocoding API error');
    }

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .insert({ nombre: safeNombre, direccion: safeDireccion, ciudad: safeCiudad, latitud, longitud, cuota, tipologia: tipologia ? sanitizeInput(tipologia) : null, frecuencia_mensual, minutos_servicio })
      .select(PDV_FIELDS)
      .single();

    if (error) throw error;
    const cache = getCacheClient();
    if (cache) await cache.del('pdv:all');
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    if (!(await checkRateLimit(req, { userId: user.id }))) return res.status(429).json({ error: 'Too many requests' });

    const schema = z.object({
      id: z.number().int(),
      nombre: z.string().min(1),
      direccion: z.string().min(1),
      ciudad: z.string().min(1),
      cuota: z.preprocess((val) => (val === '' || val === null ? null : parseFloat(val)), z.number().nullable().optional()),
      tipologia: z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional()),
      frecuencia_mensual: z.preprocess((val) => (val === '' || val === null ? null : parseInt(val, 10)), z.number().int().nullable().optional()),
      minutos_servicio: z.preprocess((val) => (val === '' || val === null ? null : parseInt(val, 10)), z.number().int().nullable().optional()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos.', details: parsed.error.format() });
    }
    const { id, ...updatePayloadRaw } = parsed.data;
    const updatePayload = {
      nombre: sanitizeInput(updatePayloadRaw.nombre),
      direccion: sanitizeInput(updatePayloadRaw.direccion),
      ciudad: sanitizeInput(updatePayloadRaw.ciudad),
      cuota: updatePayloadRaw.cuota,
      tipologia: updatePayloadRaw.tipologia ? sanitizeInput(updatePayloadRaw.tipologia) : null,
      frecuencia_mensual: updatePayloadRaw.frecuencia_mensual,
      minutos_servicio: updatePayloadRaw.minutos_servicio,
    };
    const { data, error } = await supabase.from('puntos_de_venta').update(updatePayload).eq('id', id).select(PDV_FIELDS).single();
    if (error) throw error;
    const cache = getCacheClient();
    if (cache) await cache.del('pdv:all');
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!verifyCsrf(req, res)) return;
    if (!(await checkRateLimit(req, { userId: user.id }))) return res.status(429).json({ error: 'Too many requests' });
    const schema = z.object({ id: z.coerce.number().int().positive() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'ID de punto de venta inválido.' });
    const { id } = parsed.data;
    const { error } = await supabase.from('puntos_de_venta').delete().eq('id', id);
    if (error) throw error;
    const cache = getCacheClient();
    if (cache) await cache.del('pdv:all');
    return res.status(200).json({ message: 'Punto de venta eliminado' });

  } else if (req.method === 'GET') {
    if (!(await checkRateLimit(req, { userId: user.id }))) return res.status(429).json({ error: 'Too many requests' });
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      search: z.string().optional().default(''),
      all: z.enum(['true', 'false']).optional().default('false'),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Parámetros de consulta inválidos.' });
    const { page, search, all } = parsed.data;
    const safeSearch = sanitizeInput(search).slice(0, 50);

    if (all === 'true') {
      const cache = getCacheClient();
      const cacheKey = 'pdv:all';
      if (cache) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(200).json(JSON.parse(cached));
        }
      }
      const { data, error } = await supabase.from('puntos_de_venta').select(PDV_FIELDS);
      if (error) throw error;
      if (cache) {
        res.setHeader('X-Cache', 'MISS');
        await cache.set(cacheKey, JSON.stringify(data), { ex: 60 });
      }
      return res.status(200).json(data);
    }

    const limit = 10;
    const offset = (page - 1) * limit;
    const query = supabase.from('puntos_de_venta').select(PDV_FIELDS, { count: 'exact' });
    if (safeSearch) query.ilike('nombre', `%${safeSearch}%`);
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    res.setHeader('X-Total-Count', count);
    return res.status(200).json(data);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

module.exports = withLogging(handler);;
