const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { sanitizeInput } = require('../../lib/sanitize');

export async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res, ['admin', 'supervisor']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method === 'GET') {
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(10).max(100).default(20),
      mercaderistaId: z.string().uuid().optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parámetros de consulta inválidos.', details: parsed.error.format() });
    }

    const { page, pageSize, mercaderistaId } = parsed.data;
    const { from, to } = { from: (page - 1) * pageSize, to: page * pageSize - 1 };

    let query = supabase
      .from('rutas')
      .select('id,fecha,mercaderista_id,puntos_de_venta_ids', { count: 'exact' });

    if (mercaderistaId) {
      query = query.eq('mercaderista_id', mercaderistaId);
    }

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const transformedData = data.map(r => ({
      ...r,
      mercaderistaId: r.mercaderista_id,
      puntosDeVentaIds: r.puntos_de_venta_ids,
    }));
    return res.status(200).json({ data: transformedData, totalCount: count });

  } else if (req.method === 'POST') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      fecha: z.string().date('El formato de fecha debe ser YYYY-MM-DD'),
      mercaderistaId: z.string().uuid('El ID del mercaderista debe ser un UUID válido'),
      puntosDeVentaIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto de venta'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validación fallida', details: parsed.error.format() });
    }
    const { fecha, mercaderistaId, puntosDeVentaIds } = parsed.data;

    const { data, error } = await supabase
      .from('rutas')
      .insert([{ fecha, mercaderista_id: mercaderistaId, puntos_de_venta_ids: puntosDeVentaIds }])
      .select('id,fecha,mercaderista_id,puntos_de_venta_ids')
      .single();

    if (error) {
      throw error;
    }
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      id: z.number().int().positive(),
      fecha: z.string().date('El formato de fecha debe ser YYYY-MM-DD'),
      mercaderistaId: z.string().uuid('El ID del mercaderista debe ser un UUID válido'),
      puntosDeVentaIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto de venta'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validación fallida', details: parsed.error.format() });
    }
    const { id, fecha, mercaderistaId, puntosDeVentaIds } = parsed.data;

    const { data, error } = await supabase
      .from('rutas')
      .update({
        fecha,
        mercaderista_id: mercaderistaId,
        puntos_de_venta_ids: puntosDeVentaIds,
      })
      .eq('id', id)
      .select('id,fecha,mercaderista_id,puntos_de_venta_ids')
      .single();

    if (error) {
      throw error;
    }
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({ id: z.coerce.number().int().positive() });
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'ID de ruta inválido.' });
    }
    const { id } = parsed.data;

    const { error } = await supabase
      .from('rutas')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
    return res.status(200).json({ message: 'Ruta eliminada' });

  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const mainHandler = withLogging(handler);
mainHandler.rawHandler = handler;
module.exports = mainHandler;
