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
      audit_logs: {
        Row: {
          action: string
          id: string
          timestamp: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          id?: string
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          id?: string
          timestamp?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          created_by: string | null
          id: string
          last_updated: string
          order_num: number
          section_id: string | null
          target_departments: string[]
          target_outlets: string[]
          target_roles: Database["public"]["Enums"]["app_role"][]
          target_stations: string[]
          title: string
        }
        Insert: {
          content: string
          created_by?: string | null
          id: string
          last_updated?: string
          order_num: number
          section_id?: string | null
          target_departments?: string[]
          target_outlets?: string[]
          target_roles?: Database["public"]["Enums"]["app_role"][]
          target_stations?: string[]
          title: string
        }
        Update: {
          content?: string
          created_by?: string | null
          id?: string
          last_updated?: string
          order_num?: number
          section_id?: string | null
          target_departments?: string[]
          target_outlets?: string[]
          target_roles?: Database["public"]["Enums"]["app_role"][]
          target_stations?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_replies: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          id: string
          thread_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string
          id: string
          thread_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "faq_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "faq_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_threads: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          pinned_reply_id: string | null
          resolved: boolean
          title: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          created_at?: string
          id: string
          pinned_reply_id?: string | null
          resolved?: boolean
          title: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          pinned_reply_id?: string | null
          resolved?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      libraries: {
        Row: {
          created_at: string
          id: string
          order_num: number
          slug: string
          target_departments: string[]
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id: string
          order_num?: number
          slug: string
          target_departments?: string[]
          title: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_num?: number
          slug?: string
          target_departments?: string[]
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          created_at: string
          department: string | null
          id: string
          kind: string
          label: string
          order_num: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          kind: string
          label: string
          order_num?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          kind?: string
          label?: string
          order_num?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          departments: string[]
          email: string
          employee_id: string
          id: string
          last_login_at: string | null
          name: string
          outlets: string[]
          stations: string[]
          status: string
        }
        Insert: {
          created_at?: string
          department: string
          departments?: string[]
          email: string
          employee_id: string
          id: string
          last_login_at?: string | null
          name: string
          outlets?: string[]
          stations?: string[]
          status?: string
        }
        Update: {
          created_at?: string
          department?: string
          departments?: string[]
          email?: string
          employee_id?: string
          id?: string
          last_login_at?: string | null
          name?: string
          outlets?: string[]
          stations?: string[]
          status?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_by: string | null
          id: string
          library_id: string
          order_num: number
          target_category: string
          target_stations: string[]
          title: string
        }
        Insert: {
          created_by?: string | null
          id: string
          library_id?: string
          order_num: number
          target_category?: string
          target_stations?: string[]
          title: string
        }
        Update: {
          created_by?: string | null
          id?: string
          library_id?: string
          order_num?: number
          target_category?: string
          target_stations?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean
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
      create_app_role: {
        Args: {
          _department: string
          _label: string
          _level: number
          _value: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "director"
        | "hr"
        | "administrative"
        | "boh_manager"
        | "foh_manager"
        | "cdp"
        | "sous"
        | "boh_crew"
        | "waiter"
        | "barista"
        | "cashier"
        | "viewer_b"
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
      app_role: [
        "director",
        "hr",
        "administrative",
        "boh_manager",
        "foh_manager",
        "cdp",
        "sous",
        "boh_crew",
        "waiter",
        "barista",
        "cashier",
        "viewer_b",
      ],
    },
  },
} as const
