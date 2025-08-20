import { requireUser } from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';
import logger from '../../lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { error: authError } = await requireUser(req, res, ['supervisor', 'admin']);
    if (authError) {
        return res.status(authError.status).json({ error: authError.message });
    }

    try {
        // Placeholder for complex data fetching and calculation
        const workload = await getWeeklyWorkload();
        const frequency = await getFrequencyCompliance();

        res.status(200).json({
            workload,
            frequency,
        });

    } catch (error) {
        logger.error({ err: error }, 'Error fetching dashboard projection data');
        res.status(500).json({ error: 'Failed to fetch projection data' });
    }
}

async function getWeeklyWorkload() {
    // In a real implementation, this would:
    // 1. Get the start and end of the current week.
    // 2. Fetch all `rutas` within this week.
    // 3. For each `ruta`, get the `puntos_de_venta_ids`.
    // 4. Fetch the `minutos_servicio` for each of those points.
    // 5. Sum the minutes per mercaderista and convert to hours.

    // Placeholder data:
    return [
        { mercaderista: 'John Doe (mock)', hours: 38 },
        { mercaderista: 'Jane Smith (mock)', hours: 42 },
        { mercaderista: 'Peter Jones (mock)', hours: 25 },
    ];
}

async function getFrequencyCompliance() {
    // In a real implementation, this would:
    // 1. Get the start and end of the current month.
    // 2. Fetch all `puntos_de_venta` with `frecuencia_mensual` > 0.
    // 3. For each of those points, count the number of `visitas` in the current month.
    // 4. Calculate the overall percentage of planned vs required visits.

    // Placeholder data:
    return {
        planned: 650,
        required: 800,
        percentage: ((650 / 800) * 100).toFixed(1),
    };
}
