-- Paso 1: Eliminar las funciones obsoletas que dependían del array 'puntos_de_venta_ids'.
-- Estas funciones se encontraban en las migraciones 002, 006, 008 y 009.
DROP FUNCTION IF EXISTS public.get_route_details(uuid);
DROP FUNCTION IF EXISTS public.get_all_routes_details();
DROP FUNCTION IF EXISTS public.plan_monthly_routes(uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_dashboard_projections(); -- También usa la estructura antigua

-- Paso 2: Actualizar la función de estadísticas del dashboard.
-- La versión anterior en la migración 003 contaba elementos del array.
-- La nueva versión contará las filas en la tabla de unión 'ruta_pdv'.
-- Asumimos que get_dashboard_stats existe, si no, la creamos.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
    total_mercaderistas BIGINT,
    total_pdv BIGINT,
    total_rutas BIGINT,
    total_puntos_visitados BIGINT,
    total_visitas_completadas BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'mercaderista') AS total_mercaderistas,
    (SELECT COUNT(*) FROM public.puntos_de_venta) AS total_pdv,
    (SELECT COUNT(*) FROM public.rutas) AS total_rutas,
    (SELECT COUNT(*) FROM public.ruta_pdv) AS total_puntos_visitados, -- Lógica actualizada
    (SELECT COUNT(*) FROM public.visitas WHERE estado = 'Completada') AS total_visitas_completadas;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Actualizar las políticas de seguridad a nivel de fila (RLS).

-- 3.1: Política en 'puntos_de_venta'.
-- La política anterior permitía ver PDVs si estaban en el array 'puntos_de_venta_ids' de una ruta asignada.
-- La nueva política lo comprueba con una subconsulta en la tabla 'ruta_pdv'.
DROP POLICY IF EXISTS "Los usuarios pueden ver los PDV de sus propias rutas" ON public.puntos_de_venta;
CREATE POLICY "Los usuarios pueden ver los PDV de sus propias rutas"
ON public.puntos_de_venta
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.rutas r
    JOIN public.ruta_pdv rp ON r.id = rp.ruta_id
    WHERE r.mercaderista_id = auth.uid() AND rp.pdv_id = puntos_de_venta.id
  )
);

-- 3.2: Crear nuevas políticas para la tabla de unión 'ruta_pdv'.
-- Solo los usuarios asignados a una ruta pueden ver sus relaciones con PDV.
CREATE POLICY "Los mercaderistas pueden ver las relaciones de sus propias rutas"
ON public.ruta_pdv
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.rutas r
    WHERE r.id = ruta_pdv.ruta_id AND r.mercaderista_id = auth.uid()
  )
);

-- Asumimos que la función get_my_role() existe de una migración anterior
-- Esta función es crucial para la política de Supervisor/Admin
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;


-- Los supervisores/administradores pueden gestionar todas las relaciones.
CREATE POLICY "Los supervisores y admins pueden gestionar todas las relaciones"
ON public.ruta_pdv
FOR ALL USING (
    (get_my_role() IN ('supervisor', 'admin'))
) WITH CHECK (
    (get_my_role() IN ('supervisor', 'admin'))
);
