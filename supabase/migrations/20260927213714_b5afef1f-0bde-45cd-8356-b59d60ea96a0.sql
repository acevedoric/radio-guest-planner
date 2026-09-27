-- Repair drift: guest_documents / guest_urls were already authored in
-- 20260812182122_c208372d-8d7c-45f5-9180-532424cf6916.sql but never made it
-- into the live Supabase project. Recreated here with IF NOT EXISTS / DROP
-- POLICY IF EXISTS so this migration is safe to run no matter what state the
-- remote database is currently in.

CREATE TABLE IF NOT EXISTS public.guest_documents (
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

DROP POLICY IF EXISTS "Producers and admins manage guest documents" ON public.guest_documents;
CREATE POLICY "Producers and admins manage guest documents"
ON public.guest_documents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_guest_documents_guest ON public.guest_documents (guest_id, hour_number);

CREATE TABLE IF NOT EXISTS public.guest_urls (
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

DROP POLICY IF EXISTS "Producers and admins manage guest urls" ON public.guest_urls;
CREATE POLICY "Producers and admins manage guest urls"
ON public.guest_urls FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_guest_urls_guest ON public.guest_urls (guest_id, hour_number);

-- Historical libreto content, chunked for full-text search (used by
-- src/components/HistoricalSearchDialog.tsx via the buscar_invitado RPC below).
CREATE TABLE IF NOT EXISTS public.libretos_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text,
  guest_role text,
  year integer,
  day_of_week text,
  hour_number integer,
  content text NOT NULL,
  source_file text,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED
);

CREATE INDEX IF NOT EXISTS idx_libretos_chunks_fts ON public.libretos_chunks USING GIN (fts);

GRANT SELECT ON public.libretos_chunks TO authenticated;
GRANT ALL ON public.libretos_chunks TO service_role;

ALTER TABLE public.libretos_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read libretos_chunks" ON public.libretos_chunks;
CREATE POLICY "Authenticated users can read libretos_chunks"
ON public.libretos_chunks FOR SELECT TO authenticated
USING (true);

-- Full-text search RPC: supabase.rpc("buscar_invitado", { query_text, max_results })
CREATE OR REPLACE FUNCTION public.buscar_invitado(query_text text, max_results integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  guest_name text,
  guest_role text,
  year integer,
  day_of_week text,
  hour_number integer,
  content text,
  source_file text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lc.id,
    lc.guest_name,
    lc.guest_role,
    lc.year,
    lc.day_of_week,
    lc.hour_number,
    lc.content,
    lc.source_file,
    ts_rank(lc.fts, websearch_to_tsquery('spanish', query_text)) AS rank
  FROM public.libretos_chunks lc
  WHERE lc.fts @@ websearch_to_tsquery('spanish', query_text)
  ORDER BY rank DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_invitado(text, integer) TO authenticated;
