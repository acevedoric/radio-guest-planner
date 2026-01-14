-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view guests" ON public.guests;

-- Create role-restricted SELECT policy (aligns with INSERT/UPDATE/DELETE policies)
CREATE POLICY "Producers and admins can view guests"
ON public.guests FOR SELECT
USING (
  public.has_role(auth.uid(), 'producer') OR 
  public.has_role(auth.uid(), 'admin')
);