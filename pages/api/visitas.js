import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  console.log('--- Nueva solicitud a /api/visitas ---');
  console.log('Variables de entorno cargadas:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY ? '[CARGADA]' : '[NO CARGADA]',
  });
  try {
    // 1. Extract and parse query parameters with defaults
    const { vendedorId, page = 1, limit = 10, sortBy = 'fecha', order = 'desc' } = req.query;

    // Check for the required vendedorId
    if (!vendedorId) {
      return res.status(400).json({ error: 'El parámetro vendedorId es requerido.' });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    // 2. Start building the base query
    let query = supabase
      .from('visitas')
      .select('id, fecha, nombre_cliente, estado, vendedor_id', { count: 'exact' });

    // 3. Apply the mandatory filter for vendedorId
    // The query object is reassigned after adding the filter
    query = query.eq('vendedor_id', vendedorId);

    // 4. Chain the final modifiers and execute the query
    const { data, error, count } = await query
      .order(sortBy, { ascending: order === 'asc' })
      .range(from, to);

    // 5. Handle potential errors from the query execution
    if (error) {
      throw error;
    }

    // 6. Send the successful response
    res.status(200).json({ data, count });

  } catch (error) {
    console.error('Error fetching visitas:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
