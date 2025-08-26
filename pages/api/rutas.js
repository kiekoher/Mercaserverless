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

    // El `select` ahora es mucho más potente. Trae datos anidados de las tablas relacionadas.
    // Supabase detecta las relaciones por las Foreign Keys.
    // - `profiles!inner(full_name)`: Trae el nombre del mercaderista. `!inner` asegura que solo vengan rutas con mercaderista.
    // - `ruta_pdv!inner(puntos_de_venta(*))`: Trae todos los datos de los puntos de venta a través de la tabla de unión.
    let query = supabase
      .from('rutas')
      .select('id, fecha, mercaderista_id, profiles!inner(full_name), ruta_pdv!inner(puntos_de_venta(*))', { count: 'exact' });

    if (mercaderistaId) {
      query = query.eq('mercaderista_id', mercaderistaId);
    }

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    // La transformación ahora es para aplanar la estructura anidada para el frontend
    const transformedData = data.map(r => ({
      id: r.id,
      fecha: r.fecha,
      mercaderista_id: r.mercaderista_id,
      mercaderista_name: r.profiles.full_name,
      puntos_de_venta: r.ruta_pdv.map(rp => rp.puntos_de_venta),
    }));

    return res.status(200).json({ data: transformedData, totalCount: count });

  } else if (req.method === 'POST' || req.method === 'PUT') {
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      id: z.number().int().positive().optional(), // opcional para POST
      fecha: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'El formato de fecha debe ser válido' }),
      mercaderistaId: z.string().uuid('El ID del mercaderista debe ser un UUID válido'),
      pdvIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto de venta'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validación fallida', details: parsed.error.format() });
    }
    const { id, fecha, mercaderistaId, pdvIds } = parsed.data;

    if(req.method === 'PUT' && !id) {
      return res.status(400).json({ message: 'El ID de la ruta es requerido para actualizar' });
    }

    const { data, error } = await supabase.rpc('create_or_update_route', {
      p_ruta_id: id || null,
      p_fecha: fecha,
      p_mercaderista_id: mercaderistaId,
      p_pdv_ids: pdvIds
    });

    if (error) {
      throw error;
    }
    return res.status(req.method === 'POST' ? 201 : 200).json(data);

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
