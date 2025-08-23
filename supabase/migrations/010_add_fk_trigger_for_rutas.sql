-- Migration to ensure data integrity for the denormalized `puntos_de_venta_ids` array in the `rutas` table.
-- This adds a trigger that acts like a foreign key constraint for array elements.

-- 1. Create the trigger function.
-- This function checks if all BIGINTs in the `puntos_de_venta_ids` array of a new or updated row
-- in `rutas` correspond to an actual `id` in the `puntos_de_venta` table.

CREATE OR REPLACE FUNCTION public.validate_pdv_ids_exist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    id_count INTEGER;
    id_array_length INTEGER;
BEGIN
    -- Get the length of the array of IDs being inserted/updated.
    id_array_length := array_length(NEW.puntos_de_venta_ids, 1);

    -- If the array is null or empty, there's nothing to check, so we can proceed.
    IF id_array_length IS NULL OR id_array_length = 0 THEN
        RETURN NEW;
    END IF;

    -- Count how many of the IDs from the array actually exist in the puntos_de_venta table.
    -- We only check distinct IDs to avoid issues with duplicates in the input array.
    SELECT count(DISTINCT id)
    INTO id_count
    FROM public.puntos_de_venta
    WHERE id = ANY(NEW.puntos_de_venta_ids);

    -- If the number of found IDs does not match the number of unique IDs in the array,
    -- it means at least one ID is invalid. Raise an exception to abort the transaction.
    IF id_count <> (SELECT count(DISTINCT unnested_id) FROM unnest(NEW.puntos_de_venta_ids) as unnested_id) THEN
        RAISE EXCEPTION 'Invalid punto_de_venta ID found in puntos_de_venta_ids array. All IDs must exist in the puntos_de_venta table.';
    END IF;

    -- If all checks pass, allow the operation to proceed.
    RETURN NEW;
END;
$$;

-- 2. Create the trigger.
-- This trigger executes the validation function before any INSERT or UPDATE on the `rutas` table.
CREATE TRIGGER trigger_validate_pdv_ids
  BEFORE INSERT OR UPDATE ON public.rutas
  FOR EACH ROW EXECUTE FUNCTION public.validate_pdv_ids_exist();

COMMENT ON FUNCTION public.validate_pdv_ids_exist IS 'Ensures that all IDs in rutas.puntos_de_venta_ids exist in the puntos_de_venta table.';
