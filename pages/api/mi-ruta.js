import { supabase } from '../../lib/supabaseClient';

// Mock data to simulate the response from a Supabase RPC
const mockPuntos = [
  { id: 1, nombre: 'Éxito Cl. 80', direccion: 'Av. Cl. 80 #69Q-50', ciudad: 'Bogotá' },
  { id: 2, nombre: 'Carulla Pepe Sierra', direccion: 'Av. Pepe Sierra #110-20', ciudad: 'Bogotá' },
  { id: 4, nombre: 'Metro Suba', direccion: 'Cl. 145 #91-19', ciudad: 'Bogotá' },
];
const mockTodaysRoute = {
  id: 1,
  fecha: new Date().toISOString().split('T')[0],
  mercaderista_id: 'mercaderista-1',
  puntos: mockPuntos, // The RPC would return the joined data directly
};


export default async function handler(req, res) {
  if (req.method === 'GET') {
    // In a real scenario, you'd get the user from the cookie/token
    // const { user } = await supabase.auth.api.getUserByCookie(req);
    // if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const mockUser = { id: 'mercaderista-1' }; // Simulating authenticated user

    /*
     * REAL SUPABASE QUERY (using a Remote Procedure Call)
     * This is an efficient way to get joined data. You would create a function
     * in your PostgreSQL database and call it via RPC.
     *
     * Example function 'get_todays_route_for_user(p_user_id TEXT)':
     *
     * const { data, error } = await supabase.rpc('get_todays_route_for_user', {
     *   p_user_id: user.id
     * });
    */

    // MOCK RESPONSE
    // We check if the mock route matches our mock user
    let data = null;
    if (mockTodaysRoute.mercaderista_id === mockUser.id) {
      data = mockTodaysRoute;
    }
    const error = null;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ message: 'No tienes una ruta asignada para hoy.' });
    }

    res.status(200).json(data);

  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
