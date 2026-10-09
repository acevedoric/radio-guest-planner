CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated, service_role;

-- libretos_chunks
DROP POLICY IF EXISTS "Authenticated can read libretos chunks" ON public.libretos_chunks;
REVOKE ALL ON public.libretos_chunks FROM anon, authenticated;
GRANT SELECT ON public.libretos_chunks TO authenticated;
GRANT ALL ON public.libretos_chunks TO service_role;
CREATE POLICY "Producers and admins read libretos chunks" ON public.libretos_chunks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'producer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));

-- invitados_historicos
DROP POLICY IF EXISTS "Authenticated can read invitados historicos" ON public.invitados_historicos;
DROP POLICY IF EXISTS "Producers and admins manage invitados historicos" ON public.invitados_historicos;
REVOKE ALL ON public.invitados_historicos FROM anon, authenticated;
GRANT SELECT ON public.invitados_historicos TO authenticated;
GRANT ALL ON public.invitados_historicos TO service_role;
CREATE POLICY "Producers and admins read invitados historicos" ON public.invitados_historicos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'producer'::app_role) OR public.has_role(auth.uid(),'admin'::app_role));

-- canciones, cancion_segmento, ajustes: lectura con rol, escritura producer/admin
DROP POLICY IF EXISTS "Authenticated can read canciones" ON public.canciones;
DROP POLICY IF EXISTS "Authenticated can read cancion segmento" ON public.cancion_segmento;
DROP POLICY IF EXISTS "Authenticated can read ajustes" ON public.ajustes;
REVOKE ALL ON public.canciones, public.cancion_segmento, public.ajustes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canciones, public.cancion_segmento, public.ajustes TO authenticated;
GRANT ALL ON public.canciones, public.cancion_segmento, public.ajustes TO service_role;
CREATE POLICY "Users with a role read canciones" ON public.canciones
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Users with a role read cancion segmento" ON public.cancion_segmento
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Users with a role read ajustes" ON public.ajustes
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- canciones_uso: solo lectura con rol; escritura vía trigger SECURITY DEFINER
DROP POLICY IF EXISTS "Authenticated can read canciones uso" ON public.canciones_uso;
DROP POLICY IF EXISTS "Producers and admins manage canciones uso" ON public.canciones_uso;
REVOKE ALL ON public.canciones_uso FROM anon, authenticated;
GRANT SELECT ON public.canciones_uso TO authenticated;
GRANT ALL ON public.canciones_uso TO service_role;
CREATE POLICY "Users with a role read canciones uso" ON public.canciones_uso
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- guests: anon solo a través de guests_anon
DROP POLICY IF EXISTS "Anon can read guests via view" ON public.guests;
REVOKE ALL ON public.guests FROM anon;

CREATE OR REPLACE VIEW public.guests_anon AS
SELECT id, name, NULL::text AS phone, NULL::text AS email, social_networks, topic,
  recording_status, program_type, NULL::text AS press_contact, NULL::text AS notes,
  day_of_week, time_slot, week_date, created_at, updated_at, NULL::text AS press_phone,
  scheduled_date, confirmed_blu, confirmed_pr, "position", tema_principal,
  tema_principal_documento_url, tema_principal_documento_nombre, infancia_vida_privada,
  carrera_profesional, datos_curiosos, n8n_updated_at, scheduled_time, NULL::text AS press_email,
  proposed_by, h2_info_personal, h2_preguntas_sugeridas, h2_documento_url, h2_documento_nombre,
  h2_link_info, h3_datos_personales, h3_comunicado_prensa, h3_documento_url, h3_documento_nombre,
  h3_link_info, h2_n8n_updated_at, h3_n8n_updated_at, encuesta_pregunta, encuesta_hashtag,
  h1_canciones, h2_canciones, h3_canciones, h2_contexto, avance_h2, avance_h3,
  h1_notas_adicionales, h2_notas_adicionales, h3_notas_adicionales,
  h1_periodista_voces_sonidos, h1_lanzamiento_musical, h2_periodista_voces_sonidos,
  h2_lanzamiento_musical, slot_order, festivo
FROM public.guests;
ALTER VIEW public.guests_anon SET (security_invoker = off);
ALTER VIEW public.guests_anon OWNER TO postgres;
REVOKE ALL ON public.guests_anon FROM anon, authenticated;
GRANT SELECT ON public.guests_anon TO anon, authenticated;
GRANT SELECT ON public.guests_anon TO service_role;