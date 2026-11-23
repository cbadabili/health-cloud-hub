-- SECURITY FIX: stop users choosing their own privileged role at sign-up.
--
-- Previously handle_new_user() cast raw_user_meta_data->>'role' straight to
-- app_role. That metadata is supplied by the client, so anyone with the public
-- anon key could call auth.signUp({ options: { data: { role: 'super_admin' } } })
-- and gain the "Super admins can manage all ..." RLS policies, i.e. full access
-- to every patient's records.
--
-- Now only 'patient' or 'doctor' can be chosen at sign-up; anything else
-- (including 'super_admin' or an invalid value) becomes 'patient'.
-- super_admin must be granted manually by an existing admin or via SQL in the
-- Supabase dashboard, e.g.:
--   UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = '<uuid>';
--
-- CREATE OR REPLACE keeps the existing on_auth_user_created trigger attached.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- Allow-list of self-selectable roles. Never trust client metadata for anything else.
  IF requested_role = 'doctor' THEN
    assigned_role := 'doctor'::public.app_role;
  ELSE
    assigned_role := 'patient'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
