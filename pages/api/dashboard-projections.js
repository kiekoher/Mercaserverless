import { requireUser } from '../../lib/auth';
import { createClient } from '@supabase/supabase-js';
import logger from '../../lib/logger.server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
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
    const { data, error } = await supabaseAdmin.rpc('get_weekly_workload');

    if (error) {
        logger.error({ err: error }, 'Error calling get_weekly_workload function');
        throw new Error('Error al calcular la carga de trabajo semanal.');
    }
    // The RPC function is expected to return { mercaderista_id, mercaderista_nombre, total_horas }
    return data.map(item => ({
        mercaderista: item.mercaderista_nombre || `ID: ${item.mercaderista_id}`,
        hours: item.total_horas || 0,
    }));
}

async function getFrequencyCompliance() {
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
