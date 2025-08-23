const { createClient } = require('@supabase/supabase-js');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const env = require('../../lib/env.server');
const { checkRateLimit } = require('../../lib/rateLimiter');
const logger = require('../../lib/logger.server'); // Keep logger for internal functions

async function getWeeklyWorkload(supabaseAdmin) {
  const { data, error } = await supabaseAdmin.rpc('get_weekly_workload');

  if (error) {
    logger.error({ err: error }, 'Error calling get_weekly_workload function');
    throw new Error('Error al calcular la carga de trabajo semanal.');
  }
  return data.map(item => ({
    mercaderista: item.mercaderista_nombre || `ID: ${item.mercaderista_id}`,
    hours: item.total_horas || 0,
  }));
}

async function getFrequencyCompliance(supabaseAdmin) {
  const { data, error } = await supabaseAdmin.rpc('get_frequency_compliance');

  if (error) {
    logger.error({ err: error }, 'Error calling get_frequency_compliance function');
    throw new Error('Error al calcular el cumplimiento de frecuencia.');
  }

  if (!data || data.length === 0) {
    return { planned: 0, required: 0, percentage: '0.0' };
  }

  const { total_required_visits, total_planned_visits } = data[0];
  const percentage = total_required_visits > 0
    ? ((total_planned_visits / total_required_visits) * 100).toFixed(1)
    : '0.0';

  return {
    planned: total_planned_visits,
    required: total_required_visits,
    percentage,
  };
}


async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { error: authError, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // The HOF will catch errors from this block
  const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const workload = await getWeeklyWorkload(supabaseAdmin);
  const frequency = await getFrequencyCompliance(supabaseAdmin);

  res.status(200).json({
    workload,
    frequency,
  });
}

module.exports = withLogging(handler);;
