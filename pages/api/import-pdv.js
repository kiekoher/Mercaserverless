import { Client } from '@googlemaps/google-maps-services-js';
import { formidable } from 'formidable';
import fs from 'fs';
import Papa from 'papaparse';
import { z } from 'zod';
import pLimit from 'p-limit';
import logger from '../../lib/logger.server';
import { getMyRole } from '../../lib/auth';
import { getCacheClient } from '../../lib/redisCache';
import geocodeConfig from '../../lib/geocodeConfig';
import { getSupabaseServerClient } from '../../lib/supabaseServer';

// Zod schema for validating each row from the CSV.
const PdvSchema = z.object({
  nombre: z.string({ required_error: "La columna 'nombre' es requerida." }).min(1),
  direccion: z.string({ required_error: "La columna 'direccion' es requerida." }).min(1),
  ciudad: z.string({ required_error: "La columna 'ciudad' es requerida." }).min(1),
  cuota: z.string().optional(),
  tipologia: z.string().optional(),
  frecuencia_mensual: z.string().optional(),
  minutos_servicio: z.string().optional(),
});

export const config = {
  api: {
    bodyParser: false, // Use formidable, not Next's body parser.
  },
};

const googleMapsClient = new Client({});
const { GEOCODE_CONCURRENCY, GEOCODE_RETRIES, GEOCODE_TIMEOUT_MS, GEOCODE_RETRY_BASE_MS } = geocodeConfig;
const cache = getCacheClient();

// Main handler for the CSV import feature.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authentication and Authorization
  const supabase = getSupabaseServerClient(req, res);
  const userRole = await getMyRole(supabase);
  if (!userRole || !['admin', 'supervisor'].includes(userRole)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    logger.error('GOOGLE_MAPS_API_KEY is not configured');
    return res.status(500).json({ error: 'Server is misconfigured (missing maps key).' });
  }

  const form = formidable({ maxFileSize: 5 * 1024 * 1024, keepExtensions: true });

  form.parse(req, (err, fields, files) => {
    if (err) {
      logger.error({ err }, 'Error parsing form data for PDV import');
      return res.status(500).json({ error: 'Error processing file upload.' });
    }

    const csvFile = files.csvfile?.[0];
    if (!csvFile || !csvFile.mimetype.includes('csv')) {
      return res.status(400).json({ error: 'A CSV file is required.' });
    }

    const pdvsToProcess = [];
    const validationErrors = [];
    const fileStream = fs.createReadStream(csvFile.filepath);

    // Step 1: Parse and validate the CSV file.
    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim().toLowerCase().replace(/ /g, '_'),
      step: (row, parser) => {
        const validation = PdvSchema.safeParse(row.data);
        if (validation.success) {
          pdvsToProcess.push(validation.data);
        } else {
          validationErrors.push({ row: row.meta.cursor + 1, errors: validation.error.flatten().fieldErrors });
        }
      },
      complete: async () => {
        if (validationErrors.length > 0) {
          return res.status(400).json({ message: 'CSV contains validation errors.', errors: validationErrors });
        }
        if (pdvsToProcess.length === 0) {
          return res.status(400).json({ error: 'CSV file is empty or contains no valid data.' });
        }

        // Step 2: Geocode the validated data in parallel.
        const limit = pLimit(GEOCODE_CONCURRENCY);
        const geocodingTasks = pdvsToProcess.map(pdv => limit(() => geocodePdv(pdv)));

        try {
          const geocodedPdvs = await Promise.all(geocodingTasks);
          const finalPdvs = geocodedPdvs.filter(Boolean); // Filter out any null results from failed geocoding

          if (finalPdvs.length === 0) {
            return res.status(400).json({ error: 'None of the addresses could be geocoded.' });
          }

          // Step 3: Call the bulk upsert database function.
          const { data, error: rpcError } = await supabase.rpc('bulk_upsert_pdv', { pdvs_data: finalPdvs });

          if (rpcError) throw rpcError;

          return res.status(200).json({ message: 'Import completed successfully.', summary: data });

        } catch (error) {
          logger.error({ err: error }, 'An error occurred during the PDV import process.');
          if (error.message.includes('Geocoding quota exceeded')) {
            return res.status(429).json({ error: 'Geocoding API quota exceeded. Please try again later.' });
          }
          return res.status(500).json({ error: 'An internal error occurred during the import.' });
        }
      },
      error: (error) => {
        logger.error({ error }, 'Fatal error parsing CSV file');
        return res.status(500).json({ error: 'Failed to parse CSV file.' });
      },
    });
  });
}

// Helper function to geocode a single Point of Sale with caching and retries.
async function geocodePdv(pdv) {
  const cacheKey = `geo:${pdv.direccion}:${pdv.ciudad}`;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) {
      const [lat, lng] = JSON.parse(cached);
      return formatPdv(pdv, lat, lng);
    }
  } catch (e) {
    logger.warn({ err: e, key: cacheKey }, 'Failed to retrieve from geocode cache');
  }

  for (let i = 0; i < GEOCODE_RETRIES; i++) {
    try {
      const response = await googleMapsClient.geocode({
        params: {
          address: `${pdv.direccion}, ${pdv.ciudad}, Colombia`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
        timeout: GEOCODE_TIMEOUT_MS,
      });

      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        try {
          await cache.set(cacheKey, JSON.stringify([lat, lng]), { ex: 60 * 60 * 24 * 30 }); // Cache for 30 days
        } catch (e) {
          logger.warn({ err: e, key: cacheKey }, 'Failed to save to geocode cache');
        }
        return formatPdv(pdv, lat, lng);
      }
      break; // No results found, no need to retry
    } catch (error) {
      if (error.response?.data?.status === 'OVER_QUERY_LIMIT') {
        throw new Error('Geocoding quota exceeded');
      }
      if (i === GEOCODE_RETRIES - 1) {
        logger.error({ err: error, address: pdv.direccion }, 'Geocoding failed after all retries.');
        return null; // Failed to geocode this address
      }
      const delay = GEOCODE_RETRY_BASE_MS * Math.pow(2, i);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  return null; // Return null if geocoding fails
}

// Helper function to format the final PDV object for the database.
function formatPdv(pdv, lat, lng) {
  return {
    nombre: pdv.nombre,
    direccion: pdv.direccion,
    ciudad: pdv.ciudad,
    latitud: lat,
    longitud: lng,
    cuota: pdv.cuota ? parseFloat(String(pdv.cuota).replace(/[^0-9.-]+/g, "")) : null,
    tipologia: pdv.tipologia || null,
    frecuencia_mensual: pdv.frecuencia_mensual ? parseInt(pdv.frecuencia_mensual, 10) : null,
    minutos_servicio: pdv.minutos_servicio ? parseInt(pdv.minutos_servicio, 10) : null,
  };
}
