import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';

export default async function handler(req, res) {
  // **MEJORA: Actualizado al nuevo método recomendado por Supabase**
  const supabase = createPagesServerClient({ req, res });
  
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
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role');

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
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

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  res.status(405).end('Method Not Allowed');
}
