-- Lista negra de invitados: tabla, normalización tolerante a tildes/errores,
-- búsqueda por similitud (trigram) y columnas de auditoría para el "forzado" admin.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() es STABLE (depende del diccionario), no IMMUTABLE, así que no se
-- puede usar directamente en una columna generada. Este wrapper con
-- search_path fijo es el workaround estándar de Postgres para ese caso.
CREATE OR REPLACE FUNCTION public.unaccent_immutable(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

CREATE TABLE IF NOT EXISTS public.blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(public.unaccent_immutable(name))) STORED,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blacklist TO authenticated;
GRANT ALL ON public.blacklist TO service_role;
-- Nada para anon: ni GRANT ni policy.

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producers and admins manage blacklist" ON public.blacklist;
CREATE POLICY "Producers and admins manage blacklist"
ON public.blacklist FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_blacklist_name_trgm ON public.blacklist USING GIN (name_normalized gin_trgm_ops);

-- Evita duplicados exactos (incluida la importación histórica, vía ON CONFLICT).
CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_name_normalized_unique ON public.blacklist (name_normalized);

-- Auditoría de "forzado" por admin pese a coincidencia con la lista negra.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS blacklist_override_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS blacklist_override_at timestamptz;

-- No se otorgan a anon: guests_anon y los GRANT por columna no las incluyen.

-- Búsqueda de coincidencias exactas y aproximadas (tolerante a tildes y errores menores).
CREATE OR REPLACE FUNCTION public.check_blacklist(p_name text)
RETURNS TABLE (
  id uuid,
  name text,
  reason text,
  match_type text,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(public.unaccent_immutable(p_name)) AS norm
  )
  SELECT
    b.id,
    b.name,
    b.reason,
    CASE WHEN b.name_normalized = q.norm THEN 'exact' ELSE 'approximate' END AS match_type,
    similarity(b.name_normalized, q.norm) AS similarity
  FROM public.blacklist b, q
  WHERE b.name_normalized = q.norm
     OR similarity(b.name_normalized, q.norm) >= 0.45
  ORDER BY (b.name_normalized = q.norm) DESC, similarity DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.check_blacklist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_blacklist(text) TO authenticated;