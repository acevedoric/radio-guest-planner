-- FASE G: un guest enlazado (invitados_historicos.guest_id) debe
-- encontrarse también buscando por el nombre que trae su propia fila del
-- histórico, aunque ese nombre no coincida con guests.name (p.ej. "Ezequiel
-- Peralta" solo matcheaba la fila histórica "Ezequiel López Peralta" y el
-- guion, pero no mostraba al guest "Ezequiel López" enlazado con "+
-- histórico" porque su nombre de agenda no contiene "peralta"). Se agrega
-- una CTE que, para cada fila de histórico que matcheó la búsqueda Y tiene
-- guest_id, también trae la fila del guest enlazado (misma prioridad que
-- el match exacto de histórico) — el frontend ya sabe deduplicar/etiquetar
-- "+ histórico" cuando ambas filas (guest y su histórico) aparecen juntas.

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
  historico_match AS (
    SELECT
      ih.id, ih.guest_name AS name, ih.tema AS topic, ih.hour_number, ih.fecha, ih.guest_id,
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
  -- Fila de histórico que matcheó la búsqueda Y está enlazada a un guest:
  -- también se trae la fila del guest (aunque su nombre de agenda NO
  -- contenga los términos buscados), para que el frontend la muestre con
  -- "+ histórico" en vez de solo el fragmento de guion.
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
    WHERE hm.guest_id IS NOT NULL
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
