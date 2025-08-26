-- Habilitar RLS en tablas que aún no lo tienen o donde no está explícito
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- Revocar permisos excesivamente permisivos antes de definir los nuevos
REVOKE ALL ON TABLE public.rutas FROM authenticated;
REVOKE ALL ON TABLE public.visitas FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitas TO authenticated;
GRANT SELECT ON TABLE public.rutas TO authenticated;

-- Políticas para la tabla 'rutas'
DROP POLICY IF EXISTS "Los mercaderistas pueden ver sus propias rutas" ON public.rutas;
CREATE POLICY "Los mercaderistas pueden ver sus propias rutas"
  ON public.rutas FOR SELECT
  USING (mercaderista_id = auth.uid());

DROP POLICY IF EXISTS "Los supervisores/admins pueden ver todas las rutas" ON public.rutas;
CREATE POLICY "Los supervisores/admins pueden ver todas las rutas"
  ON public.rutas FOR SELECT
  USING (get_my_role() IN ('supervisor', 'admin'));

-- Políticas para la tabla 'visitas'
DROP POLICY IF EXISTS "Los mercaderistas pueden gestionar sus propias visitas" ON public.visitas;
CREATE POLICY "Los mercaderistas pueden gestionar sus propias visitas"
  ON public.visitas FOR ALL
  USING (mercaderista_id = auth.uid());

DROP POLICY IF EXISTS "Los supervisores/admins pueden ver todas las visitas" ON public.visitas;
CREATE POLICY "Los supervisores/admins pueden ver todas las visitas"
  ON public.visitas FOR SELECT
  USING (get_my_role() IN ('supervisor', 'admin'));


-- Robustecer el RPC create_or_update_route
CREATE OR REPLACE FUNCTION public.create_or_update_route(
    p_ruta_id BIGINT,
    p_fecha DATE,
    p_mercaderista_id UUID,
    p_pdv_ids BIGINT[]
)
RETURNS TABLE (id BIGINT, fecha DATE, mercaderista_id UUID) AS $$
DECLARE
    v_ruta_id BIGINT;
BEGIN
    IF get_my_role() NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'permission denied: supervisors and admins only';
    END IF;

    IF p_ruta_id IS NULL THEN
        INSERT INTO public.rutas (fecha, mercaderista_id)
        VALUES (p_fecha, p_mercaderista_id)
        RETURNING public.rutas.id INTO v_ruta_id;
    ELSE
        UPDATE public.rutas
        SET fecha = p_fecha, mercaderista_id = p_mercaderista_id
        WHERE public.rutas.id = p_ruta_id
        RETURNING public.rutas.id INTO v_ruta_id;

        DELETE FROM public.ruta_pdv WHERE ruta_id = v_ruta_id;
    END IF;

    IF array_length(p_pdv_ids, 1) > 0 THEN
        INSERT INTO public.ruta_pdv (ruta_id, pdv_id)
        SELECT v_ruta_id, unnest(p_pdv_ids);
    END IF;

    RETURN QUERY
    SELECT r.id, r.fecha, r.mercaderista_id FROM public.rutas r WHERE r.id = v_ruta_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Robustecer el RPC bulk_create_routes
CREATE OR REPLACE FUNCTION public.bulk_create_routes(
    p_mercaderista_id UUID,
    p_routes JSONB
)
RETURNS VOID AS $$
DECLARE
    route_item JSONB;
    v_ruta_id BIGINT;
    pdv_id_int BIGINT;
BEGIN
    IF get_my_role() NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'permission denied: supervisors and admins only';
    END IF;

    DELETE FROM public.rutas r
    WHERE r.mercaderista_id = p_mercaderista_id
    AND r.fecha >= (SELECT MIN((elem->>'fecha')::DATE) FROM jsonb_array_elements(p_routes) elem)
    AND r.fecha <= (SELECT MAX((elem->>'fecha')::DATE) FROM jsonb_array_elements(p_routes) elem);

    FOR route_item IN SELECT * FROM jsonb_array_elements(p_routes)
    LOOP
        INSERT INTO public.rutas (fecha, mercaderista_id)
        VALUES ((route_item->>'fecha')::DATE, p_mercaderista_id)
        RETURNING id INTO v_ruta_id;

        FOR pdv_id_int IN SELECT jsonb_array_elements_text(route_item->'pdv_ids')::BIGINT
        LOOP
            INSERT INTO public.ruta_pdv (ruta_id, pdv_id)
            VALUES (v_ruta_id, pdv_id_int);
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
