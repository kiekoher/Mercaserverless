import { supabase } from '../../lib/supabaseClient';

// Mock data to simulate Supabase response
const mockRutas = [
  {
    id: 1,
    created_at: new Date().toISOString(),
    fecha: '2025-08-03',
    mercaderista_id: 'mercaderista-1', // Using snake_case to match Supabase conventions
    puntos_de_venta_ids: [1, 2]
  },
];

export default async function handler(req, res) {
  if (req.method === 'GET') {
    /*
     * REAL SUPABASE QUERY
     * const { data, error } = await supabase.from('rutas').select('*');
    */

    // MOCK RESPONSE
    const data = mockRutas.map(r => ({ ...r, puntosDeVentaIds: r.puntos_de_venta_ids, mercaderistaId: r.mercaderista_id })); // maintain compatibility with frontend
    const error = null;

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);

  } else if (req.method === 'POST') {
    const { fecha, mercaderistaId, puntosDeVentaIds } = req.body;
    if (!fecha || !mercaderistaId || !puntosDeVentaIds || !Array.isArray(puntosDeVentaIds)) {
      return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    /*
     * REAL SUPABASE QUERY
     * const { data, error } = await supabase
     *   .from('rutas')
     *   .insert([{
     *      fecha,
     *      mercaderista_id: mercaderistaId,
     *      puntos_de_venta_ids: puntosDeVentaIds
     *   }])
     *   .single();
    */

    // MOCK RESPONSE
    const newRuta = {
      id: mockRutas.length + 1,
      created_at: new Date().toISOString(),
      fecha,
      mercaderista_id: mercaderistaId,
      puntos_de_venta_ids: puntosDeVentaIds
    };
    mockRutas.push(newRuta);
    const data = { ...newRuta, puntosDeVentaIds: newRuta.puntos_de_venta_ids, mercaderistaId: newRuta.mercaderista_id };
    const error = null;

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
