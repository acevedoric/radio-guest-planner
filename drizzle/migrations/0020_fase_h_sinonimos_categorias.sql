DROP FUNCTION IF EXISTS public.contar_invitados(text, date, date);

CREATE OR REPLACE FUNCTION public.contar_invitados(p_texto text, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS TABLE (total integer, apariciones jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  p_texto_clean text := trim(regexp_replace(regexp_replace(p_texto, E'[«»“”‘’"''¿?¡!.,;:()\\[\\]{}]', ' ', 'g'), '\s+', ' ', 'g'));
  q_norm text := lower(public.unaccent_immutable(p_texto_clean));
  syn_cargo text[];
  syn_tema text[];
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF q_norm IN ('chef', 'chefs', 'cocinero', 'cocinera', 'cocineros', 'cocineras') THEN
    syn_tema := ARRAY['chef','cocinero','cocinera','gastronomico','gastronomica','gastronomia',
      'pastelero','pastelera','repostero','repostera','panadero','panadera','sommelier','barista',
      'influencer gastronomico'];
    syn_cargo := syn_tema || ARRAY['cocina'];
  ELSIF q_norm IN ('actor', 'actriz', 'actores', 'actrices') THEN
    syn_cargo := ARRAY['actor','actriz','actores','actuacion','protagonista','elenco','interprete'];
    syn_tema := syn_cargo;
  ELSIF q_norm IN ('cantante', 'cantantes') THEN
    syn_cargo := ARRAY['cantante','cantautor','cantautora','artista musical','interprete musical',
      'vocalista','banda','agrupacion','orquesta','duo','rapero','rapera','reguetonero','reguetonera'];
    syn_tema := syn_cargo;
  ELSIF q_norm IN ('comediante', 'comediantes') THEN
    syn_cargo := ARRAY['comediante','humorista','stand up','standupero','standupera','comico','comica',
      'imitador','imitadora'];
    syn_tema := syn_cargo;
  ELSIF q_norm IN ('periodista', 'periodistas') THEN
    syn_cargo := ARRAY['periodista','presentador','presentadora','locutor','locutora','reportero',
      'reportera','comunicador','comunicadora'];
    syn_tema := syn_cargo;
  ELSE
    syn_cargo := ARRAY[q_norm];
    syn_tema := ARRAY[q_norm];
  END IF;

  RETURN QUERY
  WITH g_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(g.name))) AS canonical_key,
      g.name,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha
    FROM public.guests g
    WHERE EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE lower(public.unaccent_immutable(coalesce(g.position, ''))) LIKE '%' || s || '%')
       OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE lower(public.unaccent_immutable(coalesce(g.topic, ''))) LIKE '%' || s || '%')
       OR EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE similarity(lower(public.unaccent_immutable(coalesce(g.position, ''))), s) >= 0.3)
       OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE similarity(lower(public.unaccent_immutable(coalesce(g.topic, ''))), s) >= 0.3)
  ),
  h_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(ih.guest_name))) AS canonical_key,
      ih.guest_name AS name,
      ih.fecha
    FROM public.invitados_historicos ih
    WHERE is_privileged AND (
      EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) LIKE '%' || s || '%')
      OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE lower(public.unaccent_immutable(coalesce(ih.tema, ''))) LIKE '%' || s || '%')
      OR EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE similarity(lower(public.unaccent_immutable(coalesce(ih.cargo, ''))), s) >= 0.3)
      OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE similarity(lower(public.unaccent_immutable(coalesce(ih.tema, ''))), s) >= 0.3)
    )
  ),
  combined AS (
    SELECT * FROM g_match
    UNION ALL
    SELECT * FROM h_match
  ),
  filtered AS (
    SELECT DISTINCT canonical_key, name, fecha
    FROM combined
    WHERE (p_desde IS NULL OR fecha >= p_desde)
      AND (p_hasta IS NULL OR fecha <= p_hasta)
  ),
  per_person AS (
    SELECT
      canonical_key,
      (array_agg(name ORDER BY fecha))[1] AS nombre,
      array_agg(DISTINCT fecha ORDER BY fecha) AS fechas
    FROM filtered
    GROUP BY canonical_key
  )
  SELECT
    (SELECT COUNT(*) FROM per_person)::integer AS total,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', nombre, 'fechas', fechas) ORDER BY nombre), '[]'::jsonb) FROM per_person) AS apariciones;
END;
$function$;

REVOKE ALL ON FUNCTION public.contar_invitados(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_invitados(text, date, date) TO anon, authenticated;