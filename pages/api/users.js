import { getSupabaseServerClient } from '../../lib/supabaseServer';
import { z } from 'zod';
import { verifyCsrf } from '../../lib/csrf';
import logger from '../../lib/logger';

export default async function handler(req, res) {
  // **MEJORA: Actualizado al nuevo método recomendado por Supabase**
  const supabase = getSupabaseServerClient(req, res);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if the user is an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  if (req.method === 'GET') {
    const page = parseInt(req.query.page || '1', 10);
    const search = req.query.search || '';
    const PAGE_SIZE = 10;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('profiles')
      .select('id, full_name, role', { count: 'exact' });

    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logger.error({ err: error }, 'Error fetching users');
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.setHeader('X-Total-Count', count);
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    const schema = z.object({
      userId: z.string().uuid(),
      newRole: z.enum(['admin', 'supervisor', 'mercaderista'])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'User ID and new role are required and must be valid.' });
    }

    const { userId, newRole } = parsed.data;

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Error updating user role');
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end('Method Not Allowed');
}
