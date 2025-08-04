import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createServerSupabaseClient({ req, res });
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase.rpc('get_dashboard_stats');

  if (error) {
    console.error('Error calling dashboard stats function:', error);
    return res.status(500).json({ error: 'Error al obtener las estadísticas.' });
  }

  res.status(200).json(data);
}
