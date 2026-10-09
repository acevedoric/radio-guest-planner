CREATE OR REPLACE VIEW public.guests_anon AS
SELECT id, name, NULL::text AS phone, NULL::text AS email, social_networks, topic, recording_status, program_type,
  NULL::text AS press_contact, NULL::text AS notes, day_of_week, time_slot, week_date, created_at, updated_at,
  NULL::text AS press_phone, scheduled_date, confirmed_blu, confirmed_pr, "position",
  NULL::text AS tema_principal, NULL::text AS tema_principal_documento_url, NULL::text AS tema_principal_documento_nombre,
  NULL::text AS infancia_vida_privada, NULL::text AS carrera_profesional, NULL::text AS datos_curiosos,
  n8n_updated_at, scheduled_time, NULL::text AS press_email, NULL::text AS proposed_by,
  NULL::text AS h2_info_personal, NULL::text AS h2_preguntas_sugeridas, NULL::text AS h2_documento_url, NULL::text AS h2_documento_nombre, NULL::text AS h2_link_info,
  NULL::text AS h3_datos_personales, NULL::text AS h3_comunicado_prensa, NULL::text AS h3_documento_url, NULL::text AS h3_documento_nombre, NULL::text AS h3_link_info,
  h2_n8n_updated_at, h3_n8n_updated_at, NULL::text AS encuesta_pregunta, NULL::text AS encuesta_hashtag, h1_canciones, h2_canciones, h3_canciones,
  NULL::text AS h2_contexto, NULL::text AS avance_h2, NULL::text AS avance_h3, NULL::text AS h1_notas_adicionales, NULL::text AS h2_notas_adicionales, NULL::text AS h3_notas_adicionales,
  NULL::text AS h1_periodista_voces_sonidos, h1_lanzamiento_musical, NULL::text AS h2_periodista_voces_sonidos, h2_lanzamiento_musical, slot_order, festivo
FROM public.guests;
COMMENT ON VIEW public.guests_anon IS 'Intentional SECURITY DEFINER view: public read-only grid without contacts, research, or internal production notes.';