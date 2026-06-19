GRANT SELECT ON public.guests TO anon;
CREATE POLICY "Anyone can view guests"
ON public.guests
FOR SELECT
TO anon
USING (true);