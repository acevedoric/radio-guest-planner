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
  day_of_week: string;
  time_slot: number;
  week_date: string;
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
}
