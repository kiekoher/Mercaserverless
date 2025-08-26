CREATE OR REPLACE FUNCTION public.bulk_create_routes(
    p_mercaderista_id UUID,
    p_routes JSONB -- [{"fecha": "YYYY-MM-DD", "pdv_ids": [1, 2, 3]}, ...]
)
RETURNS VOID AS $$
DECLARE
    route_item JSONB;
    v_ruta_id BIGINT;
    pdv_id_int BIGINT;
BEGIN
    -- Es importante borrar las rutas existentes en el rango de fechas para este mercaderista
    -- para evitar duplicados al re-planificar.
    DELETE FROM public.rutas r
    WHERE r.mercaderista_id = p_mercaderista_id
    AND r.fecha >= (SELECT MIN((elem->>'fecha')::DATE) FROM jsonb_array_elements(p_routes) elem)
    AND r.fecha <= (SELECT MAX((elem->>'fecha')::DATE) FROM jsonb_array_elements(p_routes) elem);

    FOR route_item IN SELECT * FROM jsonb_array_elements(p_routes)
    LOOP
        -- Insertar la ruta principal
        INSERT INTO public.rutas (fecha, mercaderista_id)
        VALUES ((route_item->>'fecha')::DATE, p_mercaderista_id)
        RETURNING id INTO v_ruta_id;

        -- Insertar los PDVs en la tabla de unión
        FOR pdv_id_int IN SELECT jsonb_array_elements_text(route_item->'pdv_ids')::BIGINT
        LOOP
            INSERT INTO public.ruta_pdv (ruta_id, pdv_id)
            VALUES (v_ruta_id, pdv_id_int);
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.bulk_create_routes(UUID, JSONB) TO authenticated;
