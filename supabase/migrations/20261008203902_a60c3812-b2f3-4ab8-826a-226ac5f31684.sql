-- Búsqueda full-text (español, tolerante a tildes) sobre invitados ya cargados
-- en la app, para ampliar "Buscar en libretos históricos" más allá de
-- libretos_chunks (que hoy está vacía). Solo authenticated.

CREATE OR REPLACE FUNCTION public.buscar_invitados_app(query_text text, max_results integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  name text,
  position text,
  topic text,
  day_of_week text,
  time_slot integer,
  week_date date,
  scheduled_date date,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('spanish', public.unaccent_immutable(query_text)) AS tsq
  )
  SELECT
    g.id,
    g.name,
    g.position,
    g.topic,
    g.day_of_week,
    g.time_slot,
    g.week_date,
    g.scheduled_date,
    ts_rank(
      to_tsvector('spanish', public.unaccent_immutable(
        coalesce(g.name, '') || ' ' || coalesce(g.position, '') || ' ' || coalesce(g.topic, '') || ' ' ||
        coalesce(g.tema_principal, '') || ' ' || coalesce(g.infancia_vida_privada, '') || ' ' ||
        coalesce(g.carrera_profesional, '') || ' ' || coalesce(g.datos_curiosos, '') || ' ' ||
        coalesce(g.h2_info_personal, '') || ' ' || coalesce(g.h2_preguntas_sugeridas, '') || ' ' ||
        coalesce(g.h3_datos_personales, '') || ' ' || coalesce(g.h3_comunicado_prensa, '')
      )),
      q.tsq
    ) AS rank
  FROM public.guests g, q
  WHERE to_tsvector('spanish', public.unaccent_immutable(
        coalesce(g.name, '') || ' ' || coalesce(g.position, '') || ' ' || coalesce(g.topic, '') || ' ' ||
        coalesce(g.tema_principal, '') || ' ' || coalesce(g.infancia_vida_privada, '') || ' ' ||
        coalesce(g.carrera_profesional, '') || ' ' || coalesce(g.datos_curiosos, '') || ' ' ||
        coalesce(g.h2_info_personal, '') || ' ' || coalesce(g.h2_preguntas_sugeridas, '') || ' ' ||
        coalesce(g.h3_datos_personales, '') || ' ' || coalesce(g.h3_comunicado_prensa, '')
      )) @@ q.tsq
  ORDER BY rank DESC
  LIMIT max_results;
$$;

REVOKE ALL ON FUNCTION public.buscar_invitados_app(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_app(text, integer) TO authenticated;
