-- Reemplaza buscar_invitados_app (falló en Lovable: "position" es palabra
-- reservada en RETURNS TABLE) por buscar_invitados_rank, con la columna de
-- salida renombrada a guest_position y el orden de relevancia unificado que
-- usan tanto el buscador superior como "Buscar en libretos históricos":
--   a) nombre exacto (sin tildes/mayúsculas)
--   b) nombre que empieza con el término
--   c) nombre que contiene el término
--   d) coincidencia en cargo o tema
--   e) coincidencia en campos de investigación
--   f) similitud aproximada (trigram, umbral alto) solo si a-e no dan resultados
-- Incluye invitados de todas las fechas (no solo la semana visible).

DROP FUNCTION IF EXISTS public.buscar_invitados_app(text, integer);

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
        (CASE WHEN to_tsvector('spanish', public.unaccent_immutable(
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

  -- Nadie coincidió por nombre/cargo/tema/investigación: fallback por similitud
  -- de nombre (trigram), con umbral alto para evitar falsos positivos.
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