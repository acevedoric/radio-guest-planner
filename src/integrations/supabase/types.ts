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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      guests: {
        Row: {
          avance_h2: string | null
          avance_h3: string | null
          carrera_profesional: string | null
          confirmed_blu: boolean
          confirmed_pr: boolean
          created_at: string
          datos_curiosos: string | null
          day_of_week: string
          email: string | null
          encuesta_hashtag: string | null
          encuesta_pregunta: string | null
          h1_canciones: string | null
          h2_canciones: string | null
          h2_contexto: string | null
          h2_documento_nombre: string | null
          h2_documento_url: string | null
          h2_info_personal: string | null
          h2_link_info: string | null
          h2_n8n_updated_at: string | null
          h2_preguntas_sugeridas: string | null
          h3_canciones: string | null
          h3_comunicado_prensa: string | null
          h3_datos_personales: string | null
          h3_documento_nombre: string | null
          h3_documento_url: string | null
          h3_link_info: string | null
          h3_n8n_updated_at: string | null
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
          scheduled_date: string | null
          scheduled_time: string | null
          social_networks: Json | null
          tema_principal: string | null
          tema_principal_documento_nombre: string | null
          tema_principal_documento_url: string | null
          time_slot: number
          topic: string
          updated_at: string
          week_date: string
        }
        Insert: {
          avance_h2?: string | null
          avance_h3?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean
          confirmed_pr?: boolean
          created_at?: string
          datos_curiosos?: string | null
          day_of_week: string
          email?: string | null
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
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
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot: number
          topic: string
          updated_at?: string
          week_date: string
        }
        Update: {
          avance_h2?: string | null
          avance_h3?: string | null
          carrera_profesional?: string | null
          confirmed_blu?: boolean
          confirmed_pr?: boolean
          created_at?: string
          datos_curiosos?: string | null
          day_of_week?: string
          email?: string | null
          encuesta_hashtag?: string | null
          encuesta_pregunta?: string | null
          h1_canciones?: string | null
          h2_canciones?: string | null
          h2_contexto?: string | null
          h2_documento_nombre?: string | null
          h2_documento_url?: string | null
          h2_info_personal?: string | null
          h2_link_info?: string | null
          h2_n8n_updated_at?: string | null
          h2_preguntas_sugeridas?: string | null
          h3_canciones?: string | null
          h3_comunicado_prensa?: string | null
          h3_datos_personales?: string | null
          h3_documento_nombre?: string | null
          h3_documento_url?: string | null
          h3_link_info?: string | null
          h3_n8n_updated_at?: string | null
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
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_networks?: Json | null
          tema_principal?: string | null
          tema_principal_documento_nombre?: string | null
          tema_principal_documento_url?: string | null
          time_slot?: number
          topic?: string
          updated_at?: string
          week_date?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
