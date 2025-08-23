const { getISOWeek, getISOWeekYear } = require('date-fns');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const { withLogging } = require('../../lib/api-logger');
const { requireUser } = require('../../lib/auth');
const { verifyCsrf } = require('../../lib/csrf');
const logger = require('../../lib/logger.server');
const { checkRateLimit } = require('../../lib/rateLimiter');

const planSchema = z.object({
  mercaderistaId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // YYYY-MM-DD
});

/**
 * Generates a detailed monthly visit plan, respecting workload constraints.
 * @param {Array} puntos - Array of points of sale with id, nombre, frecuencia_mensual, and minutos_servicio.
 * @param {string} startDateStr - Start date of the planning period (YYYY-MM-DD).
 * @param {string} endDateStr - End date of the planning period (YYYY-MM-DD).
 * @returns {Object} - A structured plan with daily routes and a summary.
 */
function generateMonthlyPlan(puntos, startDateStr, endDateStr) {
  const WEEKLY_WORK_MINUTES = 40 * 60;
  const DAILY_WORK_MINUTES = 8 * 60;

  const workingDays = [];
  let currentDate = new Date(`${startDateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T00:00:00Z`);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      workingDays.push(new Date(currentDate));
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  if (workingDays.length === 0) {
    return { error: "No working days found in the selected period." };
  }

  let visitPool = [];
  puntos.forEach(punto => {
    for (let i = 0; i < (punto.frecuencia_mensual || 0); i++) {
      visitPool.push({ ...punto, visit_id: `${punto.id}-${i}` });
    }
  });

  visitPool.sort((a, b) => (b.minutos_servicio || 0) - (a.minutos_servicio || 0));

  const dailyRoutes = new Map();
  const weeklyWorkload = new Map();

  workingDays.forEach(day => {
    const isoDate = day.toISOString().split('T')[0];
    const weekKey = `${getISOWeekYear(day)}-${getISOWeek(day)}`;
    dailyRoutes.set(isoDate, { date: isoDate, points: [], totalMinutes: 0 });
    if (!weeklyWorkload.has(weekKey)) {
      weeklyWorkload.set(weekKey, 0);
    }
  });

  let dayIndex = 0;
  while (visitPool.length > 0) {
    const visit = visitPool.shift();
    let placed = false;
    for (let i = 0; i < workingDays.length; i++) {
      const currentDayIndex = (dayIndex + i) % workingDays.length;
      const day = workingDays[currentDayIndex];
      const isoDate = day.toISOString().split('T')[0];
      const weekKey = `${getISOWeekYear(day)}-${getISOWeek(day)}`;
      const route = dailyRoutes.get(isoDate);
      const currentWeekMinutes = weeklyWorkload.get(weekKey);

      if (route.totalMinutes + visit.minutos_servicio <= DAILY_WORK_MINUTES &&
          currentWeekMinutes + visit.minutos_servicio <= WEEKLY_WORK_MINUTES) {
        route.points.push(visit);
        route.totalMinutes += visit.minutos_servicio;
        weeklyWorkload.set(weekKey, currentWeekMinutes + visit.minutos_servicio);
        placed = true;
        dayIndex = currentDayIndex + 1;
        break;
      }
    }
    if (!placed) {
      logger.warn({ visit }, "Could not schedule visit due to capacity constraints.");
    }
  }

  const finalDailyRoutes = Array.from(dailyRoutes.values()).filter(r => r.points.length > 0);
  const totalVisitsPlanned = finalDailyRoutes.reduce((acc, r) => acc + r.points.length, 0);
  const totalMinutesPlanned = finalDailyRoutes.reduce((acc, r) => acc + r.totalMinutes, 0);

  return {
    period: { startDate: startDateStr, endDate: endDateStr },
    summary: {
      totalVisitsToPlan: puntos.reduce((acc, p) => acc + (p.frecuencia_mensual || 0), 0),
      totalVisitsPlanned,
      estimatedTotalHours: (totalMinutesPlanned / 60).toFixed(2),
      pointsToPlan: puntos.length,
      workingDays: workingDays.length,
    },
    dailyRoutes: finalDailyRoutes,
  };
}


async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!verifyCsrf(req, res)) return;

  const { error: authError, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parámetros inválidos.', details: parsed.error.format() });
  }

  const { mercaderistaId, startDate, endDate } = parsed.data;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: puntos, error: puntosError } = await supabaseAdmin
    .from('puntos_de_venta')
    .select('id, nombre, frecuencia_mensual, minutos_servicio')
    .gt('frecuencia_mensual', 0)
    .gt('minutos_servicio', 0);

  if (puntosError) {
    logger.error({ err: puntosError, userId: user.id }, 'Error fetching points of sale for planning');
    throw new Error('Error al obtener los puntos de venta.');
  }

  if (!puntos || puntos.length === 0) {
    return res.status(404).json({ error: 'No se encontraron puntos de venta con frecuencia y tiempo de servicio definidos.' });
  }

  const plan = generateMonthlyPlan(puntos, startDate, endDate);

  if (!plan || !plan.dailyRoutes || plan.dailyRoutes.length === 0) {
    return res.status(200).json({
      message: 'No se generaron rutas. Verifique los días laborables en el período y la cantidad de puntos de venta.',
      plan
    });
  }

  const routesToInsert = plan.dailyRoutes.map(route => ({
    fecha: route.date,
    puntos_de_venta_ids: route.points.map(p => p.id)
  }));

  const { error: rpcError } = await supabaseAdmin.rpc('bulk_insert_planned_routes', {
    mercaderista_id_param: mercaderistaId,
    start_date_param: startDate,
    end_date_param: endDate,
    routes_payload: routesToInsert
  });

  if (rpcError) {
    logger.error({ err: rpcError, userId: user.id, mercaderistaId }, 'Error saving planned routes via RPC');
    throw new Error('Error al guardar la planificación en la base de datos.');
  }

  res.status(200).json({
    message: `Planificación para ${plan.summary.workingDays} días generada y guardada con éxito.`,
    summary: plan.summary
  });
}

module.exports = withLogging(handler);
module.exports.generateMonthlyPlan = generateMonthlyPlan;
