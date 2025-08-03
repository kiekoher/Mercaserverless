import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const { user } = await supabase.auth.api.getUserByCookie(req);
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
