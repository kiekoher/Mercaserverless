import { supabase } from '../../lib/supabaseClient';

// Mock data to simulate Supabase response. In a real app, this would be in your DB.
const mockPuntos = [
  { id: 1, created_at: new Date().toISOString(), nombre: 'Éxito Cl. 80', direccion: 'Av. Cl. 80 #69Q-50', ciudad: 'Bogotá' },
  { id: 2, created_at: new Date().toISOString(), nombre: 'Carulla Pepe Sierra', direccion: 'Av. Pepe Sierra #110-20', ciudad: 'Bogotá' },
  { id: 3, created_at: new Date().toISOString(), nombre: 'Jumbo Hayuelos', direccion: 'C.C. Hayuelos, Cl. 20 #82-52', ciudad: 'Bogotá' },
];

export default async function handler(req, res) {
  // In a real scenario, you'd protect this endpoint, e.g., using Supabase JWT
  // const { user } = await supabase.auth.api.getUserByCookie(req);
  // if (!user) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  if (req.method === 'GET') {
    /*
     * REAL SUPABASE QUERY
     * const { data, error } = await supabase.from('puntos_de_venta').select('*');
    */

    // MOCK RESPONSE
    const data = mockPuntos;
    const error = null;

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);

  } else if (req.method === 'POST') {
    const { nombre, direccion, ciudad } = req.body;
    if (!nombre || !direccion || !ciudad) {
      return res.status(400).json({ message: 'Nombre, dirección y ciudad son requeridos.' });
    }

    /*
     * REAL SUPABASE QUERY
     * const { data, error } = await supabase
     *   .from('puntos_de_venta')
     *   .insert([{ nombre, direccion, ciudad }])
     *   .single(); // .single() returns the inserted row as an object
    */

    // MOCK RESPONSE
    const newPunto = { id: mockPuntos.length + 1, created_at: new Date().toISOString(), nombre, direccion, ciudad };
    mockPuntos.push(newPunto); // Add to mock data for subsequent GETs
    const data = newPunto;
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
