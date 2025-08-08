import { getSupabaseServerClient } from '../../lib/supabaseServer';
import logger from '../../lib/logger';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import { checkRateLimit } from '../../lib/rateLimiter';

export default async function handler(req, res) {
  // CORRECCIÓN: Se utiliza el nuevo método recomendado por Supabase.
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

  if (profileError || !profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  if (req.method === 'GET') {
    const { page = 1, search = '' } = req.query;
    const pageSize = 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('rutas')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('mercaderista_id', `%${search}%`);
    }

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error({ err: error }, 'Error fetching routes');
      return res.status(500).json({ error: error.message });
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
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para crear rutas.' });
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

    const { data, error } = await supabase
      .from('rutas')
      .insert([{
         fecha,
         mercaderista_id: mercaderistaId,
         puntos_de_venta_ids: puntosDeVentaIds
      }])
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error inserting route');
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar rutas.' });
    }
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

    const { data, error } = await supabase
      .from('rutas')
      .update({
        fecha,
        mercaderista_id: mercaderistaId,
        puntos_de_venta_ids: puntosDeVentaIds,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error updating route');
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);

  } else if (req.method === 'DELETE') {
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar rutas.' });
    }
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
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ message: 'Ruta eliminada' });

  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
