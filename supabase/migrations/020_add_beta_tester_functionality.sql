-- Migration to add closed-beta functionality.
-- Creates a table to store invited emails and modifies the new user trigger
-- to only allow invited users to sign up.

-- 1. Create the table to store emails of invited beta testers.
CREATE TABLE public.beta_invites (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  note TEXT
);
COMMENT ON TABLE public.beta_invites IS 'Stores emails of users invited to the closed beta.';
COMMENT ON COLUMN public.beta_invites.created_by IS 'The admin who invited the user.';
COMMENT ON COLUMN public.beta_invites.note IS 'Optional note about the invite.';

-- 2. Enable RLS on the new table and set up policies.
ALTER TABLE public.beta_invites ENABLE ROW LEVEL SECURITY;

-- Admins can do anything with the invite list.
CREATE POLICY "Allow admin full access to beta invites" ON public.beta_invites
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- 3. Modify the new user trigger to check against the beta invites table.
-- The function is recreated to include the new logic.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Check if the new user's email exists in the beta_invites table.
  -- This check is bypassed if the new user is being created by an admin through other means,
  -- or for testing purposes where auth bypass is enabled.
  -- For a standard public sign-up, get_my_role() will be null at this stage.
  IF get_my_role() IS NULL AND NOT EXISTS (SELECT 1 FROM public.beta_invites WHERE email = new.email) THEN
    -- If the email is not in the invite list, prevent the user creation.
    RAISE EXCEPTION 'permission denied: email is not on the beta invitation list';
  END IF;

  -- If the user is invited (or the check is bypassed), proceed with creating their profile.
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'mercaderista');
  RETURN new;
END;
$$;

-- The trigger itself does not need to be changed, as it just calls the function.
-- It was created in migration 002.
--
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
