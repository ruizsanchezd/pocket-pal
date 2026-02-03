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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categorias: {
        Row: {
          color: string | null
          created_at: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number | null
          parent_id: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
          parent_id?: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo"]
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["categoria_tipo"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas: {
        Row: {
          activa: boolean | null
          color: string | null
          created_at: string | null
          divisa: string | null
          id: string
          nombre: string
          orden: number | null
          saldo_inicial: number | null
          tipo: Database["public"]["Enums"]["cuenta_tipo"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activa?: boolean | null
          color?: string | null
          created_at?: string | null
          divisa?: string | null
          id?: string
          nombre: string
          orden?: number | null
          saldo_inicial?: number | null
          tipo: Database["public"]["Enums"]["cuenta_tipo"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activa?: boolean | null
          color?: string | null
          created_at?: string | null
          divisa?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          saldo_inicial?: number | null
          tipo?: Database["public"]["Enums"]["cuenta_tipo"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cuentas_monedero_config: {
        Row: {
          activa: boolean | null
          created_at: string | null
          cuenta_id: string
          dia_recarga: number | null
          id: string
          recarga_mensual: number
          user_id: string
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          cuenta_id: string
          dia_recarga?: number | null
          id?: string
          recarga_mensual: number
          user_id: string
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          cuenta_id?: string
          dia_recarga?: number | null
          id?: string
          recarga_mensual?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_monedero_config_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: true
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_recurrentes: {
        Row: {
          activo: boolean | null
          cantidad: number
          categoria_id: string
          concepto: string
          created_at: string | null
          cuenta_id: string
          dia_del_mes: number | null
          id: string
          notas: string | null
          subcategoria_id: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          cantidad: number
          categoria_id: string
          concepto: string
          created_at?: string | null
          cuenta_id: string
          dia_del_mes?: number | null
          id?: string
          notas?: string | null
          subcategoria_id?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          cantidad?: number
          categoria_id?: string
          concepto?: string
          created_at?: string | null
          cuenta_id?: string
          dia_del_mes?: number | null
          id?: string
          notas?: string | null
          subcategoria_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_recurrentes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_recurrentes_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_recurrentes_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          cantidad: number
          categoria_id: string
          concepto: string
          created_at: string | null
          cuenta_id: string
          es_recurrente: boolean | null
          fecha: string
          id: string
          mes_referencia: string
          notas: string | null
          recurrente_template_id: string | null
          subcategoria_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cantidad: number
          categoria_id: string
          concepto: string
          created_at?: string | null
          cuenta_id: string
          es_recurrente?: boolean | null
          fecha: string
          id?: string
          mes_referencia: string
          notas?: string | null
          recurrente_template_id?: string | null
          subcategoria_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cantidad?: number
          categoria_id?: string
          concepto?: string
          created_at?: string | null
          cuenta_id?: string
          es_recurrente?: boolean | null
          fecha?: string
          id?: string
          mes_referencia?: string
          notas?: string | null
          recurrente_template_id?: string | null
          subcategoria_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_recurrente_template_id_fkey"
            columns: ["recurrente_template_id"]
            isOneToOne: false
            referencedRelation: "gastos_recurrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          cuenta_default_id: string | null
          display_name: string | null
          divisa_principal: string | null
          id: string
          onboarding_completed: boolean | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          cuenta_default_id?: string | null
          display_name?: string | null
          divisa_principal?: string | null
          id: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          cuenta_default_id?: string | null
          display_name?: string | null
          divisa_principal?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_cuenta_default"
            columns: ["cuenta_default_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots_patrimonio: {
        Row: {
          created_at: string | null
          cuenta_id: string
          id: string
          mes: string
          notas: string | null
          saldo_calculado: number | null
          saldo_registrado: number | null
          tipo_cambio: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cuenta_id: string
          id?: string
          mes: string
          notas?: string | null
          saldo_calculado?: number | null
          saldo_registrado?: number | null
          tipo_cambio?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cuenta_id?: string
          id?: string
          mes?: string
          notas?: string | null
          saldo_calculado?: number | null
          saldo_registrado?: number | null
          tipo_cambio?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_patrimonio_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      app_role: "admin" | "user"
      categoria_tipo: "ingreso" | "gasto" | "inversion"
      cuenta_tipo: "corriente" | "inversion" | "monedero"
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
      app_role: ["admin", "user"],
      categoria_tipo: ["ingreso", "gasto", "inversion"],
      cuenta_tipo: ["corriente", "inversion", "monedero"],
    },
  },
} as const
