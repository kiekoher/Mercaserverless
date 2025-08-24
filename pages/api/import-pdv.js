const { Client } = require('@googlemaps/google-maps-services-js');
const formidable = require('formidable');
const fs = require('fs');
const Papa = require('papaparse');
const { z } = require('zod');
const pLimit = require('p-limit').default;
const logger = require('../../lib/logger.server');
const { requireUser } = require('../../lib/auth');
const { getCacheClient } = require('../../lib/redisCache');
const geocodeConfig = require('../../lib/geocodeConfig');
const { withLogging } = require('../../lib/api-logger');

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
    bodyParser: false,
  },
};

const googleMapsClient = new Client({});
const { GEOCODE_CONCURRENCY, GEOCODE_RETRIES, GEOCODE_TIMEOUT_MS, GEOCODE_RETRY_BASE_MS } = geocodeConfig;
const cache = getCacheClient();

async function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function parseCsv(filepath) {
  return new Promise((resolve, reject) => {
    const pdvsToProcess = [];
    const validationErrors = [];
    const fileStream = fs.createReadStream(filepath);

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim().toLowerCase().replace(/ /g, '_'),
      step: (row) => {
        const validation = PdvSchema.safeParse(row.data);
        if (validation.success) {
          pdvsToProcess.push(validation.data);
        } else {
          validationErrors.push({ row: row.meta.cursor + 1, errors: validation.error.flatten().fieldErrors });
        }
      },
      complete: () => {
        if (validationErrors.length > 0) {
          const error = new Error('CSV contains validation errors.');
          error.validationDetails = validationErrors;
          reject(error);
        } else {
          resolve(pdvsToProcess);
        }
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV file: ${error.message}`));
      },
    });
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { error: authError, supabase } = await requireUser(req, res, ['admin', 'supervisor']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('Server is misconfigured (missing maps key).');
  }

  const { files } = await parseForm(req);
  const csvFile = files.csvfile?.[0];
  if (!csvFile || !csvFile.mimetype.includes('csv')) {
    return res.status(400).json({ error: 'A CSV file is required.' });
  }

  let pdvsToProcess;
  try {
    pdvsToProcess = await parseCsv(csvFile.filepath);
  } catch (error) {
    if (error.validationDetails) {
      return res.status(400).json({ message: error.message, errors: error.validationDetails });
    }
    return res.status(500).json({ error: error.message });
  }

  if (pdvsToProcess.length === 0) {
    return res.status(400).json({ error: 'CSV file is empty or contains no valid data.' });
  }

  const limit = pLimit(GEOCODE_CONCURRENCY);
  const geocodingTasks = pdvsToProcess.map(pdv => limit(() => geocodePdv(pdv)));
  const geocodedPdvs = await Promise.all(geocodingTasks);
  const finalPdvs = geocodedPdvs.filter(Boolean);

  if (finalPdvs.length === 0) {
    return res.status(400).json({ error: 'None of the addresses could be geocoded.' });
  }

  const { data, error: rpcError } = await supabase.rpc('bulk_upsert_pdv', { pdvs_data: finalPdvs });
  if (rpcError) {
    if (rpcError.message.includes('Geocoding quota exceeded')) {
      return res.status(429).json({ error: 'Geocoding API quota exceeded. Please try again later.' });
    }
    throw rpcError;
  }

  return res.status(200).json({ message: 'Import completed successfully.', summary: data });
}

async function geocodePdv(pdv) {
  const cacheKey = `geo:${pdv.direccion}:${pdv.ciudad}`;
  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        const [lat, lng] = JSON.parse(cached);
        return formatPdv(pdv, lat, lng);
      }
    } catch (e) {
      logger.warn({ err: e, key: cacheKey }, 'Failed to retrieve from geocode cache');
    }
  }

  for (let i = 0; i < GEOCODE_RETRIES; i++) {
    try {
      const response = await googleMapsClient.geocode({
        params: { address: `${pdv.direccion}, ${pdv.ciudad}, Colombia`, key: process.env.GOOGLE_MAPS_API_KEY },
        timeout: GEOCODE_TIMEOUT_MS,
      });
      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        if (cache) {
          try {
            await cache.set(cacheKey, JSON.stringify([lat, lng]), { ex: 60 * 60 * 24 * 30 });
          } catch (e) {
            logger.warn({ err: e, key: cacheKey }, 'Failed to save to geocode cache');
          }
        }
        return formatPdv(pdv, lat, lng);
      }
      break;
    } catch (error) {
      if (error.response?.data?.status === 'OVER_QUERY_LIMIT') throw new Error('Geocoding quota exceeded');
      if (i === GEOCODE_RETRIES - 1) {
        logger.error({ err: error, address: pdv.direccion }, 'Geocoding failed after all retries.');
        return null;
      }
      const delay = GEOCODE_RETRY_BASE_MS * Math.pow(2, i);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  return null;
}

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

module.exports = withLogging(handler);;
