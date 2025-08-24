const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { sanitizeInput } = require('../../lib/sanitize');

async function handler(req, res) {
  const { error: authError, supabase, user, role } = await requireUser(req, res);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  // MÉTODO GET: Para que supervisores puedan ver las visitas de una ruta
  if (req.method === 'GET') {
    if (!['supervisor', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta información.' });
    }
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    const querySchema = z.object({
      ruta_id: z.coerce.number(),
      page: z.coerce.number().min(1).optional(),
      pageSize: z.coerce.number().min(1).max(100).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Se requiere un ID de ruta válido.' });
    }
    const { ruta_id, page = 1, pageSize = 50 } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('visitas')
      .select('id,ruta_id,punto_de_venta_id,mercaderista_id,check_in_at,check_out_at,estado,observaciones,url_foto', { count: 'exact' })
      .eq('ruta_id', ruta_id)
      .range(from, to);
    if (error) throw error;
    return res.status(200).json({ data, totalCount: count });
  }

  // MÉTODO POST: Para crear un registro de visita (Check-in)
  if (req.method === 'POST') {
    if (role !== 'mercaderista') {
      return res.status(403).json({ error: 'Solo los mercaderistas pueden registrar visitas.' });
    }
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    const postSchema = z.object({
      ruta_id: z.number(),
      punto_de_venta_id: z.number(),
      url_foto: z.string().url().optional(),
    });
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de visita inválidos.' });
    }
    const { ruta_id, punto_de_venta_id, url_foto } = parsed.data;
    const { data: rutaData, error: rutaError } = await supabase.from('rutas').select('mercaderista_id, puntos_de_venta_ids').eq('id', ruta_id).single();
    if (rutaError || !rutaData) {
      logger.error({ err: rutaError, ruta_id, userId: user.id }, 'Error fetching route for validation');
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
    const { data: existingVisit } = await supabase.from('visitas').select('id').eq('ruta_id', ruta_id).eq('punto_de_venta_id', punto_de_venta_id).is('check_out_at', null).single();
    if (existingVisit) {
      return res.status(409).json({ error: 'Visita ya iniciada para este punto' });
    }
    const { data, error } = await supabase
      .from('visitas')
      .insert({ ruta_id, punto_de_venta_id, mercaderista_id: user.id, check_in_at: new Date().toISOString(), estado: 'En Progreso', url_foto })
      .select('id,ruta_id,punto_de_venta_id,mercaderista_id,check_in_at,check_out_at,estado,observaciones,url_foto')
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  }

  // MÉTODO PUT: Para actualizar una visita (Check-out y feedback)
  if (req.method === 'PUT') {
    if (role !== 'mercaderista') {
      return res.status(403).json({ error: 'Solo los mercaderistas pueden actualizar visitas.' });
    }
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    const putSchema = z.object({
      visita_id: z.number(),
      estado: z.enum(['En Progreso', 'Completada', 'Incidencia']),
      observaciones: z.string().optional(),
      url_foto: z.string().url().optional(),
    });
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de actualización inválidos.' });
    }
    const { visita_id, estado, observaciones, url_foto } = parsed.data;
    const sanitizedObs = observaciones ? sanitizeInput(observaciones) : undefined;
    const { data: existingVisit, error: fetchError } = await supabase.from('visitas').select('check_out_at').eq('id', visita_id).eq('mercaderista_id', user.id).single();
    if (fetchError || !existingVisit) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }
    if (existingVisit.check_out_at) {
      return res.status(400).json({ error: 'Visita ya finalizada' });
    }
    const { data, error } = await supabase
      .from('visitas')
      .update({ estado, observaciones: sanitizedObs, url_foto, check_out_at: new Date().toISOString() })
      .eq('id', visita_id)
      .eq('mercaderista_id', user.id)
      .select('id,ruta_id,punto_de_venta_id,mercaderista_id,check_in_at,check_out_at,estado,observaciones,url_foto')
      .single();
    if (error) throw error;
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

const mainHandler = withLogging(handler);
mainHandler.rawHandler = handler;
module.exports = mainHandler;
