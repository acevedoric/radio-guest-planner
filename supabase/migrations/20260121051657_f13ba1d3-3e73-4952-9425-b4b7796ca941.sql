-- Fix 1: Make guest-documents bucket private and update RLS policies
UPDATE storage.buckets 
SET public = false 
WHERE id = 'guest-documents';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read guest documents" ON storage.objects;

-- Create role-based SELECT policy for producers and admins
CREATE POLICY "Producers and admins can read guest documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'guest-documents' AND
  (public.has_role(auth.uid(), 'producer') OR public.has_role(auth.uid(), 'admin'))
);