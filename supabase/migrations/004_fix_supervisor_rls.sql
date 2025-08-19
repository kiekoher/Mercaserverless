-- Migration generated on 2025-08-18
-- Fix for High-Priority Functional Blocker (A-1) and Medium-Priority Gap (M-2)

-- Drop the old, separate SELECT policies on the profiles table
-- It's safer to check if they exist before dropping
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own profile' AND polrelid = 'public.profiles'::regclass) THEN
      DROP POLICY "Users can view their own profile" ON public.profiles;
   END IF;
   IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view all profiles' AND polrelid = 'public.profiles'::regclass) THEN
      DROP POLICY "Admins can view all profiles" ON public.profiles;
   END IF;
END
$$;

-- Create a new, unified SELECT policy for the profiles table
CREATE POLICY "Allow profile read access based on role" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id OR get_my_role() IN ('supervisor', 'admin')
  );

-- Add missing UPDATE and DELETE policies for the visitas table for privileged roles (M-2)
CREATE POLICY "Allow supervisors and admins to update visits" ON public.visitas
  FOR UPDATE
  USING (get_my_role() IN ('supervisor', 'admin'))
  WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

CREATE POLICY "Allow supervisors and admins to delete visits" ON public.visitas
  FOR DELETE
  USING (get_my_role() IN ('supervisor', 'admin'));
