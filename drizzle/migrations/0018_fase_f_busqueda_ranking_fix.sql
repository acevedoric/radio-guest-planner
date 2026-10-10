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
  is_authed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  found integer;
BEGIN
  q_clean := trim(regexp_replace(q_clean, '\s+', ' ', 'g'));
  q_norm := lower(public.unaccent_immutable(q_clean));
  q_tsq := websearch_to_tsquery('spanish', public.unaccent_immutable(q_clean));
  q_tsq_plain := websearch_to_tsquery('spanish', q_clean);
  q_words := (SELECT array_agg(w) FROM unnest(regexp_split_to_array(trim(q_norm), '\s+')) AS w WHERE w <> '');

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
  historico AS (
    SELECT
      ih.id, ih.guest_name AS name, NULL::text AS guest_position, ih.tema AS topic,
      NULL::text AS recording_status,
      CASE extract(dow FROM ih.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      ih.hour_number AS time_slot,
      NULL::date AS week_date, ih.fecha AS scheduled_date,
      CASE WHEN ih.guest_name_normalized = q_norm THEN 6 ELSE 7 END AS tier,
      ih.guest_id AS guest_id
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
      8 AS tier, substring(lc.content FROM 1 FOR 200) AS snippet,
      NULL::uuid AS guest_id
    FROM public.libretos_chunks lc
    WHERE is_authed
      AND lc.fts @@ q_tsq_plain
      AND (
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR
        (SELECT bool_and(position(w IN lower(public.unaccent_immutable(lc.content))) > 0) FROM unnest(q_words) AS w)
      )
  ),
  combined AS (
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet, guest_id
    FROM tiered
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'historico'::text AS source, NULL::text AS snippet, guest_id
    FROM historico
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'libreto'::text AS source, snippet, guest_id
    FROM libreto
  )
  SELECT c.id, c.name, c.guest_position, c.topic, c.recording_status, c.day_of_week, c.time_slot,
         c.week_date, c.scheduled_date, c.tier, c.rank, c.source, c.snippet, c.guest_id
  FROM combined c
  ORDER BY c.tier ASC, c.name ASC
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
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  RETURN QUERY
  WITH g_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(g.name))) AS canonical_key,
      g.name,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha
    FROM public.guests g
    WHERE lower(public.unaccent_immutable(coalesce(g.position, ''))) LIKE '%' || q_norm || '%'
       OR lower(public.unaccent_immutable(coalesce(g.topic, ''))) LIKE '%' || q_norm || '%'
       OR similarity(lower(public.unaccent_immutable(coalesce(g.position, ''))), q_norm) >= 0.3
       OR similarity(lower(public.unaccent_immutable(coalesce(g.topic, ''))), q_norm) >= 0.3
  ),
  h_match AS (
    SELECT
      lower(trim(public.unaccent_immutable(ih.guest_name))) AS canonical_key,
      ih.guest_name AS name,
      ih.fecha
    FROM public.invitados_historicos ih
    WHERE is_privileged AND (
      lower(public.unaccent_immutable(coalesce(ih.cargo, ''))) LIKE '%' || q_norm || '%'
      OR lower(public.unaccent_immutable(coalesce(ih.tema, ''))) LIKE '%' || q_norm || '%'
      OR similarity(lower(public.unaccent_immutable(coalesce(ih.cargo, ''))), q_norm) >= 0.3
      OR similarity(lower(public.unaccent_immutable(coalesce(ih.tema, ''))), q_norm) >= 0.3
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
  )
  SELECT
    (array_agg(name ORDER BY fecha DESC))[1] AS nombre,
    COUNT(*)::integer AS apariciones,
    MODE() WITHIN GROUP (ORDER BY dia) AS dia_mas_frecuente,
    MODE() WITHIN GROUP (ORDER BY hora) AS hora_mas_frecuente
  FROM filtered
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
    SELECT DISTINCT ON (fecha, hora)
      name, fecha, hora, tema, fuente
    FROM filtered
    ORDER BY fecha, hora, (fuente = 'app') DESC
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

CREATE OR REPLACE FUNCTION public.invitados_por_fecha(p_fecha date, p_hora integer DEFAULT NULL)
RETURNS TABLE (nombre text, hora integer, cargo text, tema text, fuente text, snippet text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  dow_name text := CASE extract(dow FROM p_fecha)
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
    WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
  END;
BEGIN
  RETURN QUERY
  WITH g_rows AS (
    SELECT g.name AS nombre, g.time_slot AS hora, g.position AS cargo, g.topic AS tema, 'app'::text AS fuente
    FROM public.guests g
    WHERE COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
            WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) = p_fecha
      AND (p_hora IS NULL OR g.time_slot = p_hora)
  ),
  h_rows AS (
    SELECT ih.guest_name AS nombre, ih.hour_number AS hora, ih.cargo, ih.tema, 'historico'::text AS fuente
    FROM public.invitados_historicos ih
    WHERE is_privileged AND ih.fecha = p_fecha
      AND (p_hora IS NULL OR ih.hour_number = p_hora)
  ),
  combined AS (
    SELECT * FROM g_rows
    UNION ALL
    SELECT * FROM h_rows
  ),
  dedup AS (
    SELECT DISTINCT ON (lower(trim(public.unaccent_immutable(nombre))), hora)
      nombre, hora, cargo, tema, fuente
    FROM combined
    ORDER BY lower(trim(public.unaccent_immutable(nombre))), hora, (fuente = 'app') DESC
  )
  SELECT
    d.nombre, d.hora, d.cargo, d.tema, d.fuente,
    (SELECT substring(lc.content FROM 1 FOR 300) FROM public.libretos_chunks lc
      WHERE is_privileged AND lc.fecha = p_fecha AND lc.hour_number = d.hora
      ORDER BY lc.created_at, lc.id LIMIT 1) AS snippet
  FROM dedup d
  ORDER BY d.hora, d.nombre;
END;
$function$;

REVOKE ALL ON FUNCTION public.invitados_por_fecha(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitados_por_fecha(date, integer) TO anon, authenticated;