-- In PostgreSQL, adding a value to an ENUM must be done in a transaction.
-- For Supabase migrations, each statement is transactional.
-- This command adds 'admin' to our existing app_role type.
ALTER TYPE public.app_role ADD VALUE 'admin';

-- We also need policies for admins to be able to manage user profiles.
-- This allows users with the 'admin' role to update any profile.
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- This allows admins to view all profiles, which is necessary for a user management page.
-- We need to drop the old public policy first to replace it with more specific ones.
DROP POLICY "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles." ON public.profiles
  FOR SELECT
  USING (public.get_my_role() = 'admin');
