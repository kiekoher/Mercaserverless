const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { checkRateLimit } = require('../../lib/rateLimiter');

async function handler(req, res) {
  const { error: authError, supabase, user } = await requireUser(req, res);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // La función RPC espera el ID como texto, así que nos aseguramos de pasarlo como string.
  const { data, error } = await supabase.rpc('get_todays_route_for_user', {
    p_user_id: String(user.id)
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return res.status(404).json({ message: 'No tienes una ruta asignada para hoy.' });
  }

  return res.status(200).json(data);
}

module.exports = withLogging(handler);;
