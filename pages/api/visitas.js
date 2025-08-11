import { getSupabaseServerClient } from '../../lib/supabaseServer';
import logger from '../../lib/logger';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { sanitizeInput } from '../../lib/sanitize';
import { checkRateLimit } from '../../lib/rateLimiter';

export default async function handler(req, res) {
  const supabase = getSupabaseServerClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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

  if (!profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  // MÉTODO GET: Para que supervisores puedan ver las visitas de una ruta
  if (req.method === 'GET') {
     if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta información.' });
    }

    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const { ruta_id } = req.query;
    if (!ruta_id) {
      return res.status(400).json({ error: 'Se requiere el ID de la ruta.' });
    }

    const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('ruta_id', ruta_id);

    if (error) {
        logger.error({ err: error }, 'Error fetching visits');
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json(data);
  }

  // MÉTODO POST: Para crear un registro de visita (Check-in)
  if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
    if (profile.role !== 'mercaderista') {
      return res.status(403).json({ error: 'Solo los mercaderistas pueden registrar visitas.' });
    }

    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const postSchema = z.object({
      ruta_id: z.number(),
      punto_de_venta_id: z.number(),
    });
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de visita inválidos.' });
    }
    const { ruta_id, punto_de_venta_id } = parsed.data;

    // Validación: comprobar que el punto de venta pertenezca a la ruta y que la ruta corresponda al mercaderista
    const { data: rutaData, error: rutaError } = await supabase
      .from('rutas')
      .select('mercaderista_id, puntos_de_venta_ids')
      .eq('id', ruta_id)
      .single();

    if (rutaError || !rutaData) {
      logger.error({ err: rutaError, ruta_id }, 'Error fetching route for validation');
      return res.status(404).json({ error: 'La ruta especificada no fue encontrada.' });
    }

    if (rutaData.mercaderista_id !== user.id) {
      logger.warn({ userId: user.id, ruta_id, expectedOwner: rutaData.mercaderista_id }, 'User tried to check-in to a route not assigned to them');
      return res.status(403).json({ error: 'No tienes permiso para registrar visitas en esta ruta.' });
    }

    if (!rutaData.puntos_de_venta_ids.includes(punto_de_venta_id)) {
      logger.warn({ userId: user.id, ruta_id, punto_de_venta_id }, 'User tried to check-in to a point not in the route');
      return res.status(400).json({ error: 'El punto de venta no pertenece a la ruta especificada.' });
    }

    const { data, error } = await supabase
      .from('visitas')
      .insert({
        ruta_id,
        punto_de_venta_id,
        mercaderista_id: user.id,
        check_in_at: new Date().toISOString(),
        estado: 'En Progreso',
      })
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error creating visit');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(201).json(data);
  }

  // MÉTODO PUT: Para actualizar una visita (Check-out y feedback)
  if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    if (profile.role !== 'mercaderista') {
        return res.status(403).json({ error: 'Solo los mercaderistas pueden actualizar visitas.' });
    }

    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    const putSchema = z.object({
      visita_id: z.number(),
      estado: z.string().min(1),
      observaciones: z.string().optional(),
      url_foto: z.string().url().optional(),
    });
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de actualización inválidos.' });
    }
    const { visita_id, estado, observaciones, url_foto } = parsed.data;
    const sanitizedObs = observaciones ? sanitizeInput(observaciones) : undefined;

    const { data, error } = await supabase
      .from('visitas')
      .update({
        estado,
        observaciones: sanitizedObs,
        url_foto,
        check_out_at: new Date().toISOString(),
      })
      .eq('id', visita_id)
      .eq('mercaderista_id', user.id)
      .select()
      .single();

    if (error) {
        logger.error({ err: error }, 'Error updating visit');
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
