-- Migration to harden RLS policies and secure database functions.
-- This addresses several security flaws found during the audit.

-- 1. CRITICAL FIX: Correct the overly permissive SELECT policy on puntos_de_venta.
-- The old policy allowed any authenticated user to see all points of sale.

-- Drop the old, insecure policy if it exists.
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.puntos_de_venta;

-- Create a new, stricter policy. A user can see a point of sale if:
-- a) They are a supervisor or admin.
-- b) The point of sale is included in any route assigned to them.
CREATE POLICY "Allow restricted read access to PDV" ON public.puntos_de_venta
  FOR SELECT
  USING (
    get_my_role() IN ('supervisor', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.rutas r
      WHERE r.mercaderista_id = auth.uid() AND puntos_de_venta.id = ANY(r.puntos_de_venta_ids)
    )
  );


-- 2. HIGH FIX: Secure dashboard functions that were leaking business intelligence data.
-- These functions will now check for the correct role before executing.

CREATE OR REPLACE FUNCTION public.get_weekly_workload()
RETURNS TABLE(mercaderista_id uuid, mercaderista_nombre text, total_horas numeric)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF get_my_role() NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'permission denied for get_weekly_workload';
    END IF;

    RETURN QUERY
    SELECT
        p.id AS mercaderista_id,
        p.full_name AS mercaderista_nombre,
        COALESCE(SUM(pdv.minutos_servicio) / 60.0, 0) AS total_horas
    FROM
        public.rutas r
    JOIN
        public.profiles p ON r.mercaderista_id = p.id
    JOIN
        unnest(r.puntos_de_venta_ids) WITH ORDINALITY AS u(pdv_id, ord) ON TRUE
    JOIN
        public.puntos_de_venta pdv ON u.pdv_id = pdv.id
    WHERE
        r.fecha >= date_trunc('week', NOW()) AND r.fecha < date_trunc('week', NOW()) + interval '1 week'
    GROUP BY
        p.id, p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_frequency_compliance()
RETURNS TABLE(total_required_visits numeric, total_planned_visits bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF get_my_role() NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'permission denied for get_frequency_compliance';
    END IF;

    RETURN QUERY
    SELECT
        (SELECT SUM(frecuencia_mensual) FROM public.puntos_de_venta WHERE frecuencia_mensual > 0) AS total_required_visits,
        COUNT(DISTINCT u.pdv_id) AS total_planned_visits
    FROM
        public.rutas r
    CROSS JOIN
        unnest(r.puntos_de_venta_ids) WITH ORDINALITY AS u(pdv_id, ord)
    WHERE
        r.fecha >= date_trunc('month', NOW()) AND r.fecha < date_trunc('month', NOW()) + interval '1 month';
END;
$$;


-- 3. MEDIUM FIX: Harden the bulk route planning function with an internal role check.
-- This prevents relying solely on the API layer for security.

CREATE OR REPLACE FUNCTION public.bulk_insert_planned_routes(
    mercaderista_id_param UUID,
    start_date_param DATE,
    end_date_param DATE,
    routes_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
    route_item JSONB;
BEGIN
    IF get_my_role() NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'permission denied for bulk_insert_planned_routes';
    END IF;

    DELETE FROM public.rutas
    WHERE
        mercaderista_id = mercaderista_id_param
        AND fecha >= start_date_param
        AND fecha <= end_date_param;

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
