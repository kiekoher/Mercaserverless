CREATE OR REPLACE FUNCTION public.create_or_update_route(
    p_ruta_id BIGINT, -- Nulo para crear, un ID para actualizar
    p_fecha DATE,
    p_mercaderista_id UUID,
    p_pdv_ids BIGINT[]
)
RETURNS TABLE (
    id BIGINT,
    fecha DATE,
    mercaderista_id UUID
) AS $$
DECLARE
    v_ruta_id BIGINT;
BEGIN
    -- Si p_ruta_id es nulo, creamos una nueva ruta. Si no, actualizamos.
    IF p_ruta_id IS NULL THEN
        INSERT INTO public.rutas (fecha, mercaderista_id)
        VALUES (p_fecha, p_mercaderista_id)
        RETURNING public.rutas.id INTO v_ruta_id;
    ELSE
        UPDATE public.rutas
        SET fecha = p_fecha, mercaderista_id = p_mercaderista_id
        WHERE public.rutas.id = p_ruta_id
        RETURNING public.rutas.id INTO v_ruta_id;

        -- Al actualizar, primero eliminamos los PDV antiguos de la ruta para evitar conflictos.
        DELETE FROM public.ruta_pdv WHERE ruta_id = v_ruta_id;
    END IF;

    -- Insertamos los nuevos puntos de venta en la tabla de unión.
    IF array_length(p_pdv_ids, 1) > 0 THEN
        INSERT INTO public.ruta_pdv (ruta_id, pdv_id)
        SELECT v_ruta_id, unnest(p_pdv_ids);
    END IF;

    -- Devolvemos la ruta creada o actualizada.
    RETURN QUERY
    SELECT r.id, r.fecha, r.mercaderista_id FROM public.rutas r WHERE r.id = v_ruta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para que los roles puedan ejecutar esta función.
-- Solo los supervisores y administradores deberían poder crear/actualizar rutas.
-- La lógica de la API debe verificar el rol antes de llamar a este RPC.
GRANT EXECUTE ON FUNCTION public.create_or_update_route(BIGINT, DATE, UUID, BIGINT[]) TO authenticated;
