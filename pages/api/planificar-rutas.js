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
 * Generates a simplified monthly visit plan.
 * @param {Array} puntos - Array of points of sale.
 * @param {string} startDate - Start date of the planning period.
 * @param {string} endDate - End date of the planning period.
 * @returns {Object} - A plan object.
 */
function generateMonthlyPlan(puntos, startDate, endDate) {
  // This is a placeholder for the complex planning logic.
  // A real algorithm would:
  // 1. Calculate the number of working days in the date range.
  // 2. Calculate the total required visits for all PDVs.
  // 3. Distribute visits evenly across the days, respecting the 40-hour weekly limit.
  // 4. Group visits into daily routes.

  const totalVisits = puntos.reduce((acc, p) => acc + (p.frecuencia_mensual || 0), 0);
  const totalMinutes = puntos.reduce((acc, p) => acc + ((p.frecuencia_mensual || 0) * (p.minutos_servicio || 0)), 0);
  const totalHours = totalMinutes / 60;

  return {
    period: { startDate, endDate },
    summary: {
      totalVisitsToPlan: totalVisits,
      estimatedTotalHours: totalHours.toFixed(2),
      pointsToPlan: puntos.length,
    },
    // The detailed daily plan would be generated here
    dailyRoutes: [
      // Example structure:
      // { date: '2024-08-01', points: [ { id: 1, nombre: 'PDV 1' }, ... ] },
      // { date: '2024-08-02', points: [ { id: 3, nombre: 'PDV 3' }, ... ] },
    ]
  };
}
