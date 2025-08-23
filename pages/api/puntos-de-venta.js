import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../../lib/logger.server';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';
import { sanitizeInput } from '../../lib/sanitize';
import { requireUser } from '../../lib/auth';
import geocodeConfig from '../../lib/geocodeConfig';
import { getCacheClient } from '../../lib/redisCache';

const PDV_FIELDS =
  'id,nombre,direccion,ciudad,latitud,longitud,cuota,tipologia,frecuencia_mensual,minutos_servicio';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      nombre: z.string().min(1),
      direccion: z.string().min(1),
      ciudad: z.string().min(1),
      cuota: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? null : parseFloat(val)),
        z.number().nullable().optional()
      ),
      tipologia: z.preprocess(
        (val) => (val === '' || val === undefined ? null : val),
        z.string().nullable().optional()
      ),
      frecuencia_mensual: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)),
        z.number().int().nullable().optional()
      ),
      minutos_servicio: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? null : parseInt(val, 10)),
        z.number().int().nullable().optional()
      ),
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
        if (cached) {
          [latitud, longitud] = JSON.parse(cached);
        }
      }

      if (latitud === null || longitud === null) {
        const geocodeRequest = {
          params: {
            address: `${direccion}, ${ciudad}, Colombia`,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
          timeout: geocodeConfig.GEOCODE_TIMEOUT_MS,
        };

        const geocodeResponse = await googleMapsClient.geocode(geocodeRequest);
        if (geocodeResponse.data.results.length > 0) {
          const location = geocodeResponse.data.results[0].geometry.location;
          latitud = location.lat;
          longitud = location.lng;
          if (hasCache && cacheKey) {
            await cache.set(cacheKey, JSON.stringify([latitud, longitud]), { ex: 60 * 60 * 24 * 30 });
          }
        } else {
          logger.warn({ direccion, ciudad }, 'Geocoding failed for address');
        }
      }
    } catch (e) {
      logger.error({ err: e }, 'Geocoding API error');
      // Non-blocking error: proceed to save the point of sale even if geocoding fails.
    }

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .insert({
        nombre: safeNombre,
        direccion: safeDireccion,
        ciudad: safeCiudad,
        latitud,
        longitud,
        cuota,
        tipologia: tipologia ? sanitizeInput(tipologia) : null,
        frecuencia_mensual,
        minutos_servicio,
      })
      .select(PDV_FIELDS)
      .single();

    if (error) {
      logger.error({ err: error }, 'Error inserting point of sale');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      id: z.number().int(),
      nombre: z.string().min(1),
      direccion: z.string().min(1),
      ciudad: z.string().min(1),
      cuota: z.preprocess(
        (val) => (val === '' || val === null ? null : parseFloat(val)),
        z.number().nullable().optional()
      ),
      tipologia: z.preprocess(
        (val) => (val === '' ? null : val),
        z.string().nullable().optional()
      ),
      frecuencia_mensual: z.preprocess(
        (val) => (val === '' || val === null ? null : parseInt(val, 10)),
        z.number().int().nullable().optional()
      ),
      minutos_servicio: z.preprocess(
        (val) => (val === '' || val === null ? null : parseInt(val, 10)),
        z.number().int().nullable().optional()
      ),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ error: parsed.error.format() }, 'Invalid update payload for punto de venta');
      return res.status(400).json({ error: 'Datos inválidos.', details: parsed.error.format() });
    }

    const { id, nombre, direccion, ciudad, cuota, tipologia, frecuencia_mensual, minutos_servicio } = parsed.data;

    const updatePayload = {
      nombre: sanitizeInput(nombre),
      direccion: sanitizeInput(direccion),
      ciudad: sanitizeInput(ciudad),
      cuota,
      tipologia: tipologia ? sanitizeInput(tipologia) : null,
      frecuencia_mensual,
      minutos_servicio,
    };

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .update(updatePayload)
      .eq('id', id)
      .select(PDV_FIELDS)
      .single();

    if (error) {
      logger.error({ err: error }, 'Error updating point of sale');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({ id: z.coerce.number().int().positive() });
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'ID de punto de venta inválido.' });
    }
    const { id } = parsed.data;

    const { error } = await supabase
      .from('puntos_de_venta')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ err: error }, 'Error deleting point of sale');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json({ message: 'Punto de venta eliminado' });

  } else if (req.method === 'GET') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      search: z.string().optional().default(''),
      all: z.enum(['true', 'false']).optional().default('false'),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parámetros de consulta inválidos.' });
    }
    const { page, search, all } = parsed.data;
    const safeSearch = sanitizeInput(search).slice(0, 50);

    if (all === 'true') {
      const { data, error } = await supabase.from('puntos_de_venta').select(PDV_FIELDS);
      if (error) {
        logger.error({ err: error }, 'Error fetching all points of sale');
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      return res.status(200).json(data);
    }

    const limit = 10;
    const offset = (page - 1) * limit;

    const query = supabase.from('puntos_de_venta').select(PDV_FIELDS, { count: 'exact' });

    if (safeSearch) {
      query.ilike('nombre', `%${safeSearch}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ err: error }, 'Error fetching paginated points of sale');
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.setHeader('X-Total-Count', count);
    return res.status(200).json(data);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
