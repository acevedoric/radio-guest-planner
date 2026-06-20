
-- Recreate guests_anon view with security_invoker = on so it respects the
-- querying user's RLS and privileges (resolves SECURITY DEFINER view warning).
DROP VIEW IF EXISTS public.guests_anon;

CREATE VIEW public.guests_anon
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  NULL::text AS phone,
  NULL::text AS email,
  social_networks,
  topic,
  recording_status,
  program_type,
  NULL::text AS press_contact,
  NULL::text AS notes,
  day_of_week,
  time_slot,
  week_date,
  created_at,
  updated_at,
  NULL::text AS press_phone,
  scheduled_date,
  confirmed_blu,
  confirmed_pr,
  position,
  tema_principal,
  tema_principal_documento_url,
  tema_principal_documento_nombre,
  infancia_vida_privada,
  carrera_profesional,
  datos_curiosos,
  n8n_updated_at,
  scheduled_time,
  NULL::text AS press_email,
  proposed_by,
  h2_info_personal,
  h2_preguntas_sugeridas,
  h2_documento_url,
  h2_documento_nombre,
  h2_link_info,
  h3_datos_personales,
  h3_comunicado_prensa,
  h3_documento_url,
  h3_documento_nombre,
  h3_link_info,
  h2_n8n_updated_at,
  h3_n8n_updated_at,
  encuesta_pregunta,
  encuesta_hashtag,
  h1_canciones,
  h2_canciones,
  h3_canciones,
  h2_contexto,
  avance_h2,
  avance_h3,
  h1_notas_adicionales,
  h2_notas_adicionales,
  h3_notas_adicionales,
  h1_periodista_voces_sonidos,
  h1_lanzamiento_musical,
  h2_periodista_voces_sonidos,
  h2_lanzamiento_musical
FROM public.guests;

GRANT SELECT ON public.guests_anon TO anon, authenticated;

-- For security_invoker=on, anon needs row-level access plus column-level
-- privileges on the underlying table for the non-NULL columns referenced.
-- Grant SELECT only on safe columns (sensitive ones excluded).
GRANT SELECT (
  id, name, social_networks, topic, recording_status, program_type,
  day_of_week, time_slot, week_date, created_at, updated_at,
  scheduled_date, confirmed_blu, confirmed_pr, position,
  tema_principal, tema_principal_documento_url, tema_principal_documento_nombre,
  infancia_vida_privada, carrera_profesional, datos_curiosos, n8n_updated_at,
  scheduled_time, proposed_by,
  h2_info_personal, h2_preguntas_sugeridas, h2_documento_url, h2_documento_nombre,
  h2_link_info, h3_datos_personales, h3_comunicado_prensa, h3_documento_url,
  h3_documento_nombre, h3_link_info, h2_n8n_updated_at, h3_n8n_updated_at,
  encuesta_pregunta, encuesta_hashtag,
  h1_canciones, h2_canciones, h3_canciones, h2_contexto, avance_h2, avance_h3,
  h1_notas_adicionales, h2_notas_adicionales, h3_notas_adicionales,
  h1_periodista_voces_sonidos, h1_lanzamiento_musical,
  h2_periodista_voces_sonidos, h2_lanzamiento_musical
) ON public.guests TO anon;

-- Add an RLS policy so anon can read rows through the view.
DROP POLICY IF EXISTS "Anon can read guests via view" ON public.guests;
CREATE POLICY "Anon can read guests via view"
ON public.guests
FOR SELECT
TO anon
USING (true);
