import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Client } from '@googlemaps/google-maps-services-js';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { puntos } = req.body;
  if (!puntos || !Array.isArray(puntos) || puntos.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de puntos de venta.' });
  }

  try {
    const puntosToInsert = [];
    for (const punto of puntos) {
      if (!punto.nombre || !punto.direccion || !punto.ciudad) {
        // Skip rows with missing essential data
        console.warn('Skipping point of sale due to missing data:', punto);
        continue;
      }

      let latitud = null;
      let longitud = null;

      try {
        const geocodeRequest = {
          params: {
            address: `${punto.direccion}, ${punto.ciudad}, Colombia`,
            key: process.env.GOOGLE_MAPS_API_KEY || 'YOUR_TEST_API_KEY',
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
        console.error(`Geocoding failed for address: ${punto.direccion}`, e);
        // Continue without coordinates if geocoding fails
      }

      puntosToInsert.push({
        nombre: punto.nombre,
        direccion: punto.direccion,
        ciudad: punto.ciudad,
        latitud,
        longitud,
      });
    }

    if (puntosToInsert.length === 0) {
      return res.status(400).json({ error: 'Ningún punto de venta en el archivo era válido para importar.' });
    }

    const { error } = await supabase.from('puntos_de_venta').insert(puntosToInsert);

    if (error) {
      throw new Error(`Error en la base de datos: ${error.message}`);
    }

    res.status(200).json({ message: `${puntosToInsert.length} puntos de venta importados con éxito.` });
  } catch (error) {
    console.error('Error during bulk import:', error);
    res.status(500).json({ error: 'Ocurrió un error durante la importación masiva.' });
  }
}
