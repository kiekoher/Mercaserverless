import { z } from 'zod';
import { withLogging } from '../../../lib/api-logger';
import { requireUser } from '../../../lib/auth';
import { checkRateLimit } from '../../../lib/rateLimiter';
import { sanitizeInput } from '../../../lib/sanitize';

async function handler(req, res) {
  // 1. Authorization: Only admins can access this endpoint.
  const { error: authError, supabase, user } = await requireUser(req, res, ['admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  // 2. Rate Limiting
  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // 3. Handle GET request to list invites
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('beta_invites')
      .select('email, created_at, note, inviter:profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      throw error; // Let withLogging handle the error
    }
    return res.status(200).json({ data });
  }

  // 4. Handle POST request to add a new invite
  if (req.method === 'POST') {
    const schema = z.object({
      email: z.string().email({ message: 'El correo no es válido.' }),
      note: z.string().max(200, 'La nota no puede exceder los 200 caracteres.').optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de entrada inválidos.', details: parsed.error.format() });
    }

    const { email, note } = parsed.data;
    const safeEmail = sanitizeInput(email).toLowerCase();
    const safeNote = note ? sanitizeInput(note) : null;

    const { data, error } = await supabase
      .from('beta_invites')
      .insert({
        email: safeEmail,
        note: safeNote,
        created_by: user.id,
      })
      .select();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Este correo ya ha sido invitado.' });
      }
      throw error;
    }

    return res.status(201).json({ data: data[0] });
  }

  // 5. Handle DELETE request to remove an invite
  if (req.method === 'DELETE') {
      const schema = z.object({
        email: z.string().email(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
          return res.status(400).json({ error: 'Correo inválido.' });
      }
      const { email } = parsed.data;

      const { error } = await supabase
          .from('beta_invites')
          .delete()
          .eq('email', email);

      if (error) {
          throw error;
      }
      return res.status(204).end();
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end('Method Not Allowed');
}

// Wrap the handler with logging
const mainHandler = withLogging(handler);
mainHandler.rawHandler = handler; // For testing purposes
export default mainHandler;
