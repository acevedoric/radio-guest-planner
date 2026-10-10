-- FASE I (20261011000000): dedup, sinónimos, cruces. Copia verbatim de supabase/migrations/20261011000000_fase_i_dedup_sinonimos_cruces.sql
-- #variable_conflict use_column se conserva en las 4 funciones.

DROP FUNCTION IF EXISTS public.buscar_invitados_rank(text, integer);

CREATE OR REPLACE FUNCTION public.buscar_invitados_rank(query_text text, max_results integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  guest_position text,
  topic text,
  recording_status text,
  day_of_week text,
  time_slot integer,
  week_date date,
  scheduled_date date,
  tier integer,
  rank real,
  source text,
  snippet text,
  guest_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  q_clean text := regexp_replace(query_text, E'[«»“”‘’"''¿?¡!.,;:()\\[\\]{}]', ' ', 'g');
  q_norm text;
  q_tsq tsquery;
  q_tsq_plain tsquery;
  q_words text[];
  q_phrase text;
  is_authed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  found integer;
BEGIN
  q_clean := trim(regexp_replace(q_clean, '\s+', ' ', 'g'));
  q_norm := lower(public.unaccent_immutable(q_clean));
  q_tsq := websearch_to_tsquery('spanish', public.unaccent_immutable(q_clean));
  q_tsq_plain := websearch_to_tsquery('spanish', q_clean);
  q_words := (SELECT array_agg(w) FROM unnest(regexp_split_to_array(trim(q_norm), '\s+')) AS w WHERE w <> '');
  q_phrase := array_to_string(q_words, ' ');

  RETURN QUERY
  WITH tiered AS (
    SELECT
      g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
      CASE extract(dow FROM COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
             WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END))
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      g.time_slot, g.week_date, g.scheduled_date,
      MIN(t.tier_val) AS tier,
      NULL::uuid AS guest_id
    FROM public.guests g
    CROSS JOIN LATERAL (
      VALUES
        (CASE WHEN lower(public.unaccent_immutable(g.name)) = q_norm THEN 1 END),
        (CASE WHEN lower(public.unaccent_immutable(g.name)) LIKE q_norm || '%' THEN 2 END),
        (CASE WHEN lower(public.unaccent_immutable(g.name)) LIKE '%' || q_norm || '%' THEN 3 END),
        (CASE WHEN to_tsvector('spanish', public.unaccent_immutable(
            coalesce(g.position, '') || ' ' || coalesce(g.topic, '')
          )) @@ q_tsq THEN 4 END),
        (CASE WHEN is_authed AND to_tsvector('spanish', public.unaccent_immutable(
            coalesce(g.tema_principal, '') || ' ' || coalesce(g.infancia_vida_privada, '') || ' ' ||
            coalesce(g.carrera_profesional, '') || ' ' || coalesce(g.datos_curiosos, '') || ' ' ||
            coalesce(g.h2_info_personal, '') || ' ' || coalesce(g.h2_preguntas_sugeridas, '') || ' ' ||
            coalesce(g.h3_datos_personales, '') || ' ' || coalesce(g.h3_comunicado_prensa, '')
          )) @@ q_tsq THEN 5 END)
    ) AS t(tier_val)
    WHERE t.tier_val IS NOT NULL
      AND (
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR
        (SELECT bool_and(position(w IN lower(public.unaccent_immutable(
            coalesce(g.name, '') || ' ' || coalesce(g.position, '') || ' ' || coalesce(g.topic, '')
          ))) > 0) FROM unnest(q_words) AS w)
      )
    GROUP BY g.id, g.name, g.position, g.topic, g.recording_status,
             g.day_of_week, g.time_slot, g.week_date, g.scheduled_date
  ),
  historico_match AS (
    SELECT
      ih.id, ih.guest_name AS name, ih.tema AS topic, ih.hour_number, ih.fecha, ih.guest_id,
      (
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR
        (SELECT bool_and(position(w IN lower(public.unaccent_immutable(ih.guest_name))) > 0) FROM unnest(q_words) AS w)
      ) AS name_matched,
      CASE WHEN ih.guest_name_normalized = q_norm THEN 6 ELSE 7 END AS tier
    FROM public.invitados_historicos ih
    WHERE is_authed AND (
      ih.guest_name_normalized = q_norm
      OR ih.guest_name_normalized LIKE '%' || q_norm || '%'
      OR to_tsvector('spanish', public.unaccent_immutable(coalesce(ih.cargo, '') || ' ' || coalesce(ih.tema, ''))) @@ q_tsq
    )
    AND (
      q_words IS NULL OR array_length(q_words, 1) IS NULL OR
      (SELECT bool_and(position(w IN lower(public.unaccent_immutable(
          coalesce(ih.guest_name, '') || ' ' || coalesce(ih.cargo, '') || ' ' || coalesce(ih.tema, '')
        ))) > 0) FROM unnest(q_words) AS w)
    )
  ),
  historico AS (
    SELECT
      hm.id, hm.name, NULL::text AS guest_position, hm.topic,
      NULL::text AS recording_status,
      CASE extract(dow FROM hm.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      hm.hour_number AS time_slot,
      NULL::date AS week_date, hm.fecha AS scheduled_date,
      hm.tier,
      hm.guest_id
    FROM historico_match hm
  ),
  linked_app AS (
    SELECT DISTINCT
      g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
      CASE extract(dow FROM COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
             WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END))
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      g.time_slot, g.week_date, g.scheduled_date,
      6 AS tier,
      NULL::uuid AS guest_id
    FROM historico_match hm
    JOIN public.guests g ON g.id = hm.guest_id
    WHERE hm.guest_id IS NOT NULL AND hm.name_matched
  ),
  libreto AS (
    SELECT
      lc.id, lc.guest_name AS name, NULL::text AS guest_position, lc.source_file AS topic,
      NULL::text AS recording_status,
      CASE extract(dow FROM lc.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      lc.hour_number AS time_slot,
      NULL::date AS week_date, lc.fecha AS scheduled_date,
      CASE
        WHEN q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2 THEN 8
        WHEN regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%' THEN 8
        ELSE 10
      END AS tier,
      substring(lc.content FROM 1 FOR 200) AS snippet,
      NULL::uuid AS guest_id
    FROM public.libretos_chunks lc
    WHERE is_authed
      AND lc.fts @@ q_tsq_plain
      AND (
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2
        OR regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%'
        OR (SELECT bool_and(position(w IN lower(public.unaccent_immutable(lc.content))) > 0) FROM unnest(q_words) AS w)
      )
  ),
  combined AS (
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet, guest_id
    FROM tiered
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet, guest_id
    FROM linked_app
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'historico'::text AS source, NULL::text AS snippet, guest_id
    FROM historico
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'libreto'::text AS source, snippet, guest_id
    FROM libreto
  ),
  deduped AS (
    SELECT DISTINCT ON (source, id)
      id, name, guest_position, topic, recording_status, day_of_week, time_slot,
      week_date, scheduled_date, tier, rank, source, snippet, guest_id
    FROM combined
    ORDER BY source, id, tier ASC
  )
  SELECT d.id, d.name, d.guest_position, d.topic, d.recording_status, d.day_of_week, d.time_slot,
         d.week_date, d.scheduled_date, d.tier, d.rank, d.source, d.snippet, d.guest_id
  FROM deduped d
  ORDER BY d.tier ASC, d.name ASC
  LIMIT max_results;

  GET DIAGNOSTICS found = ROW_COUNT;
  IF found > 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
    CASE extract(dow FROM COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
           WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END))
      WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
      WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
    END AS day_of_week,
    g.time_slot, g.week_date, g.scheduled_date,
    9 AS tier,
    similarity(lower(public.unaccent_immutable(g.name)), q_norm) AS rank,
    'app'::text AS source, NULL::text AS snippet, NULL::uuid AS guest_id
  FROM public.guests g
  WHERE similarity(lower(public.unaccent_immutable(g.name)), q_norm) >= 0.6
    AND (
      q_words IS NULL OR array_length(q_words, 1) IS NULL OR
      (SELECT bool_and(position(w IN lower(public.unaccent_immutable(g.name))) > 0) FROM unnest(q_words) AS w)
    )
  ORDER BY rank DESC
  LIMIT max_results;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_invitados_rank(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_rank(text, integer) TO anon, authenticated;

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
  is_category boolean;
  syn_cargo text[];
  syn_tema text[];
  core_cocina text[];
  weak_cocina text[];
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  is_category := true;
  IF q_norm IN ('chef', 'chefs', 'cocinero', 'cocinera', 'cocineros', 'cocineras') THEN
    core_cocina := ARRAY['chef','cocinero','cocinera','gastronomico','gastronomica',
      'pastelero','pastelera','repostero','repostera','panadero','panadera'];
    weak_cocina := ARRAY['gastronomia'];
    syn_cargo := core_cocina || ARRAY['cocina'];
    syn_tema := core_cocina;
  ELSIF q_norm IN ('actor', 'actriz', 'actores', 'actrices') THEN
    syn_cargo := ARRAY['actor','actriz','actores','actuacion','protagonista','elenco','interprete'];
    syn_tema := syn_cargo;
    core_cocina := NULL; weak_cocina := NULL;
  ELSIF q_norm IN ('cantante', 'cantantes') THEN
    syn_cargo := ARRAY['cantante','cantautor','cantautora','artista musical','interprete musical',
      'vocalista','banda','agrupacion','orquesta','duo','rapero','rapera','reguetonero','reguetonera'];
    syn_tema := syn_cargo;
    core_cocina := NULL; weak_cocina := NULL;
  ELSIF q_norm IN ('comediante', 'comediantes') THEN
    syn_cargo := ARRAY['comediante','humorista','stand up','standupero','standupera','comico','comica',
      'imitador','imitadora'];
    syn_tema := syn_cargo;
    core_cocina := NULL; weak_cocina := NULL;
  ELSIF q_norm IN ('periodista', 'periodistas') THEN
    syn_cargo := ARRAY['periodista','presentador','presentadora','locutor','locutora','reportero',
      'reportera','comunicador','comunicadora'];
    syn_tema := syn_cargo;
    core_cocina := NULL; weak_cocina := NULL;
  ELSE
    is_category := false;
    syn_cargo := ARRAY[q_norm];
    syn_tema := ARRAY[q_norm];
  END IF;

  RETURN QUERY
  WITH g_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(g.name))) AS canonical_key,
      g.name,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha,
      g.time_slot AS hora
    FROM public.guests g
    WHERE CASE WHEN is_category THEN
        EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE lower(public.unaccent_immutable(coalesce(g.position, ''))) ~ ('\y' || s || 's?\y'))
        OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE lower(public.unaccent_immutable(coalesce(g.topic, ''))) ~ ('\y' || s || 's?\y'))
        OR (weak_cocina IS NOT NULL AND
            EXISTS (SELECT 1 FROM unnest(weak_cocina) s WHERE lower(public.unaccent_immutable(coalesce(g.position, ''))) ~ ('\y' || s || 's?\y'))
            AND EXISTS (SELECT 1 FROM unnest(core_cocina || ARRAY['cocina']) s WHERE lower(public.unaccent_immutable(coalesce(g.position, ''))) ~ ('\y' || s || 's?\y')))
      ELSE
        lower(public.unaccent_immutable(coalesce(g.position, ''))) LIKE '%' || q_norm || '%'
        OR lower(public.unaccent_immutable(coalesce(g.topic, ''))) LIKE '%' || q_norm || '%'
        OR similarity(lower(public.unaccent_immutable(coalesce(g.position, ''))), q_norm) >= 0.3
        OR similarity(lower(public.unaccent_immutable(coalesce(g.topic, ''))), q_norm) >= 0.3
      END
  ),
  h_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(ih.guest_name))) AS canonical_key,
      ih.guest_name AS name,
      ih.fecha,
      ih.hour_number AS hora
    FROM public.invitados_historicos ih
    WHERE is_privileged AND (
      CASE WHEN is_category THEN
        EXISTS (SELECT 1 FROM unnest(syn_cargo) s WHERE lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) ~ ('\y' || s || 's?\y'))
        OR EXISTS (SELECT 1 FROM unnest(syn_tema) s WHERE lower(public.unaccent_immutable(coalesce(ih.tema, ''))) ~ ('\y' || s || 's?\y'))
        OR (weak_cocina IS NOT NULL AND
            EXISTS (SELECT 1 FROM unnest(weak_cocina) s WHERE lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) ~ ('\y' || s || 's?\y'))
            AND EXISTS (SELECT 1 FROM unnest(core_cocina || ARRAY['cocina']) s WHERE lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) ~ ('\y' || s || 's?\y')))
      ELSE
        lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) LIKE '%' || q_norm || '%'
        OR lower(public.unaccent_immutable(coalesce(ih.tema, ''))) LIKE '%' || q_norm || '%'
        OR similarity(lower(public.unaccent_immutable(coalesce(ih.cargo, ''))), q_norm) >= 0.3
        OR similarity(lower(public.unaccent_immutable(coalesce(ih.tema, ''))), q_norm) >= 0.3
      END
    )
  ),
  combined AS (
    SELECT * FROM g_match
    UNION ALL
    SELECT * FROM h_match
  ),
  filtered AS (
    SELECT DISTINCT canonical_key, name, fecha, hora
    FROM combined
    WHERE (p_desde IS NULL OR fecha >= p_desde)
      AND (p_hasta IS NULL OR fecha <= p_hasta)
  ),
  dedup AS (
    SELECT DISTINCT ON (canonical_key, fecha, hora)
      canonical_key, name, fecha
    FROM filtered
    ORDER BY canonical_key, fecha, hora
  ),
  per_person AS (
    SELECT
      canonical_key,
      (array_agg(name ORDER BY fecha))[1] AS nombre,
      array_agg(DISTINCT fecha ORDER BY fecha) AS fechas
    FROM dedup
    GROUP BY canonical_key
  )
  SELECT
    (SELECT COUNT(*) FROM per_person)::integer AS total,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', nombre, 'fechas', fechas) ORDER BY nombre), '[]'::jsonb) FROM per_person) AS apariciones;
