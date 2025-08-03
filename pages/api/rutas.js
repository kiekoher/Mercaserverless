import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { user } = await supabase.auth.api.getUserByCookie(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('rutas')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error fetching routes:', error);
      return res.status(500).json({ error: error.message });
    }
    // The frontend expects camelCase keys, so we transform the data.
    const transformedData = data.map(r => ({
        ...r,
        mercaderistaId: r.mercaderista_id,
        puntosDeVentaIds: r.puntos_de_venta_ids,
    }));
    return res.status(200).json(transformedData);

  } else if (req.method === 'POST') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'No se pudo verificar el rol del usuario.' });
    }

    if (profile.role !== 'supervisor') {
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
