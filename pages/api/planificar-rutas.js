import { requireUser } from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';
import logger from '../../lib/logger';
import { z } from 'zod';

// This would typically be in a shared config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const planSchema = z.object({
  mercaderistaId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // YYYY-MM-DD
});

// Main handler for the route planning endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { error: authError, user } = await requireUser(req, res, ['supervisor', 'admin']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }

  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parámetros inválidos.', details: parsed.error.format() });
  }

  const { mercaderistaId, startDate, endDate } = parsed.data;

  try {
    // 1. Fetch all points of sale with planning data
    const { data: puntos, error: puntosError } = await supabaseAdmin
      .from('puntos_de_venta')
      .select('id, nombre, frecuencia_mensual, minutos_servicio')
      .gt('frecuencia_mensual', 0)
      .gt('minutos_servicio', 0);

    if (puntosError) {
      logger.error({ err: puntosError }, 'Error fetching points of sale for planning');
      throw new Error('Error al obtener los puntos de venta.');
    }

    if (!puntos || puntos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron puntos de venta con frecuencia y tiempo de servicio definidos.' });
    }

    // 2. Implement the planning logic (this is a simplified placeholder)
    // A real implementation would be much more complex, involving calendar logic,
    // workload balancing, and potentially route optimization per day.
    const plan = generateMonthlyPlan(puntos, startDate, endDate);

    // For now, we'll just return the generated plan as a success response.
    // In a real scenario, you might save this plan to the 'rutas' table.
    res.status(200).json({ message: 'Planificación generada con éxito.', plan });

  } catch (error) {
    logger.error({ err: error, body: req.body }, 'Error in route planning');
    res.status(500).json({ error: error.message || 'Ocurrió un error en la planificación.' });
  }
}

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

  // 1. Get all working days (Mon-Fri) in the period
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

  // 2. Create a pool of all required visits for the month
  let visitPool = [];
  puntos.forEach(punto => {
    for (let i = 0; i < (punto.frecuencia_mensual || 0); i++) {
      visitPool.push({ ...punto, visit_id: `${punto.id}-${i}` });
    }
  });

  // Sort visit pool to prioritize points with higher service time
  visitPool.sort((a, b) => (b.minutos_servicio || 0) - (a.minutos_servicio || 0));

  // 3. Distribute visits across working days
  const dailyRoutes = new Map();
  const weeklyWorkload = new Map();

  workingDays.forEach(day => {
    const isoDate = day.toISOString().split('T')[0];
    const weekNumber = Math.floor(day.getUTCDate() / 7);
    dailyRoutes.set(isoDate, { date: isoDate, points: [], totalMinutes: 0 });
    if (!weeklyWorkload.has(weekNumber)) {
      weeklyWorkload.set(weekNumber, 0);
    }
  });

  let dayIndex = 0;
  while (visitPool.length > 0) {
    const visit = visitPool.shift(); // Get the next visit from the pool

    // Find the next available day that can accommodate the visit
    let placed = false;
    for (let i = 0; i < workingDays.length; i++) {
      const currentDayIndex = (dayIndex + i) % workingDays.length;
      const day = workingDays[currentDayIndex];
      const isoDate = day.toISOString().split('T')[0];
      const weekNumber = Math.floor(day.getUTCDate() / 7);

      const route = dailyRoutes.get(isoDate);
      const currentWeekMinutes = weeklyWorkload.get(weekNumber);

      if (route.totalMinutes + visit.minutos_servicio <= DAILY_WORK_MINUTES &&
          currentWeekMinutes + visit.minutos_servicio <= WEEKLY_WORK_MINUTES) {

        route.points.push(visit);
        route.totalMinutes += visit.minutos_servicio;
        weeklyWorkload.set(weekNumber, currentWeekMinutes + visit.minutos_servicio);
        placed = true;
        dayIndex = currentDayIndex + 1; // Start next search from the next day
        break;
      }
    }

    if (!placed) {
      // If a visit couldn't be placed, add it back to a separate "unplanned" list
      // This indicates a capacity issue. For now, we log it.
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
