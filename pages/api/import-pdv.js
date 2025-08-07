import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../../lib/logger';
import pLimit from 'p-limit';
import { z } from 'zod';
import { checkRateLimit } from '../../lib/rateLimiter';
import { verifyCsrf } from '../../lib/csrf';

const googleMapsClient = new Client({});

// Importación masiva con geocodificación paralela y manejo de errores por punto
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!verifyCsrf(req, res)) return;

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    logger.error('GOOGLE_MAPS_API_KEY is not configured');
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logger.warn('Unauthorized access attempt to import-pdv');
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

  if (!profile || !['supervisor', 'admin'].includes(profile.role)) {
    logger.warn({ userId: user.id, role: profile?.role }, 'Forbidden access attempt to import-pdv');
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const puntoSchema = z.object({
    nombre: z.string().min(1),
    direccion: z.string().min(1),
    ciudad: z.string().min(1)
  });
  const schema = z.array(puntoSchema).min(1);
  const parsed = schema.safeParse(req.body.puntos);
  if (!parsed.success) {
    logger.warn('Bad request to import-pdv: "puntos" array is missing or malformed.');
    return res.status(400).json({ error: 'Se requiere un array válido de puntos de venta.' });
  }
  const puntos = parsed.data;

  const MAX_IMPORT_SIZE = 500;
  if (puntos.length > MAX_IMPORT_SIZE) {
    logger.warn({ importSize: puntos.length }, 'Payload too large for import-pdv');
    return res.status(413).json({ error: `La importación está limitada a ${MAX_IMPORT_SIZE} puntos de venta por solicitud.` });
  }

  try {
    // Procesar geocodificación en paralelo con un límite de concurrencia
    const limit = pLimit(5);
    const puntosToInsert = [];

    const tasks = puntos.map(punto => limit(async () => {
      if (!punto.nombre || !punto.direccion || !punto.ciudad) {
        logger.warn({ punto }, 'Skipping point of sale due to missing data');
        return null; // se ignoran puntos inválidos sin interrumpir la importación
      }

      let latitud = null;
      let longitud = null;

      try {
        const geocodeRequest = {
          params: {
            address: `${punto.direccion}, ${punto.ciudad}, Colombia`,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
          timeout: 1000,
        };
        const geocodeResponse = await googleMapsClient.geocode(geocodeRequest);
        if (geocodeResponse.data.results.length > 0) {
          const location = geocodeResponse.data.results[0].geometry.location;
          latitud = location.lat;
          longitud = location.lng;
        }
      } catch (e) {
        logger.error({ err: e, direccion: punto.direccion }, 'Geocoding failed for address');
        // Continue without coordinates if geocoding fails
      }

      return {
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        latitud,
        longitud,
      };
    }));

    const results = await Promise.all(tasks);
    results.forEach(r => { if (r) puntosToInsert.push(r); });

    if (puntosToInsert.length === 0) {
      return res.status(400).json({ error: 'Ningún punto de venta en el archivo era válido para importar.' });
    }

    const { error } = await supabase.from('puntos_de_venta').insert(puntosToInsert);

    if (error) {
      throw new Error(`Error en la base de datos: ${error.message}`);
    }

    res.status(200).json({ message: `${puntosToInsert.length} puntos de venta importados con éxito.` });
  } catch (error) {
    logger.error({ err: error }, 'Error during bulk import');
    res.status(500).json({ error: 'Ocurrió un error durante la importación masiva.' });
  }
}
