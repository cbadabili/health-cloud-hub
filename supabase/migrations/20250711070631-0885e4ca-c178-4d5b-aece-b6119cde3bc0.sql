-- Create the app_role enum type if it doesn't exist
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('super_admin', 'doctor', 'patient');

-- Update the user_roles table to use the correct enum type
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;