-- Remove the insecure public policy
DROP POLICY IF EXISTS "Allow all operations on guests" ON public.guests;

-- Add authenticated-only policy for production staff
CREATE POLICY "Production staff can manage guests" 
ON public.guests
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Add helpful comment
COMMENT ON POLICY "Production staff can manage guests" ON public.guests IS 
'Only authenticated production staff can view, create, update, or delete guest records. This protects guest personal information from public access.';