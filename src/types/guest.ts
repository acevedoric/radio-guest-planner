export interface Guest {
  id?: string;
  name: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  social_networks?: any;
  topic: string;
  recording_status: "live" | "recorded" | "to_record" | "postponed" | "proposed";
  program_type?: string | null;
  press_contact?: string | null;
  press_phone?: string | null;
  notes?: string | null;
  day_of_week?: string | null;
  time_slot?: number | null;
  slot_order?: number | null;
  week_date?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  confirmed_blu?: boolean;
  confirmed_pr?: boolean;
  
  // Módulos de información (HORA 1)
  tema_principal?: string | null;
  tema_principal_documento_url?: string | null;
  tema_principal_documento_nombre?: string | null;
  infancia_vida_privada?: string | null;
  carrera_profesional?: string | null;
  datos_curiosos?: string | null;
  n8n_updated_at?: string | null;
  press_email?: string | null;
  proposed_by?: string | null;

  // Estado de la investigación con IA (n8n)
  research_status?: "pending" | "done" | "error" | null;
  research_hour?: "H1" | "H2" | "H3" | null;
  research_error?: string | null;
  research_updated_at?: string | null;

  // Módulos de información (HORA 2)
  h2_info_personal?: string | null;
  h2_preguntas_sugeridas?: string | null;
  h2_documento_url?: string | null;
  h2_documento_nombre?: string | null;
  h2_link_info?: string | null;
  h2_n8n_updated_at?: string | null;

  // Módulos de información (HORA 3)
  h3_datos_personales?: string | null;
  h3_comunicado_prensa?: string | null;
  h3_documento_url?: string | null;
  h3_documento_nombre?: string | null;
  h3_link_info?: string | null;
  h3_n8n_updated_at?: string | null;

  // Libreto diario (Martes/Jueves)
  encuesta_pregunta?: string | null;
  encuesta_hashtag?: string | null;
  h1_canciones?: string | null;
  h2_canciones?: string | null;
  h3_canciones?: string | null;
  h2_contexto?: string | null;
  avance_h2?: string | null;
  avance_h3?: string | null;

  // Notas adicionales por hora (libre, al final de cada sección)
  h1_notas_adicionales?: string | null;
  h2_notas_adicionales?: string | null;
  h3_notas_adicionales?: string | null;

  // Datos de cierre / producción por hora (periodista Voces y Sonidos + lanzamiento musical)
  h1_periodista_voces_sonidos?: string | null;
  h1_lanzamiento_musical?: string | null;
  h2_periodista_voces_sonidos?: string | null;
  h2_lanzamiento_musical?: string | null;
}
