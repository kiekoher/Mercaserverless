import { Client } from '@googlemaps/google-maps-services-js';
import logger from '../../lib/logger.server';
import pLimit from 'p-limit';
import { z } from 'zod';
import { checkRateLimit } from '../../lib/rateLimiter';
import { verifyCsrf } from '../../lib/csrf';
import { sanitizeInput } from '../../lib/sanitize';
import { requireUser } from '../../lib/auth';

const googleMapsClient = new Client({});

const GEOCODE_TIMEOUT_MS = parseInt(process.env.GEOCODE_TIMEOUT_MS || '1000', 10);
const GEOCODE_RETRIES = parseInt(process.env.GEOCODE_RETRIES || '3', 10);
const GEOCODE_CONCURRENCY = parseInt(process.env.GEOCODE_CONCURRENCY || '5', 10);
const GEOCODE_RETRY_BASE_MS = parseInt(process.env.GEOCODE_RETRY_BASE_MS || '100', 10);

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

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const puntoSchema = z.object({
    nombre: z.string().min(1),
    direccion: z.string().min(1),
    ciudad: z.string().min(1),
    // Nuevos campos opcionales
    CUOTA: z.string().optional(),
    TIPOLOGIA: z.string().optional(),
    FRECUENCIA: z.string().optional(),
    'MINUTOS SERVICIO': z.string().optional()
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
    const limit = pLimit(GEOCODE_CONCURRENCY);
    const puntosToInsert = [];

    const tasks = puntos.map(punto => limit(async () => {
      if (!punto.nombre || !punto.direccion || !punto.ciudad) {
        logger.warn({ punto }, 'Skipping point of sale due to missing data');
        return null; // se ignoran puntos inválidos sin interrumpir la importación
      }

      let latitud = null;
      let longitud = null;

      for (let attempt = 1; attempt <= GEOCODE_RETRIES; attempt++) {
        try {
          const geocodeRequest = {
            params: {
              address: `${sanitizeInput(punto.direccion)}, ${sanitizeInput(punto.ciudad)}, Colombia`,
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
            timeout: GEOCODE_TIMEOUT_MS,
          };
          const geocodeResponse = await googleMapsClient.geocode(geocodeRequest);
          // Defensive check to prevent crash on undefined response
          if (geocodeResponse && geocodeResponse.data && geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
            const location = geocodeResponse.data.results[0].geometry.location;
            latitud = location.lat;
            longitud = location.lng;
          }
          break;
        } catch (e) {
          if (attempt === GEOCODE_RETRIES) {
            logger.error({ err: e, direccion: punto.direccion }, 'Geocoding failed for address');
          } else {
            const delay = GEOCODE_RETRY_BASE_MS * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
          }
          if (e.response?.data?.status === 'OVER_QUERY_LIMIT') {
            throw new Error('Geocoding quota exceeded');
          }
        }
      }

      // Limpieza y conversión de tipos para los nuevos campos
      const cuota = punto.CUOTA ? parseFloat(String(punto.CUOTA).replace(/[^0-9.-]+/g,"")) : null;
      const frecuencia_mensual = punto.FRECUENCIA ? parseInt(punto.FRECUENCIA, 10) : null;
      const minutos_servicio = punto['MINUTOS SERVICIO'] ? parseInt(punto['MINUTOS SERVICIO'], 10) : null;

      return {
        nombre: sanitizeInput(punto.nombre),
        direccion: sanitizeInput(punto.direccion),
        ciudad: sanitizeInput(punto.ciudad),
        latitud,
        longitud,
        cuota: !isNaN(cuota) ? cuota : null,
        tipologia: punto.TIPOLOGIA ? sanitizeInput(punto.TIPOLOGIA) : null,
        frecuencia_mensual: !isNaN(frecuencia_mensual) ? frecuencia_mensual : null,
        minutos_servicio: !isNaN(minutos_servicio) ? minutos_servicio : null,
      };
    }));

    const results = await Promise.all(tasks);
    results.forEach(r => { if (r) puntosToInsert.push(r); });

    if (puntosToInsert.length === 0) {
      return res.status(400).json({ error: 'Ningún punto de venta en el archivo era válido para importar.' });
    }

    const { error } = await supabase.from('puntos_de_venta').insert(puntosToInsert);

    if (error) {
      logger.error({ err: error }, 'Database insert error during bulk import');
      throw new Error('Error en la base de datos');
    }

    res.status(200).json({ message: `${puntosToInsert.length} puntos de venta importados con éxito.` });
  } catch (error) {
    if (error.message === 'Geocoding quota exceeded') {
      logger.error('Geocoding quota exceeded during import');
      return res.status(429).json({ error: 'Límite de geocodificación alcanzado. Intenta más tarde.' });
    }
    logger.error({ err: error }, 'Error during bulk import');
    res.status(500).json({ error: 'Ocurrió un error durante la importación masiva.' });
  }
}
