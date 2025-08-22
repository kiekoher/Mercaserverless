import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../../lib/logger.server';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';
import { sanitizeInput } from '../../lib/sanitize';
import { requireUser } from '../../lib/auth';

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
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const { nombre, direccion, ciudad } = parsed.data;
    const safeNombre = sanitizeInput(nombre);
    const safeDireccion = sanitizeInput(direccion);
    const safeCiudad = sanitizeInput(ciudad);

    let latitud = null;
    let longitud = null;

    try {
      const geocodeRequest = {
        params: {
          address: `${direccion}, ${ciudad}, Colombia`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: 1000, // optional
      };

      const geocodeResponse = await googleMapsClient.geocode(geocodeRequest);
      if (geocodeResponse.data.results.length > 0) {
        const location = geocodeResponse.data.results[0].geometry.location;
        latitud = location.lat;
        longitud = location.lng;
      } else {
        logger.warn({ direccion, ciudad }, 'Geocoding failed for address');
      }
    } catch (e) {
      logger.error({ err: e }, 'Geocoding API error');
      // Non-blocking error: proceed to save the point of sale even if geocoding fails.
    }

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .insert({ nombre: safeNombre, direccion: safeDireccion, ciudad: safeCiudad, latitud, longitud })
      .select()
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
      .select()
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

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const { error } = await supabase
      .from('puntos_de_venta')
      .delete()
      .eq('id', Number(id));

    if (error) {
      logger.error({ err: error }, 'Error deleting point of sale');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json({ message: 'Punto de venta eliminado' });

  } else if (req.method === 'GET') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const { page = '1', search = '', all } = req.query;
    const safeSearch = sanitizeInput(search).slice(0, 50);

    if (all === 'true') {
      const { data, error } = await supabase.from('puntos_de_venta').select('*');
      if (error) {
        logger.error({ err: error }, 'Error fetching all points of sale');
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      return res.status(200).json(data);
    }

    const pageNumber = parseInt(page, 10);
    if (Number.isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'Parámetro page inválido' });
    }

    const limit = 10;
    const offset = (pageNumber - 1) * limit;

    const query = supabase.from('puntos_de_venta').select('*', { count: 'exact' });

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
