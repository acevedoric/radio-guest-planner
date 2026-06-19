CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(trim(_email)) LIKE '%@caracoltv.com.co'
    OR EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE email = lower(trim(_email))
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
      WHERE lower(u.email) = lower(trim(_email))
        AND ur.role IN ('admin'::app_role, 'producer'::app_role)
    );
$$;