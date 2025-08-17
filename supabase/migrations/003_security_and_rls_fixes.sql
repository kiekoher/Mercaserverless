-- Apply security fixes for RLS and functions
-- Migration generated on 2025-08-17

-- Fix for Critical Vulnerability: Secure get_dashboard_stats function
-- This function now checks for 'supervisor' or 'admin' roles before returning data.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only supervisors and admins can access dashboard stats
  IF get_my_role() NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'permission denied for get_dashboard_stats';
  END IF;

  RETURN (SELECT json_build_object(
    'total_rutas', (SELECT COUNT(*) FROM public.rutas),
    'total_puntos_visitados', (SELECT COALESCE(SUM(array_length(puntos_de_venta_ids, 1)), 0) FROM public.rutas),
    'rutas_por_mercaderista', (
      SELECT json_agg(json_build_object('mercaderista', mercaderista_id, 'total_rutas', count))
      FROM (
        SELECT mercaderista_id, COUNT(*) as count
        FROM public.rutas
        GROUP BY mercaderista_id
        ORDER BY count DESC
      ) as subquery
    )
  ));
END;
$$;

-- Fix for High-Priority Functional Blocker: Add missing RLS policies

-- Policies for puntos_de_venta table
CREATE POLICY "Allow supervisors and admins to update" ON public.puntos_de_venta
  FOR UPDATE
  USING (get_my_role() IN ('supervisor', 'admin'))
  WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

CREATE POLICY "Allow supervisors and admins to delete" ON public.puntos_de_venta
  FOR DELETE
  USING (get_my_role() IN ('supervisor', 'admin'));

-- Policies for rutas table
CREATE POLICY "Allow supervisors and admins to update" ON public.rutas
  FOR UPDATE
  USING (get_my_role() IN ('supervisor', 'admin'))
  WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

CREATE POLICY "Allow supervisors and admins to delete" ON public.rutas
  FOR DELETE
  USING (get_my_role() IN ('supervisor', 'admin'));
