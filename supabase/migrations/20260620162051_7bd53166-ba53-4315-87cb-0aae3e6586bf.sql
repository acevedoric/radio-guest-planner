
-- Remove broad anon SELECT on guests; expose only safe columns via a public view
DROP POLICY IF EXISTS "Anyone can view guests" ON public.guests;
REVOKE SELECT ON public.guests FROM anon;

-- Public view: same shape as guests, but sensitive fields are NULL
CREATE OR REPLACE VIEW public.guests_anon
WITH (security_invoker = off) AS
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

GRANT SELECT ON public.guests_anon TO anon;
GRANT SELECT ON public.guests_anon TO authenticated;
