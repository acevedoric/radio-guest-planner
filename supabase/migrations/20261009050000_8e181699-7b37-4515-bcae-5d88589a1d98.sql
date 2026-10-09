-- FASE E (buscador):
-- 1) buscar_invitados_rank: day_of_week ahora se calcula en español con un
--    CASE sobre extract(dow from <fecha>) (no depende de lc_time del
--    servidor); se agrega invitados_historicos.cargo a la búsqueda por
--    cargo/tema del histórico (antes solo buscaba por nombre).
-- 2) contar_invitados(p_texto, p_desde, p_hasta): cuenta personas DISTINTAS
--    en guests + invitados_historicos que coincidan por cargo/tema/
--    ocupación (ILIKE + trigram, sin acentos). Deduplica usando guest_id
--    (los enlaces ya resueltos por ingest-libreto): si una fila de
--    invitados_historicos tiene guest_id, cuenta como esa misma persona de
--    guests, no aparte. SECURITY DEFINER, mismo gating que
--    buscar_invitados_rank (histórico solo producer/admin).

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
  snippet text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_norm text := lower(public.unaccent_immutable(query_text));
  q_tsq tsquery := websearch_to_tsquery('spanish', public.unaccent_immutable(query_text));
  q_tsq_plain tsquery := websearch_to_tsquery('spanish', query_text);
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
      MIN(t.tier_val) AS tier
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
      CASE WHEN ih.guest_name_normalized = q_norm THEN 6 ELSE 7 END AS tier
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
      8 AS tier, substring(lc.content FROM 1 FOR 200) AS snippet
    FROM public.libretos_chunks lc
    WHERE is_authed AND lc.fts @@ q_tsq_plain
  ),
  combined AS (
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet
    FROM tiered
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'historico'::text AS source, NULL::text AS snippet
    FROM historico
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'libreto'::text AS source, snippet
    FROM libreto
  )
  SELECT c.id, c.name, c.guest_position, c.topic, c.recording_status, c.day_of_week, c.time_slot,
         c.week_date, c.scheduled_date, c.tier, c.rank, c.source, c.snippet
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
    'app'::text AS source, NULL::text AS snippet
  FROM public.guests g
  WHERE similarity(lower(public.unaccent_immutable(g.name)), q_norm) >= 0.6
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_invitados_rank(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_rank(text, integer) TO anon, authenticated;

-- contar_invitados: para preguntas de cantidad ("¿cuántos chefs
-- invitamos en 2025?"). Coincide por cargo/tema/ocupación con ILIKE +
-- similitud de trigramas, sin acentos. Cada persona cuenta una sola vez:
-- si la fila de invitados_historicos tiene guest_id (enlace ya resuelto
-- por ingest-libreto), se usa ese guest_id como identidad en vez del id
-- propio de invitados_historicos, para no contarla dos veces si también
-- aparece en guests.
CREATE OR REPLACE FUNCTION public.contar_invitados(p_texto text, p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS TABLE (total integer, apariciones jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  SELECT
    (SELECT COUNT(DISTINCT f.canonical_id) FROM filtered f)::integer AS total,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', f.name, 'fecha', f.fecha) ORDER BY f.fecha), '[]'::jsonb) FROM filtered f) AS apariciones;
END;
$$;

REVOKE ALL ON FUNCTION public.contar_invitados(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_invitados(text, date, date) TO anon, authenticated;
