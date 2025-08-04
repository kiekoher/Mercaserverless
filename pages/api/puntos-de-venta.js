import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  // **CORRECCIÓN: Actualizado al nuevo método recomendado por Supabase**
  const supabase = createPagesServerClient({ req, res });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { page = 1, search = '' } = req.query;
    const pageSize = 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('puntos_de_venta')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('nombre', `%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching points of sale:', error);
      return res.status(500).json({ error: error.message });
    }

    res.setHeader('X-Total-Count', count);
    return res.status(200).json(data);

  } else if (req.method === 'POST') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
    }

    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
    }

    const { nombre, direccion, ciudad } = req.body;
    if (!nombre || !direccion || !ciudad) {
      return res.status(400).json({ message: 'Nombre, dirección y ciudad son requeridos.' });
    }

    const { data, error } = await supabase
      .from('puntos_de_venta')
      .insert([{ nombre, direccion, ciudad }])
      .select()
      .single();

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
