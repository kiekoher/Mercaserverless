import { getSupabaseServerClient } from '../../lib/supabaseServer';
import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../../lib/logger';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const supabase = getSupabaseServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.error({ err: profileError }, 'Error fetching profile');
    return res.status(500).json({ error: 'Error fetching user profile' });
  }

  if (!profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
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
      .insert({ nombre, direccion, ciudad, latitud, longitud })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      id: z.number().int(),
      nombre: z.string().min(1),
      direccion: z.string().min(1),
      ciudad: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const { id, nombre, direccion, ciudad } = parsed.data;

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .update({ nombre, direccion, ciudad })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ message: 'Punto de venta eliminado' });

  } else if (req.method === 'GET') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { page = '1', search = '', all } = req.query;

    if (all === 'true') {
      const { data, error } = await supabase.from('puntos_de_venta').select('*');
      if (error) {
        return res.status(500).json({ error: error.message });
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

    if (search) {
      query.ilike('nombre', `%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.setHeader('X-Total-Count', count);
    return res.status(200).json(data);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
