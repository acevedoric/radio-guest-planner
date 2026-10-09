-- Restringe buscar_invitados_rank para usuarios no autenticados (auth.uid()
-- IS NULL): solo niveles a-d (nombre exacto/empieza-con/contiene, cargo o
-- tema). El nivel e (campos de investigación) y cualquier fallback trigram
-- sobre esos campos quedan reservados a usuarios autenticados. El fallback
-- trigram por nombre (nivel f) sigue disponible para ambos, ya que es parte
-- de la familia de coincidencia por nombre (a-c), no de investigación.

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
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_norm text := lower(public.unaccent_immutable(query_text));
  q_tsq tsquery := websearch_to_tsquery('spanish', public.unaccent_immutable(query_text));
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
  )
  SELECT
    tiered.id, tiered.name, tiered.guest_position, tiered.topic, tiered.recording_status,
    tiered.day_of_week, tiered.time_slot, tiered.week_date, tiered.scheduled_date,
    tiered.tier, 0::real AS rank
  FROM tiered
  ORDER BY tiered.tier ASC, tiered.name ASC
  LIMIT max_results;

  GET DIAGNOSTICS found = ROW_COUNT;
  IF found > 0 THEN
    RETURN;
  END IF;

  -- Nadie coincidió por nombre/cargo/tema (ni investigación si está
  -- autenticado): fallback por similitud de nombre (trigram), umbral alto.
  -- Disponible para ambos, porque es parte de la familia de nombre (a-c).
  RETURN QUERY
  SELECT
    g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
    g.day_of_week, g.time_slot, g.week_date, g.scheduled_date,
    6 AS tier,
    similarity(lower(public.unaccent_immutable(g.name)), q_norm) AS rank
  FROM public.guests g
  WHERE similarity(lower(public.unaccent_immutable(g.name)), q_norm) >= 0.6
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_invitados_rank(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_rank(text, integer) TO anon, authenticated;
