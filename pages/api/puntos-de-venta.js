import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { Client } from '@googlemaps/google-maps-services-js';

const googleMapsClient = new Client({});

export default async function handler(req, res) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const supabase = createPagesServerClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  if (req.method === 'POST') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { nombre, direccion, ciudad } = req.body;
    if (!nombre || !direccion || !ciudad) {
      return res.status(400).json({ error: 'Nombre, dirección y ciudad son requeridos.' });
    }

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
        console.warn(`Geocoding failed for address: ${direccion}, ${ciudad}`);
      }
    } catch (e) {
      console.error('Geocoding API error:', e);
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

  } else if (req.method === 'GET') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { page = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;

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
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
