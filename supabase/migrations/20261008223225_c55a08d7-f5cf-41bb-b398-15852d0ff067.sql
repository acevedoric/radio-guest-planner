-- Extiende buscar_invitados_rank para buscar también en invitados_historicos
-- (nombre, cualquier usuario) y libretos_chunks (contenido, solo authenticated).
-- Cambia el shape de salida (agrega source/snippet), así que hay que DROP
-- primero: CREATE OR REPLACE no permite cambiar las columnas de retorno.

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
  is_authed boolean := auth.uid() IS NOT NULL;
  found integer;
BEGIN
  RETURN QUERY
  WITH tiered AS (
    SELECT
      g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
      g.day_of_week, g.time_slot, g.week_date, g.scheduled_date,
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
      NULL::text AS recording_status, ih.day_of_week, ih.hour_number AS time_slot,
      NULL::date AS week_date, ih.fecha AS scheduled_date,
      CASE WHEN ih.guest_name_normalized = q_norm THEN 6 ELSE 7 END AS tier
    FROM public.invitados_historicos ih
    WHERE ih.guest_name_normalized = q_norm
       OR ih.guest_name_normalized LIKE '%' || q_norm || '%'
  ),
  libreto AS (
    SELECT
      lc.id, lc.guest_name AS name, NULL::text AS guest_position, lc.source_file AS topic,
      NULL::text AS recording_status, lc.day_of_week, lc.hour_number AS time_slot,
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
    g.day_of_week, g.time_slot, g.week_date, g.scheduled_date,
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
