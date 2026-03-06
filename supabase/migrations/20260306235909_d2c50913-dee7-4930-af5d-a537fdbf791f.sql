DROP POLICY "Admins can delete guests" ON public.guests;
CREATE POLICY "Producers and admins can delete guests" 
  ON public.guests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));