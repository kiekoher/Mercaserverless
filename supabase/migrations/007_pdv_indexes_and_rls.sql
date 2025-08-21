-- Add indexes and update RLS policies for planning columns

-- Indexes to speed up planning queries
CREATE INDEX IF NOT EXISTS puntos_de_venta_frecuencia_mensual_idx
  ON public.puntos_de_venta (frecuencia_mensual);
CREATE INDEX IF NOT EXISTS puntos_de_venta_minutos_servicio_idx
  ON public.puntos_de_venta (minutos_servicio);

-- Ensure new planning fields are validated in RLS policies
DROP POLICY IF EXISTS "Allow supervisors and admins to insert" ON public.puntos_de_venta;
CREATE POLICY "Allow supervisors and admins to insert" ON public.puntos_de_venta
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('supervisor', 'admin')
    AND COALESCE(frecuencia_mensual, 0) >= 0
    AND COALESCE(minutos_servicio, 0) >= 0
  );

DROP POLICY IF EXISTS "Allow supervisors and admins to update" ON public.puntos_de_venta;
CREATE POLICY "Allow supervisors and admins to update" ON public.puntos_de_venta
  FOR UPDATE
  USING (get_my_role() IN ('supervisor', 'admin'))
  WITH CHECK (
    get_my_role() IN ('supervisor', 'admin')
    AND COALESCE(frecuencia_mensual, 0) >= 0
    AND COALESCE(minutos_servicio, 0) >= 0
  );
