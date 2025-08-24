const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { verifyCsrf } = require('../../lib/csrf');
const { checkRateLimit } = require('../../lib/rateLimiter');
const { sanitizeInput } = require('../../lib/sanitize');

async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res, ['admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (req.method === 'GET') {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(10).max(100).default(20),
      search: z.string().optional().default(''),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parámetros de consulta inválidos.', details: parsed.error.format() });
    }

    const { page, pageSize, search } = parsed.data;
    const safeSearch = sanitizeInput(search).slice(0, 50);

    const { from, to } = { from: (page - 1) * pageSize, to: page * pageSize - 1 };

    let query = supabase
      .from('profiles')
      .select('id, full_name, role', { count: 'exact' });

    if (safeSearch) {
      query = query.ilike('full_name', `%${safeSearch}%`);
    }

    const { data, error, count } = await query.range(from, to).order('id');

    if (error) {
      throw error;
    }

    return res.status(200).json({ data, totalCount: count });
  }

  if (req.method === 'PUT') {
    if (!verifyCsrf(req, res)) return;
    const schema = z.object({
      userId: z.string().uuid(),
      newRole: z.enum(['admin', 'supervisor', 'mercaderista']),
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
      .select('id, full_name, role')
      .single();

    if (error) {
      throw error;
    }
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end('Method Not Allowed');
}

module.exports = withLogging(handler);
