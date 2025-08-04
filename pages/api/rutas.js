import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  const supabase = createServerSupabaseClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // **MEJORA: Obtener el perfil del usuario una sola vez para todos los métodos**
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  if (req.method === 'GET') {
    const { page = 1, search = '' } = req.query;
    const pageSize = 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('rutas')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.ilike('mercaderista_id', `%${search}%`);
    }

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching routes:', error);
      return res.status(500).json({ error: error.message });
    }

    res.setHeader('X-Total-Count', count);
    const transformedData = data.map(r => ({
        ...r,
        mercaderistaId: r.mercaderista_id,
        puntosDeVentaIds: r.puntos_de_venta_ids,
    }));
    return res.status(200).json(transformedData);

  } else if (req.method === 'POST') {
    // **MEJORA: Permitir acceso a 'supervisor' y 'admin'**
    if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para crear rutas.' });
    }

    const { fecha, mercaderistaId, puntosDeVentaIds } = req.body;
    if (!fecha || !mercaderistaId || !puntosDeVentaIds || !Array.isArray(puntosDeVentaIds)) {
      return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    const { data, error } = await supabase
      .from('rutas')
      .insert([{
         fecha,
         mercaderista_id: mercaderistaId,
         puntos_de_venta_ids: puntosDeVentaIds
      }])
      .select() // Use .select() para obtener la fila insertada
      .single();

    if (error) {
      console.error('Error inserting route:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
