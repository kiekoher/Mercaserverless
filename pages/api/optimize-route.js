import { Client } from '@googlemaps/google-maps-services-js';
import { checkRateLimit } from '../../lib/rateLimiter';
import logger from '../../lib/logger.server';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { sanitizeInput } from '../../lib/sanitize';
import { requireUser } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!verifyCsrf(req, res)) return;

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada' });
  }

  const { error: authError, supabase, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  const puntoSchema = z.object({
    id: z.number().int(),
    direccion: z.string().min(1),
    ciudad: z.string().min(1)
  });
  const schema = z.object({
    puntos: z.array(puntoSchema).min(2),
    modo_transporte: z.enum(['driving', 'walking', 'transit']).optional().default('driving')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Formato de puntos inválido o modo de transporte no soportado.' });
  }

  const { puntos, modo_transporte } = parsed.data;

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const client = new Client({});
  const addresses = puntos.map(p => `${sanitizeInput(p.direccion)}, ${sanitizeInput(p.ciudad)}, Colombia`);

  try {
    const origin = addresses[0];
    const waypoints = addresses.slice(1);
    const directions = await client.directions({
      params: {
        origin,
        destination: origin,
        waypoints: ['optimize:true', ...waypoints],
        mode: modo_transporte,
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
