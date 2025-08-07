import { Client } from '@googlemaps/google-maps-services-js';
import { checkRateLimit } from '../../lib/rateLimiter';
import logger from '../../lib/logger';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const { puntos } = req.body;
  if (!puntos || !Array.isArray(puntos) || puntos.length < 2) {
    return res.status(400).json({ error: 'Se requiere una lista de al menos 2 puntos de venta.' });
  }

  if (!checkRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const client = new Client({});
  const addresses = puntos.map(p => `${p.direccion}, ${p.ciudad}, Colombia`);

  try {
    const origin = addresses[0];
    const waypoints = addresses.slice(1);
    const directions = await client.directions({
      params: {
        origin,
        destination: origin,
        waypoints: ['optimize:true', ...waypoints],
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const order = directions.data.routes[0].waypoint_order || [];
    const optimizedPuntos = [puntos[0], ...order.map(i => puntos[i + 1])];
    res.status(200).json({ optimizedPuntos });
  } catch (error) {
    logger.error({ err: error }, 'Optimization error');
    res.status(500).json({ error: 'No se pudo optimizar la ruta.' });
  }
}
