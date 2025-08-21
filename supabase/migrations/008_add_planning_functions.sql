-- Function to bulk-insert planned routes for a merchandiser over a period.
-- This function first clears any existing routes for the given merchandiser and date range,
-- then inserts the new routes. This makes the planning operation idempotent.

CREATE OR REPLACE FUNCTION public.bulk_insert_planned_routes(
    mercaderista_id_param UUID,
    start_date_param DATE,
    end_date_param DATE,
    routes_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    route_item JSONB;
BEGIN
    -- Step 1: Delete existing routes for this merchandiser in the specified date range.
    -- This prevents creating duplicate routes if the user re-runs the planning.
    DELETE FROM public.rutas
    WHERE
        mercaderista_id = mercaderista_id_param
        AND fecha >= start_date_param
        AND fecha <= end_date_param;

    -- Step 2: Loop through the provided JSON array of routes and insert them.
    -- The JSONB payload is expected to be an array of objects:
    -- [{ "fecha": "YYYY-MM-DD", "puntos_de_venta_ids": [1, 2, 3] }, ...]
    FOR route_item IN SELECT * FROM jsonb_array_elements(routes_payload)
    LOOP
        INSERT INTO public.rutas (mercaderista_id, fecha, puntos_de_venta_ids)
        VALUES (
            mercaderista_id_param,
            (route_item->>'fecha')::DATE,
            (
                SELECT array_agg(value::BIGINT)
                FROM jsonb_array_elements_text(route_item->'puntos_de_venta_ids')
            )
        );
    END LOOP;
END;
$$;

-- Grant execution permission to authenticated users.
-- The API endpoint already checks for roles (supervisor, admin), so this is an added layer of security.
GRANT EXECUTE ON FUNCTION public.bulk_insert_planned_routes(UUID, DATE, DATE, JSONB) TO authenticated;
