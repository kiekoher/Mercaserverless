import { withLogging } from '../../lib/api-logger';
import { requireUser } from '../../lib/auth';
import { z } from 'zod';
import { sanitizeInput } from '../../lib/sanitize';

const postSchema = z.object({
  ruta_id: z.number().int().positive(),
  punto_de_venta_id: z.number().int().positive(),
});

const putSchema = z.object({
  visita_id: z.number().int().positive(),
  estado: z.enum(['Completada', 'Incidencia']),
  observaciones: z.string().max(500).optional(),
});

async function handler(req, res) {
  const { error: authError, supabase, user, role } = await requireUser(req, res);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method === 'POST') {
    // Logic from the test: only mercaderistas can create
    if (role !== 'mercaderista') {
      return res.status(403).json({ error: 'Solo los mercaderistas pueden registrar visitas.' });
    }

    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de entrada inválidos.', details: parsed.error.format() });
    }
    const { ruta_id, punto_de_venta_id } = parsed.data;

    // Logic from test: check if user is assigned to this route's PDV
    const { data: routePdv, error: routePdvError } = await supabase
      .from('ruta_pdv')
      .select('id, rutas!inner(mercaderista_id)')
      .eq('ruta_id', ruta_id)
      .eq('pdv_id', punto_de_venta_id)
      .single();

    if (routePdvError || !routePdv || routePdv.rutas.mercaderista_id !== user.id) {
        return res.status(403).json({ error: 'No tienes permiso para registrar una visita en este punto de venta.' });
    }

    // Logic from test: check for existing active visit
    const { data: existingVisit, error: existingError } = await supabase
      .from('visitas')
      .select('id')
      .eq('ruta_id', ruta_id)
      .eq('punto_de_venta_id', punto_de_venta_id)
      .is('check_out_at', null)
      .single();

    if (existingVisit) {
      return res.status(409).json({ error: 'Visita ya iniciada para este punto' });
    }

    // Create visit
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        ruta_id,
        punto_de_venta_id,
        check_in_at: new Date().toISOString(),
        estado: 'En Progreso',
        mercaderista_id: user.id
      })
      .select('id, estado')
      .single();

    if (error) throw error;
    return res.status(201).json(data);

  } else if (req.method === 'PUT') {
      if (role !== 'mercaderista') {
        return res.status(403).json({ error: 'Solo los mercaderistas pueden actualizar visitas.' });
      }

      const parsed = putSchema.safeParse(req.body);
      if (!parsed.success) {
          return res.status(400).json({ error: 'Datos de entrada inválidos.', details: parsed.error.format() });
      }
      const { visita_id, estado, observaciones } = parsed.data;

      // Check if visit exists and belongs to the user
      const { data: visit, error: fetchError } = await supabase
        .from('visitas')
        .select('id, check_out_at, mercaderista_id')
        .eq('id', visita_id)
        .single();

      if (fetchError || !visit) {
        return res.status(404).json({ error: 'Visita no encontrada.' });
      }

      if (visit.mercaderista_id !== user.id) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar esta visita.' });
      }

      if (visit.check_out_at) {
        return res.status(400).json({ error: 'Visita ya finalizada' });
      }

      const { data, error } = await supabase
        .from('visitas')
        .update({
          estado,
          observaciones: sanitizeInput(observaciones || ''),
          check_out_at: new Date().toISOString(),
        })
        .eq('id', visita_id)
        .select('id, estado')
        .single();

      if (error) throw error;
      return res.status(200).json(data);

  } else if (req.method === 'GET') {
      const { ruta_id } = req.query;
      if (!ruta_id) {
          return res.status(400).json({ error: 'El parámetro ruta_id es requerido.' });
      }
      const { data, error, count } = await supabase
          .from('visitas')
          .select('id, punto_de_venta_id, estado, check_in_at, check_out_at, observaciones', { count: 'exact' })
          .eq('ruta_id', ruta_id);
      if (error) throw error;
      return res.status(200).json({ data, totalCount: count });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

const mainHandler = withLogging(handler);
mainHandler.rawHandler = handler; // Attaching the raw handler for testing

export default mainHandler;
