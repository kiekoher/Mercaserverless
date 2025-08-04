import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  // CORRECCIÓN: Se utiliza el nuevo método recomendado por Supabase.
  const supabase = createPagesServerClient({ req, res });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
  }

  // MÉTODO POST: Para crear un registro de visita (Check-in)
  if (req.method === 'POST') {
    if (profile.role !== 'mercaderista') {
      return res.status(403).json({ error: 'Solo los mercaderistas pueden registrar visitas.' });
    }
    
    const { ruta_id, punto_de_venta_id } = req.body;
    if (!ruta_id || !punto_de_venta_id) {
      return res.status(400).json({ error: 'Se requiere el ID de la ruta y del punto de venta.' });
    }

    // Crear un nuevo registro de visita con el check-in
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        ruta_id,
        punto_de_venta_id,
        mercaderista_id: user.id,
        check_in_at: new Date().toISOString(),
        estado: 'En Progreso',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating visit:', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  }

  // MÉTODO PUT: Para actualizar una visita (Check-out y feedback)
  if (req.method === 'PUT') {
    if (profile.role !== 'mercaderista') {
        return res.status(403).json({ error: 'Solo los mercaderistas pueden actualizar visitas.' });
    }

    const { visita_id, estado, observaciones, url_foto } = req.body;
    if (!visita_id || !estado) {
        return res.status(400).json({ error: 'Se requiere el ID de la visita y un estado.' });
    }

    // Actualizar el registro de visita con el check-out y el feedback
    const { data, error } = await supabase
      .from('visitas')
      .update({
        estado,
        observaciones,
        url_foto,
        check_out_at: new Date().toISOString(),
      })
      .eq('id', visita_id)
      .eq('mercaderista_id', user.id) // Doble chequeo de seguridad
      .select()
      .single();

    if (error) {
        console.error('Error updating visit:', error);
        return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  // MÉTODO GET: Para que supervisores puedan ver las visitas de una ruta (opcional por ahora)
  if (req.method === 'GET') {
     if (!['supervisor', 'admin'].includes(profile.role)) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta información.' });
    }

    const { ruta_id } = req.query;
    if (!ruta_id) {
      return res.status(400).json({ error: 'Se requiere el ID de la ruta.' });
    }
    
    const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('ruta_id', ruta_id);
    
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }


  res.setHeader('Allow', ['GET', 'POST', 'PUT']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
