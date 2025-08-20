-- Add business-specific columns to puntos_de_venta table
ALTER TABLE public.puntos_de_venta
ADD COLUMN cuota NUMERIC,
ADD COLUMN tipologia TEXT,
ADD COLUMN frecuencia_mensual INTEGER,
ADD COLUMN minutos_servicio INTEGER;

COMMENT ON COLUMN public.puntos_de_venta.cuota IS 'Cuota de venta o valor del punto de venta.';
COMMENT ON COLUMN public.puntos_de_venta.tipologia IS 'Clasificación del punto de venta (ej. A, B, C).';
COMMENT ON COLUMN public.puntos_de_venta.frecuencia_mensual IS 'Número de visitas requeridas al mes.';
COMMENT ON COLUMN public.puntos_de_venta.minutos_servicio IS 'Tiempo estimado de servicio en minutos para una visita.';
