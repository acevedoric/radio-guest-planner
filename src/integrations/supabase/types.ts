export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_normalized: string | null
          reason: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_normalized?: string | null
          reason?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_normalized?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      blacklist_rules: {
        Row: {
          created_at: string
          id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      guest_documents: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          guest_id: string
          hour_number: number
          id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          guest_id: string
          hour_number?: number
          id?: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          guest_id?: string
          hour_number?: number
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_documents_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_documents_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests_anon"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_urls: {
        Row: {
          created_at: string
          guest_id: string
          hour_number: number
          id: string
          label: string | null
          url: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          hour_number?: number
          id?: string
          label?: string | null
          url: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          hour_number?: number
          id?: string
          label?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_urls_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_urls_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests_anon"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          avance_h2: string | null
          avance_h3: string | null
          blacklist_override_at: string | null
          blacklist_override_by: string | null
          carrera_profesional: string | null
          confirmed_blu: boolean
          confirmed_pr: boolean
          created_at: string
          datos_curiosos: string | null
          day_of_week: string | null
          email: string | null
          encuesta_hashtag: string | null
          encuesta_pregunta: string | null
          h1_canciones: string | null
          h1_lanzamiento_musical: string | null
          h1_notas_adicionales: string | null
          h1_periodista_voces_sonidos: string | null
          h2_canciones: string | null
          h2_contexto: string | null
          h2_documento_nombre: string | null
          h2_documento_url: string | null
          h2_info_personal: string | null
          h2_lanzamiento_musical: string | null
          h2_link_info: string | null
          h2_n8n_updated_at: string | null
          h2_notas_adicionales: string | null
          h2_periodista_voces_sonidos: string | null
          h2_preguntas_sugeridas: string | null
          h3_canciones: string | null
          h3_comunicado_prensa: string | null
          h3_datos_personales: string | null
          h3_documento_nombre: string | null
          h3_documento_url: string | null
          h3_link_info: string | null
          h3_n8n_updated_at: string | null
          h3_notas_adicionales: string | null
          id: string
          infancia_vida_privada: string | null
          n8n_updated_at: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          press_contact: string | null
          press_email: string | null
          press_phone: string | null
          program_type: string | null
          proposed_by: string | null
          recording_status: string
          research_error: string | null
          research_hour: string | null
          research_status: string | null
          research_updated_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          slot_order: number
          social_networks: Json | null
          tema_principal: string | null
          tema_principal_documento_nombre: string | null
          tema_principal_documento_url: string | null
          time_slot: number | null
          topic: string
          updated_at: string
          week_date: string | null
        }
        Insert: {
          avance_h2?: string | null
          avance_h3?: string | null
          blacklist_override_at?: string | null
          blacklist_override_by?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean
          confirmed_pr?: boolean
          created_at?: string
          datos_curiosos?: string | null
          day_of_week?: string | null
          email?: string | null
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h1_lanzamiento_musical?: string | null
          h1_notas_adicionales?: string | null
          h1_periodista_voces_sonidos?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_lanzamiento_musical?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_notas_adicionales?: string | null
          h2_periodista_voces_sonidos?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
          h3_notas_adicionales?: string | null
          id?: string
          infancia_vida_privada?: string | null
          n8n_updated_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          press_contact?: string | null
          press_email?: string | null
          press_phone?: string | null
          program_type?: string | null
          proposed_by?: string | null
          recording_status?: string
          research_error?: string | null
          research_hour?: string | null
          research_status?: string | null
          research_updated_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          slot_order?: number
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot?: number | null
          topic: string
          updated_at?: string
          week_date?: string | null
        }
        Update: {
          avance_h2?: string | null
          avance_h3?: string | null
          blacklist_override_at?: string | null
          blacklist_override_by?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean
          confirmed_pr?: boolean
          created_at?: string
          datos_curiosos?: string | null
          day_of_week?: string | null
          email?: string | null
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h1_lanzamiento_musical?: string | null
          h1_notas_adicionales?: string | null
          h1_periodista_voces_sonidos?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_lanzamiento_musical?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_notas_adicionales?: string | null
          h2_periodista_voces_sonidos?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
          h3_notas_adicionales?: string | null
          id?: string
          infancia_vida_privada?: string | null
          n8n_updated_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          press_contact?: string | null
          press_email?: string | null
          press_phone?: string | null
          program_type?: string | null
          proposed_by?: string | null
          recording_status?: string
          research_error?: string | null
          research_hour?: string | null
          research_status?: string | null
          research_updated_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          slot_order?: number
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot?: number | null
          topic?: string
          updated_at?: string
          week_date?: string | null
        }
        Relationships: []
      }
      libretos_chunks: {
        Row: {
          content: string
          created_at: string
          day_of_week: string | null
          fts: unknown
          guest_name: string
          guest_role: string | null
          hour_number: number | null
          id: string
          source_file: string | null
          year: number | null
        }
        Insert: {
          content: string
          created_at?: string
          day_of_week?: string | null
          fts?: unknown
          guest_name: string
          guest_role?: string | null
          hour_number?: number | null
          id?: string
          source_file?: string | null
          year?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          day_of_week?: string | null
          fts?: unknown
          guest_name?: string
          guest_role?: string | null
          hour_number?: number | null
          id?: string
          source_file?: string | null
          year?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      guests_anon: {
        Row: {
          avance_h2: string | null
          avance_h3: string | null
          carrera_profesional: string | null
          confirmed_blu: boolean | null
          confirmed_pr: boolean | null
          created_at: string | null
          datos_curiosos: string | null
          day_of_week: string | null
          email: string | null
          encuesta_hashtag: string | null
          encuesta_pregunta: string | null
          h1_canciones: string | null
          h1_lanzamiento_musical: string | null
          h1_notas_adicionales: string | null
          h1_periodista_voces_sonidos: string | null
          h2_canciones: string | null
          h2_contexto: string | null
          h2_documento_nombre: string | null
          h2_documento_url: string | null
          h2_info_personal: string | null
          h2_lanzamiento_musical: string | null
          h2_link_info: string | null
          h2_n8n_updated_at: string | null
          h2_notas_adicionales: string | null
          h2_periodista_voces_sonidos: string | null
          h2_preguntas_sugeridas: string | null
          h3_canciones: string | null
          h3_comunicado_prensa: string | null
          h3_datos_personales: string | null
          h3_documento_nombre: string | null
          h3_documento_url: string | null
          h3_link_info: string | null
          h3_n8n_updated_at: string | null
          h3_notas_adicionales: string | null
          id: string | null
          infancia_vida_privada: string | null
          n8n_updated_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          position: string | null
          press_contact: string | null
          press_email: string | null
          press_phone: string | null
          program_type: string | null
          proposed_by: string | null
          recording_status: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          social_networks: Json | null
          tema_principal: string | null
          tema_principal_documento_nombre: string | null
          tema_principal_documento_url: string | null
          time_slot: number | null
          topic: string | null
          updated_at: string | null
          week_date: string | null
        }
        Insert: {
          avance_h2?: string | null
          avance_h3?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean | null
          confirmed_pr?: boolean | null
          created_at?: string | null
          datos_curiosos?: string | null
          day_of_week?: string | null
          email?: never
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h1_lanzamiento_musical?: string | null
          h1_notas_adicionales?: string | null
          h1_periodista_voces_sonidos?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_lanzamiento_musical?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_notas_adicionales?: string | null
          h2_periodista_voces_sonidos?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
          h3_notas_adicionales?: string | null
          id?: string | null
          infancia_vida_privada?: string | null
          n8n_updated_at?: string | null
          name?: string | null
          notes?: never
          phone?: never
          position?: string | null
          press_contact?: never
          press_email?: never
          press_phone?: never
          program_type?: string | null
          proposed_by?: string | null
          recording_status?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot?: number | null
          topic?: string | null
          updated_at?: string | null
          week_date?: string | null
        }
        Update: {
          avance_h2?: string | null
          avance_h3?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean | null
          confirmed_pr?: boolean | null
          created_at?: string | null
          datos_curiosos?: string | null
          day_of_week?: string | null
          email?: never
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h1_lanzamiento_musical?: string | null
          h1_notas_adicionales?: string | null
          h1_periodista_voces_sonidos?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_lanzamiento_musical?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_notas_adicionales?: string | null
          h2_periodista_voces_sonidos?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
          h3_notas_adicionales?: string | null
          id?: string | null
          infancia_vida_privada?: string | null
          n8n_updated_at?: string | null
          name?: string | null
          notes?: never
          phone?: never
          position?: string | null
          press_contact?: never
          press_email?: never
          press_phone?: never
          program_type?: string | null
          proposed_by?: string | null
          recording_status?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot?: number | null
          topic?: string | null
          updated_at?: string | null
          week_date?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      buscar_invitado: {
        Args: { max_results?: number; query_text: string }
        Returns: {
          content: string
          day_of_week: string
          guest_name: string
          guest_role: string
          hour_number: number
          id: string
          rank: number
          source_file: string
          year: number
        }[]
      }
      buscar_invitados_rank: {
        Args: { max_results?: number; query_text: string }
        Returns: {
          day_of_week: string
          guest_position: string
          id: string
          name: string
          rank: number
          recording_status: string
          scheduled_date: string
          tier: number
          time_slot: number
          topic: string
          week_date: string
        }[]
      }
      check_blacklist: {
        Args: { p_name: string }
        Returns: {
          id: string
          match_type: string
          name: string
          reason: string
          similarity: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_allowed: { Args: { _email: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_immutable: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "producer" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "producer", "viewer"],
    },
  },
} as const
