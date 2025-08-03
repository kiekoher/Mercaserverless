-- 1. Create a custom type for user roles
CREATE TYPE public.app_role AS ENUM ('supervisor', 'mercaderista');

-- 2. Create a table for public user profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'mercaderista'
);

-- Add comments to the table
COMMENT ON TABLE public.profiles IS 'Public profile information for each user.';
COMMENT ON COLUMN public.profiles.id IS 'References auth.users.id';

-- 3. Set up Row Level Security (RLS) for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. This trigger automatically creates a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, (new.raw_user_meta_data->>'role')::public.app_role);
  RETURN new;
END;
$$;

-- 5. Attach the trigger to the auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Now, let's update existing RLS policies to be role-based
-- First, drop the old policies
DROP POLICY "Allow authenticated insert access" ON public.puntos_de_venta;
DROP POLICY "Allow authenticated insert access" ON public.rutas;

-- Helper function to get the role of the current user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- New RLS policies for 'puntos_de_venta'
CREATE POLICY "Allow supervisors to insert" ON public.puntos_de_venta
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'supervisor');

-- New RLS policies for 'rutas'
CREATE POLICY "Allow supervisors to insert" ON public.rutas
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'supervisor');
