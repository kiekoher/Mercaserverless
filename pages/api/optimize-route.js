import { Client } from '@googlemaps/google-maps-services-js';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { checkRateLimit } from '../../lib/rateLimiter';
import logger from '../../lib/logger';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!verifyCsrf(req, res)) return;

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

  if (!profile || !['supervisor', 'admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const puntoSchema = z.object({
    id: z.any(),
    direccion: z.string().min(1),
    ciudad: z.string().min(1)
  });
  const schema = z.array(puntoSchema).min(2);
  const parsed = schema.safeParse(req.body.puntos);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Formato de puntos inválido' });
  }
  const puntos = parsed.data;

  if (!(await checkRateLimit(req, { userId: user.id }))) {
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
