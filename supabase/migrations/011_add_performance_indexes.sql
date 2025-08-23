-- Migration to add performance-critical indexes to the database.
-- These indexes will speed up common query patterns, especially filtering, joins,
-- and lookups within array columns.

-- Indexes on `rutas` table
-- For filtering routes by date (e.g., finding today's route for a user)
CREATE INDEX IF NOT EXISTS idx_rutas_fecha ON public.rutas(fecha);

-- For filtering routes by merchandiser, which is a very common operation.
CREATE INDEX IF NOT EXISTS idx_rutas_mercaderista_id ON public.rutas(mercaderista_id);

-- GIN index for the array column. This is crucial for efficiently querying
-- for routes containing specific points of sale (e.g., using the @> or && operators).
-- It will also significantly speed up the RLS policy on the puntos_de_venta table.
CREATE INDEX IF NOT EXISTS idx_rutas_puntos_de_venta_ids ON public.rutas USING GIN (puntos_de_venta_ids);


-- Indexes on `visitas` table
-- Foreign key columns are not automatically indexed in PostgreSQL, so we add them manually.
-- For joining and filtering by route.
CREATE INDEX IF NOT EXISTS idx_visitas_ruta_id ON public.visitas(ruta_id);

-- For joining and filtering by point of sale.
CREATE INDEX IF NOT EXISTS idx_visitas_punto_de_venta_id ON public.visitas(punto_de_venta_id);

-- For filtering visits by merchandiser.
CREATE INDEX IF NOT EXISTS idx_visitas_mercaderista_id ON public.visitas(mercaderista_id);


-- Index on `profiles` table
-- For speeding up role checks in RLS policies, which rely on the get_my_role() function.
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
