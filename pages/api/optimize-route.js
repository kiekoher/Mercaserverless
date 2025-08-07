import { Client } from '@googlemaps/google-maps-services-js';

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

  const client = new Client({});
  const addresses = puntos.map(p => `${p.direccion}, ${p.ciudad}, Colombia`);

  try {
    const matrix = await client.distancematrix({
      params: {
        origins: addresses,
        destinations: addresses,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const rows = matrix.data.rows;
    const n = puntos.length;
    const visited = Array(n).fill(false);
    let idx = 0;
    const order = [0];
    visited[0] = true;
    for (let step = 1; step < n; step++) {
      let best = -1;
      let bestDist = Infinity;
      for (let j = 0; j < n; j++) {
        if (!visited[j]) {
          const dist = rows[idx].elements[j].distance.value;
          if (dist < bestDist) {
            bestDist = dist;
            best = j;
          }
        }
      }
      visited[best] = true;
      order.push(best);
      idx = best;
    }

    const optimizedPuntos = order.map(i => puntos[i]);
    res.status(200).json({ optimizedPuntos });
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({ error: 'No se pudo optimizar la ruta.' });
  }
}
