CREATE TABLE public.guest_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  hour_number integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_documents TO authenticated;
GRANT ALL ON public.guest_documents TO service_role;

ALTER TABLE public.guest_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers and admins manage guest documents"
ON public.guest_documents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_guest_documents_guest ON public.guest_documents (guest_id, hour_number);

CREATE TABLE public.guest_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  hour_number integer NOT NULL DEFAULT 1,
  url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_urls TO authenticated;
GRANT ALL ON public.guest_urls TO service_role;

ALTER TABLE public.guest_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers and admins manage guest urls"
ON public.guest_urls FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_guest_urls_guest ON public.guest_urls (guest_id, hour_number);