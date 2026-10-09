-- FASE E (ronda 2):
-- 1) buscar_invitados_rank: la búsqueda en libretos_chunks ahora exige que
--    TODOS los términos de la consulta aparezcan en el chunk (AND, sin
--    acentos) antes de rankear — fts@@tsquery se mantiene como filtro
--    rápido por índice GIN, el AND explícito elimina falsos positivos por
--    coincidencia de palabras sueltas en chunks largos sin relación entre
--    sí (p.ej. "miguel gonzalez" encontrando a alguien llamado Miguel Y a
--    alguien apellidado González en personas distintas del mismo chunk).
--    También expone guest_id en las filas de histórico (para deduplicar
--    con Agenda en el front) y conserva "#variable_conflict use_column"
--    (regla fija: toda versión futura de esta función debe conservarla).
-- 2) contar_invitados: ahora el total SIEMPRE es igual a la cantidad de
--    elementos de "apariciones" (una fila por persona, con el array de
--    fechas en que apareció) — antes "apariciones" tenía una fila por
--    coincidencia (una persona con 2 apariciones salía 2 veces), lo que
--    hacía que el conteo y la lista mostrada por el agente no cuadraran.
-- 3) ranking_invitados(p_desde, p_hasta, p_limite): personas con más
--    apariciones en el rango (guests + histórico, deduplicadas por
--    guest_id), con su día y hora más frecuentes. Mismo gating que
--    contar_invitados, SECURITY DEFINER, "#variable_conflict use_column".

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
  q_norm text := lower(public.unaccent_immutable(query_text));
  q_tsq tsquery := websearch_to_tsquery('spanish', public.unaccent_immutable(query_text));
  q_tsq_plain tsquery := websearch_to_tsquery('spanish', query_text);
  q_words text[] := (SELECT array_agg(w) FROM unnest(regexp_split_to_array(trim(q_norm), '\s+')) AS w WHERE w <> '');
  is_authed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  found integer;
BEGIN
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

  -- Nadie coincidió en ninguna fuente: fallback por similitud de nombre
  -- (trigram) sobre guests, umbral alto. No se extiende a historico/libreto.
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
  ORDER BY rank DESC
  LIMIT max_results;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_invitados_rank(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_rank(text, integer) TO anon, authenticated;

-- contar_invitados: una fila por persona (no por aparición) — total ==
-- jsonb_array_length(apariciones) siempre, para que el agente no pueda
-- confundir "cuántas apariciones" con "cuántas personas distintas".
CREATE OR REPLACE FUNCTION public.contar_invitados(p_texto text, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS TABLE (total integer, apariciones jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  q_norm text := lower(public.unaccent_immutable(p_texto));
  is_privileged boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  RETURN QUERY
  WITH g_match AS (
    SELECT
      g.id AS canonical_id,
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
      COALESCE(ih.guest_id, ih.id) AS canonical_id,
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
    SELECT DISTINCT canonical_id, name, fecha
    FROM combined
    WHERE (p_desde IS NULL OR fecha >= p_desde)
      AND (p_hasta IS NULL OR fecha <= p_hasta)
  ),
  per_person AS (
    SELECT
      canonical_id,
      (array_agg(name ORDER BY fecha))[1] AS nombre,
      array_agg(DISTINCT fecha ORDER BY fecha) AS fechas
    FROM filtered
    GROUP BY canonical_id
  )
  SELECT
    (SELECT COUNT(*) FROM per_person)::integer AS total,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', nombre, 'fechas', fechas) ORDER BY nombre), '[]'::jsonb) FROM per_person) AS apariciones;
END;
$function$;

REVOKE ALL ON FUNCTION public.contar_invitados(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_invitados(text, date, date) TO anon, authenticated;

-- ranking_invitados: personas con más apariciones en el rango (guests +
-- histórico, dedup por guest_id), con su día y hora más frecuentes.
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
      g.id AS canonical_id,
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
      COALESCE(ih.guest_id, ih.id) AS canonical_id,
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
  GROUP BY canonical_id
  ORDER BY apariciones DESC, nombre ASC
  LIMIT p_limite;
END;
$function$;

REVOKE ALL ON FUNCTION public.ranking_invitados(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_invitados(date, date, integer) TO anon, authenticated;
