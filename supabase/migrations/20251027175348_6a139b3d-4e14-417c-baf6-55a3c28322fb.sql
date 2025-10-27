-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'producer', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Only admins can manage roles (we'll need to bootstrap the first admin manually)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Production staff can manage guests" ON public.guests;

-- Create role-based policies for guests table

-- Everyone authenticated can view guests
CREATE POLICY "Authenticated users can view guests"
ON public.guests FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Producers and admins can create guests
CREATE POLICY "Producers can create guests"
ON public.guests FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'producer') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Producers and admins can update guests
CREATE POLICY "Producers can update guests"
ON public.guests FOR UPDATE
USING (
  public.has_role(auth.uid(), 'producer') OR 
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'producer') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Only admins can delete guests
CREATE POLICY "Admins can delete guests"
ON public.guests FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: Insert admin role for existing users (you can modify this after migration)
-- This assigns 'producer' role to all existing authenticated users as a safe default
-- You should manually promote at least one user to 'admin' after this migration
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'producer'::app_role
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;