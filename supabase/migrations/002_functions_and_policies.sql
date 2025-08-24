-- Functions, triggers and RLS policies

-- Creates a profile for a new user.
-- NOTE: SECURITY DEFINER is required to grant this trigger permission
-- to insert into the public.profiles table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'mercaderista');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fetches the role of the currently authenticated user.
-- NOTE: SECURITY DEFINER is required to bypass RLS policies, which would
-- otherwise cause a circular dependency (reading the profile requires the
-- role, but getting the role requires reading the profile).
-- By granting SELECT on the role column to authenticated users, we can
-- break this circular dependency and change the function to SECURITY INVOKER.
GRANT SELECT (role) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_todays_route_for_user(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  route_data JSON;
BEGIN
  SELECT
    json_build_object(
      'id', r.id,
      'fecha', r.fecha,
      'mercaderista_id', r.mercaderista_id,
      'puntos', (
        SELECT json_agg(
          json_build_object('id', pdv.id, 'nombre', pdv.nombre, 'direccion', pdv.direccion)
        )
        FROM public.puntos_de_venta pdv
        WHERE pdv.id = ANY(r.puntos_de_venta_ids)
      )
    )
  INTO route_data
  FROM public.rutas r
  WHERE r.mercaderista_id = p_user_id AND r.fecha = CURRENT_DATE;
  RETURN route_data;
END;
$$;

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON LANGUAGE sql AS $$
  SELECT json_build_object(
    'total_rutas', (SELECT COUNT(*) FROM public.rutas),
    'total_puntos_visitados', (SELECT COALESCE(SUM(array_length(puntos_de_venta_ids, 1)), 0) FROM public.rutas),
    'rutas_por_mercaderista', (
      SELECT json_agg(json_build_object('mercaderista', mercaderista_id, 'total_rutas', count))
      FROM (
        SELECT mercaderista_id, COUNT(*) as count
        FROM public.rutas
        GROUP BY mercaderista_id
        ORDER BY count DESC
      ) as subquery
    )
  );
$$;

ALTER TABLE public.puntos_de_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.puntos_de_venta FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow supervisors and admins to insert" ON public.puntos_de_venta FOR INSERT WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

CREATE POLICY "Allow assigned or privileged read access" ON public.rutas
  FOR SELECT
  USING (
    auth.uid() = mercaderista_id OR get_my_role() IN ('supervisor', 'admin')
  );
CREATE POLICY "Allow supervisors and admins to insert" ON public.rutas FOR INSERT WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

CREATE POLICY "Allow access to own profile or if admin" ON public.profiles
  FOR ALL
  USING (auth.uid() = id OR get_my_role() = 'admin')
  WITH CHECK (auth.uid() = id OR get_my_role() = 'admin');

CREATE POLICY "Users can see their own visits" ON public.visitas FOR SELECT USING (auth.uid() = mercaderista_id);
CREATE POLICY "Users can insert their own visits" ON public.visitas FOR INSERT WITH CHECK (auth.uid() = mercaderista_id);
CREATE POLICY "Users can update their own visits" ON public.visitas FOR UPDATE USING (auth.uid() = mercaderista_id);
CREATE POLICY "Supervisors and admins can see all visits" ON public.visitas FOR SELECT USING (get_my_role() IN ('supervisor', 'admin'));

