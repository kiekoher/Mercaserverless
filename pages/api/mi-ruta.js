import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  // Get the authenticated user from the cookie.
  // In a real application, the user's ID might be a UUID. Here we assume it's text.
  const { user } = await supabase.auth.api.getUserByCookie(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Call the RPC function to get the user's route for today
  // We pass the user's ID to the function.
  const { data, error } = await supabase.rpc('get_todays_route_for_user', {
    p_user_id: user.id
  });

  if (error) {
    console.error('Error calling RPC function:', error);
    return res.status(500).json({ error: 'Error al obtener la ruta.' });
  }

  // If the function returns null (no route found), we return a 404.
  if (!data) {
    return res.status(404).json({ message: 'No tienes una ruta asignada para hoy.' });
  }

  // The RPC function returns the data in the exact format the frontend needs.
  return res.status(200).json(data);
}
