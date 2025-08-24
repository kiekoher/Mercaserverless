-- supabase/migrations/014_fix_profile_update_rls.sql

-- Eliminar las políticas de actualización antiguas y permisivas en la tabla de perfiles.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Crear una política segura para que los usuarios actualicen su propio perfil.
-- La cláusula WITH CHECK impide que un usuario cambie su propio ID o rol.
CREATE POLICY "Users can update their own profile securely" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Un usuario no puede cambiar su propio rol.
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Crear una política para que los administradores actualicen cualquier perfil.
-- El CHECK aquí es menos restrictivo, pero podría usarse para impedir que un admin se auto-degrade.
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
