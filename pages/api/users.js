import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  console.log('--- Nueva solicitud a /api/users ---');
  console.log('Variables de entorno cargadas:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY ? '[CARGADA]' : '[NO CARGADA]',
  });
  try {
    // 1. Extract and parse query parameters with defaults
    const { searchTerm = '', page = 1, limit = 10, sortBy = 'created_at', order = 'desc' } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    // 2. Start building the base query
    let query = supabase
      .from('users')
      .select('id, name, email, role, created_at', { count: 'exact' });

    // 3. Conditionally apply the search filter
    if (searchTerm) {
      // Reassign the query object after adding the filter
      query = query.ilike('name', `%${searchTerm}%`);
    }

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
    // Log the detailed error for debugging
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
