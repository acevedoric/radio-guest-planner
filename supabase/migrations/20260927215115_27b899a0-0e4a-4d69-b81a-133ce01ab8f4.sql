CREATE TABLE IF NOT EXISTS public.libretos_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_role text,
  year integer,
  day_of_week text,
  hour_number integer,
  content text NOT NULL,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED
);

GRANT SELECT ON public.libretos_chunks TO authenticated;
GRANT ALL ON public.libretos_chunks TO service_role;

CREATE INDEX IF NOT EXISTS idx_libretos_chunks_fts ON public.libretos_chunks USING GIN(fts);

ALTER TABLE public.libretos_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read libretos chunks" ON public.libretos_chunks;
CREATE POLICY "Authenticated can read libretos chunks"
  ON public.libretos_chunks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.buscar_invitado(query_text text, max_results int DEFAULT 10)
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

REVOKE ALL ON FUNCTION public.buscar_invitado(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitado(text, int) TO authenticated;