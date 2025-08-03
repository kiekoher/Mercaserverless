import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  // A simple way to protect the API route.
  // We're checking for a session on the server-side.
  const { user } = await supabase.auth.api.getUserByCookie(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('puntos_de_venta')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching points of sale:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);

  } else if (req.method === 'POST') {
    // Check user's role before allowing insertion
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
    }

    if (profile.role !== 'supervisor') {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
    }

    const { nombre, direccion, ciudad } = req.body;
    if (!nombre || !direccion || !ciudad) {
      return res.status(400).json({ message: 'Nombre, dirección y ciudad son requeridos.' });
    }

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .insert([{ nombre, direccion, ciudad }])
      .single(); // .single() returns the inserted row as an object

    if (error) {
      console.error('Error inserting point of sale:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
