-- Ajustes de privacidad de la lista negra:
-- 1) blacklist_rules deja de ser legible por anon.
-- 2) check_blacklist() solo revela el motivo a producer/admin; el resto de
--    usuarios autenticados solo sabe que hay coincidencia (sin motivo/categoría).

DROP POLICY IF EXISTS "Anyone can read blacklist rules" ON public.blacklist_rules;
REVOKE SELECT ON public.blacklist_rules FROM anon;

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
    CASE
      WHEN has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
      THEN b.reason
      ELSE NULL
    END AS reason,
    CASE WHEN b.name_normalized = q.norm THEN 'exact' ELSE 'approximate' END AS match_type,
    similarity(b.name_normalized, q.norm) AS similarity
  FROM public.blacklist b, q
  WHERE b.name_normalized = q.norm
     OR similarity(b.name_normalized, q.norm) >= 0.45
  ORDER BY (b.name_normalized = q.norm) DESC, similarity DESC
  LIMIT 10;
$$;
