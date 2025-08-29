import { withLogging } from '../../lib/api-logger';
import { requireUser } from '../../lib/auth';
import { z } from 'zod';

const schema = z.object({
  page: z.preprocess(Number, z.number().int().min(1).default(1)),
  pageSize: z.preprocess(Number, z.number().int().min(1).max(100).default(20)),
  search: z.string().optional(),
});

async function handler(req, res) {
  const { error: authError, supabase, role } = await requireUser(req, res, ['admin', 'supervisor']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const parsedQuery = schema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'Parámetros de consulta inválidos', details: parsedQuery.error.format() });
  }
  const { page, pageSize, search } = parsedQuery.data;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at', { count: 'exact' });

  if (search) {
    query = query.ilike('full_name', `%${search}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  return res.status(200).json({ data, totalCount: count });
}

const mainHandler = withLogging(handler);
mainHandler.rawHandler = handler; // Attaching the raw handler for testing

export default mainHandler;
