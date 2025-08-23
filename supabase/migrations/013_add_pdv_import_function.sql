-- Migration to add bulk import functionality for Puntos de Venta (PDV).

-- 1. Add an 'updated_at' column to track modifications.
ALTER TABLE public.puntos_de_venta
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create a reusable function to update the 'updated_at' column.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create a trigger to automatically call the function before any update.
CREATE TRIGGER on_pdv_update
  BEFORE UPDATE ON public.puntos_de_venta
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- 2. Add a unique constraint to prevent duplicate PDVs based on name and address.
-- This is necessary for the ON CONFLICT clause of the upsert function to work reliably.
ALTER TABLE public.puntos_de_venta
ADD CONSTRAINT pdv_name_address_unique UNIQUE (nombre, direccion);


-- 3. Create the function to bulk upsert (insert or update) points of sale from a JSONB payload.
CREATE OR REPLACE FUNCTION public.bulk_upsert_pdv(
  pdvs_data JSONB
)
RETURNS JSON -- Return a summary of the operation
LANGUAGE plpgsql
SECURITY DEFINER -- Run with the permissions of the function owner
AS $$
DECLARE
  pdv_record JSONB;
  result RECORD;
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through each object in the JSONB array
  FOR pdv_record IN SELECT * FROM jsonb_array_elements(pdvs_data)
  LOOP
    WITH upsert AS (
      INSERT INTO public.puntos_de_venta (nombre, direccion, ciudad, latitud, longitud, cuota, tipologia, frecuencia_mensual, minutos_servicio)
      VALUES (
        pdv_record->>'nombre',
        pdv_record->>'direccion',
        pdv_record->>'ciudad',
        (pdv_record->>'latitud')::REAL,
        (pdv_record->>'longitud')::REAL,
        (pdv_record->>'cuota')::NUMERIC,
        pdv_record->>'tipologia',
        (pdv_record->>'frecuencia_mensual')::INTEGER,
        (pdv_record->>'minutos_servicio')::INTEGER
      )
      ON CONFLICT (nombre, direccion)
      DO UPDATE SET
        ciudad = EXCLUDED.ciudad,
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        cuota = EXCLUDED.cuota,
        tipologia = EXCLUDED.tipologia,
        frecuencia_mensual = EXCLUDED.frecuencia_mensual,
        minutos_servicio = EXCLUDED.minutos_servicio
      RETURNING xmax -- xmax is 0 for an insert, non-zero for an update
    )
    SELECT xmax INTO result FROM upsert;

    IF result.xmax = 0 THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

  END LOOP;

  RETURN json_build_object('inserted', inserted_count, 'updated', updated_count);
END;
$$;

-- 4. Grant execution permission to authenticated users.
-- The API endpoint will be the primary guard, checking for 'supervisor' or 'admin' roles.
GRANT EXECUTE ON FUNCTION public.bulk_upsert_pdv(JSONB) TO authenticated;