END;
$function$;

REVOKE ALL ON FUNCTION public.contar_invitados(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_invitados(text, date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ranking_invitados(p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL, p_limite integer DEFAULT 10)
RETURNS TABLE (nombre text, apariciones integer, dia_mas_frecuente text, hora_mas_frecuente integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  RETURN QUERY
  WITH g_rows AS (
    SELECT
      lower(trim(public.unaccent_immutable(g.name))) AS canonical_key,
      g.name,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha,
      CASE extract(dow FROM COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
             WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END))
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS dia,
      g.time_slot AS hora
    FROM public.guests g
    WHERE g.week_date IS NOT NULL OR g.scheduled_date IS NOT NULL
  ),
  h_rows AS (
    SELECT
      lower(trim(public.unaccent_immutable(ih.guest_name))) AS canonical_key,
      ih.guest_name AS name,
      ih.fecha,
      CASE extract(dow FROM ih.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS dia,
      ih.hour_number AS hora
    FROM public.invitados_historicos ih
    WHERE is_privileged
  ),
  combined AS (
    SELECT * FROM g_rows
    UNION ALL
    SELECT * FROM h_rows
  ),
  filtered AS (
    SELECT * FROM combined
    WHERE (p_desde IS NULL OR fecha >= p_desde)
      AND (p_hasta IS NULL OR fecha <= p_hasta)
      AND fecha IS NOT NULL
  ),
  dedup AS (
    SELECT DISTINCT ON (canonical_key, fecha, hora)
      canonical_key, name, fecha, dia, hora
    FROM filtered
    ORDER BY canonical_key, fecha, hora
  )
  SELECT
    (array_agg(name ORDER BY fecha DESC))[1] AS nombre,
    COUNT(*)::integer AS apariciones,
    MODE() WITHIN GROUP (ORDER BY dia) AS dia_mas_frecuente,
    MODE() WITHIN GROUP (ORDER BY hora) AS hora_mas_frecuente
  FROM dedup
  GROUP BY canonical_key
  ORDER BY apariciones DESC, nombre ASC
  LIMIT p_limite;
END;
$function$;

REVOKE ALL ON FUNCTION public.ranking_invitados(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_invitados(date, date, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apariciones_invitado(p_nombre text, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS TABLE (nombre text, fecha date, dia text, hora integer, tema text, fuente text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  p_nombre_clean text := trim(regexp_replace(regexp_replace(p_nombre, E'[«»“”‘’"''¿?¡!.,;:()\\[\\]{}]', ' ', 'g'), '\s+', ' ', 'g'));
  q_norm text := lower(public.unaccent_immutable(p_nombre_clean));
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  RETURN QUERY
  WITH g_rows AS (
    SELECT
      lower(trim(public.unaccent_immutable(g.name))) AS canonical_key,
      g.name,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha,
      g.time_slot AS hora,
      g.topic AS tema,
      'app'::text AS fuente
    FROM public.guests g
    WHERE lower(public.unaccent_immutable(g.name)) = q_norm
       OR lower(public.unaccent_immutable(g.name)) LIKE '%' || q_norm || '%'
       OR q_norm LIKE '%' || lower(public.unaccent_immutable(g.name)) || '%'
       OR similarity(lower(public.unaccent_immutable(g.name)), q_norm) >= 0.6
  ),
  h_rows AS (
    SELECT
      lower(trim(public.unaccent_immutable(ih.guest_name))) AS canonical_key,
      ih.guest_name AS name,
      ih.fecha,
      ih.hour_number AS hora,
      ih.tema,
      'historico'::text AS fuente
    FROM public.invitados_historicos ih
    WHERE is_privileged AND (
      ih.guest_name_normalized = q_norm
      OR ih.guest_name_normalized LIKE '%' || q_norm || '%'
      OR q_norm LIKE '%' || ih.guest_name_normalized || '%'
      OR similarity(ih.guest_name_normalized, q_norm) >= 0.6
    )
  ),
  combined AS (
    SELECT * FROM g_rows WHERE fecha IS NOT NULL
    UNION ALL
    SELECT * FROM h_rows WHERE fecha IS NOT NULL
  ),
  filtered AS (
    SELECT * FROM combined
    WHERE (p_desde IS NULL OR fecha >= p_desde)
      AND (p_hasta IS NULL OR fecha <= p_hasta)
  ),
  dedup AS (
    SELECT DISTINCT ON (canonical_key, fecha, hora)
      name, fecha, hora, tema, fuente
    FROM filtered
    ORDER BY canonical_key, fecha, hora, (fuente = 'app') DESC
  )
  SELECT
    d.name AS nombre,
    d.fecha,
    CASE extract(dow FROM d.fecha)
      WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
      WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
    END AS dia,
    d.hora,
    d.tema,
    d.fuente
  FROM dedup d
  ORDER BY d.fecha DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.apariciones_invitado(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apariciones_invitado(text, date, date) TO anon, authenticated;