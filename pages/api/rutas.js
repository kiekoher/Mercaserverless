import logger from '../../lib/logger.server';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';
import { sanitizeInput } from '../../lib/sanitize';
import { requireUser } from '../../lib/auth';

export default async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res, ['admin', 'supervisor']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method === 'GET') {
    if (!(await checkRateLimit(req, { userId: user.id }))) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const { page = '1', search = '' } = req.query;
    const pageNumber = parseInt(page, 10);
    if (Number.isNaN(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'Parámetro page inválido' });
    }
    const pageSize = 10;
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('rutas')
      .select('*', { count: 'exact' });

    if (search) {
      const safeSearch = sanitizeInput(search);
      query = query.ilike('mercaderista_id', `%${safeSearch}%`);
    }

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error({ err: error }, 'Error fetching routes');
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.setHeader('X-Total-Count', count);
    const transformedData = data.map(r => ({
        ...r,
        mercaderistaId: r.mercaderista_id,
        puntosDeVentaIds: r.puntos_de_venta_ids,
    }));
    return res.status(200).json(transformedData);

  } else if (req.method === 'POST') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      fecha: z.string().min(1),
      mercaderistaId: z.string().uuid(),
      puntosDeVentaIds: z.array(z.number().int()).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validación fallida', details: parsed.error.format() });
    }
    const { fecha, mercaderistaId, puntosDeVentaIds } = parsed.data;
    const safeFecha = sanitizeInput(fecha);

    const { data, error } = await supabase
      .from('rutas')
      .insert([{
         fecha: safeFecha,
         mercaderista_id: mercaderistaId,
         puntos_de_venta_ids: puntosDeVentaIds
      }])
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error inserting route');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const schema = z.object({
      id: z.number().int(),
      fecha: z.string().min(1),
      mercaderistaId: z.string().uuid(),
      puntosDeVentaIds: z.array(z.number().int()).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validación fallida', details: parsed.error.format() });
    }
    const { id, fecha, mercaderistaId, puntosDeVentaIds } = parsed.data;
    const safeFecha = sanitizeInput(fecha);

    const { data, error } = await supabase
      .from('rutas')
      .update({
        fecha: safeFecha,
        mercaderista_id: mercaderistaId,
        puntos_de_venta_ids: puntosDeVentaIds,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error updating route');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!verifyCsrf(req, res)) return;
    if (!await checkRateLimit(req, { userId: user.id })) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const { error } = await supabase
      .from('rutas')
      .delete()
      .eq('id', Number(id));

    if (error) {
      logger.error({ err: error }, 'Error deleting route');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json({ message: 'Ruta eliminada' });

  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
