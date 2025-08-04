import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  // **MEJORA: Actualizado al nuevo método recomendado por Supabase**
  const supabase = createPagesServerClient({ req, res });

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // La función RPC espera el ID como texto, así que nos aseguramos de pasarlo como string.
  const { data, error } = await supabase.rpc('get_todays_route_for_user', {
    p_user_id: String(user.id)
  });

  if (error) {
    console.error('Error calling RPC function:', error);
    return res.status(500).json({ error: 'Error al obtener la ruta.' });
  }

  if (!data) {
    return res.status(404).json({ message: 'No tienes una ruta asignada para hoy.' });
  }

  return res.status(200).json(data);
}
