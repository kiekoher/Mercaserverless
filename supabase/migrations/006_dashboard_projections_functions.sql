-- Function to calculate weekly workload per merchandiser
CREATE OR REPLACE FUNCTION get_weekly_workload()
RETURNS TABLE (
    mercaderista_id UUID,
    mercaderista_nombre TEXT,
    total_horas NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS mercaderista_id,
        p.full_name AS mercaderista_nombre,
        COALESCE(SUM(pdv.minutos_servicio) / 60.0, 0) AS total_horas
    FROM
        public.rutas r
    JOIN
        public.profiles p ON r.mercaderista_id = p.id
    -- Unnest the array of point IDs to join with a regular table
    JOIN
        unnest(r.puntos_de_venta_ids) WITH ORDINALITY AS u(pdv_id, ord) ON TRUE
    JOIN
        public.puntos_de_venta pdv ON u.pdv_id = pdv.id
    WHERE
        r.fecha >= date_trunc('week', NOW()) AND r.fecha < date_trunc('week', NOW()) + interval '1 week'
    GROUP BY
        p.id, p.full_name;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate visit frequency compliance for the current month
CREATE OR REPLACE FUNCTION get_frequency_compliance()
RETURNS TABLE (
    total_required_visits NUMERIC,
    total_planned_visits BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT SUM(frecuencia_mensual) FROM public.puntos_de_venta WHERE frecuencia_mensual > 0) AS total_required_visits,
        COUNT(DISTINCT u.pdv_id) AS total_planned_visits
    FROM
        public.rutas r
    -- Unnest the array of point IDs to join with a regular table
    CROSS JOIN
        unnest(r.puntos_de_venta_ids) WITH ORDINALITY AS u(pdv_id, ord)
    WHERE
        r.fecha >= date_trunc('month', NOW()) AND r.fecha < date_trunc('month', NOW()) + interval '1 month';
END;
$$ LANGUAGE plpgsql;
