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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      affirmations: {
        Row: {
          affirmed_at: string
          compact_version: string
          conduct_version: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          affirmed_at?: string
          compact_version: string
          conduct_version: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          affirmed_at?: string
          compact_version?: string
          conduct_version?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affirmations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      chapter_roles: {
        Row: {
          chapter_id: string
          expires_at: string | null
          granted_at: string
          id: string
          member_id: string
          role: string
        }
        Insert: {
          chapter_id: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          member_id: string
          role: string
        }
        Update: {
          chapter_id?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          member_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_roles_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_country_fkey"
            columns: ["country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      conduct_actions: {
        Row: {
          actor_id: string | null
          actor_note: string | null
          appeal_decided_at: string | null
          appeal_opened_at: string | null
          appeal_outcome: string | null
          conduct_version: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          level: Database["public"]["Enums"]["conduct_level"]
          member_id: string
          reason: string
        }
        Insert: {
          actor_id?: string | null
          actor_note?: string | null
          appeal_decided_at?: string | null
          appeal_opened_at?: string | null
          appeal_outcome?: string | null
          conduct_version: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          level: Database["public"]["Enums"]["conduct_level"]
          member_id: string
          reason: string
        }
        Update: {
          actor_id?: string | null
          actor_note?: string | null
          appeal_decided_at?: string | null
          appeal_opened_at?: string | null
          appeal_outcome?: string | null
          conduct_version?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          level?: Database["public"]["Enums"]["conduct_level"]
          member_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "conduct_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conduct_actions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      ghana_regions: {
        Row: {
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      member_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          granted_at: string
          id: string
          mechanism: string
          member_id: string
          policy_version: string
          revoked_at: string | null
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted_at?: string
          id?: string
          mechanism: string
          member_id: string
          policy_version: string
          revoked_at?: string | null
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted_at?: string
          id?: string
          mechanism?: string
          member_id?: string
          policy_version?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_consents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contributions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          member_id: string
          occurred_at: string
          type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          member_id: string
          occurred_at?: string
          type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          member_id?: string
          occurred_at?: string
          type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contributions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_gender: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender_identity"]
          member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender_identity"]
          member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender_identity"]
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_gender_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_intent: {
        Row: {
          ask_updated_at: string | null
          created_at: string
          current_ask: string | null
          current_offer: string | null
          member_id: string
          offer_updated_at: string | null
          open_to: string[]
          updated_at: string
          why_here: string[]
        }
        Insert: {
          ask_updated_at?: string | null
          created_at?: string
          current_ask?: string | null
          current_offer?: string | null
          member_id: string
          offer_updated_at?: string | null
          open_to?: string[]
          updated_at?: string
          why_here?: string[]
        }
        Update: {
          ask_updated_at?: string | null
          created_at?: string
          current_ask?: string | null
          current_offer?: string | null
          member_id?: string
          offer_updated_at?: string | null
          open_to?: string[]
          updated_at?: string
          why_here?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "member_intent_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          been_to_ghana: Database["public"]["Enums"]["been_to_ghana"] | null
          bio: string | null
          created_at: string
          curious_about: string | null
          languages: string[]
          links: Json
          member_id: string
          organization: string | null
          role: string | null
          sector: string | null
          skills: string[]
          updated_at: string
          usually_asked_about: string | null
          years_experience: number | null
        }
        Insert: {
          been_to_ghana?: Database["public"]["Enums"]["been_to_ghana"] | null
          bio?: string | null
          created_at?: string
          curious_about?: string | null
          languages?: string[]
          links?: Json
          member_id: string
          organization?: string | null
          role?: string | null
          sector?: string | null
          skills?: string[]
          updated_at?: string
          usually_asked_about?: string | null
          years_experience?: number | null
        }
        Update: {
          been_to_ghana?: Database["public"]["Enums"]["been_to_ghana"] | null
          bio?: string | null
          created_at?: string
          curious_about?: string | null
          languages?: string[]
          links?: Json
          member_id?: string
          organization?: string | null
          role?: string | null
          sector?: string | null
          skills?: string[]
          updated_at?: string
          usually_asked_about?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_settings: {
        Row: {
          created_at: string
          member_id: string
          settings: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          member_id: string
          settings?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          member_id?: string
          settings?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_settings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_standing: {
        Row: {
          created_at: string
          evidence: string | null
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          member_id: string
          standing_type: Database["public"]["Enums"]["standing_type"]
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          standing_type: Database["public"]["Enums"]["standing_type"]
        }
        Update: {
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          standing_type?: Database["public"]["Enums"]["standing_type"]
        }
        Relationships: [
          {
            foreignKeyName: "member_standing_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_standing_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_visibility: {
        Row: {
          connection: Database["public"]["Enums"]["visibility_level"]
          created_at: string
          identity: Database["public"]["Enums"]["visibility_level"]
          intent: Database["public"]["Enums"]["visibility_level"]
          links: Database["public"]["Enums"]["visibility_level"]
          location: Database["public"]["Enums"]["visibility_level"]
          member_id: string
          standing: Database["public"]["Enums"]["visibility_level"]
          updated_at: string
          work: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          connection?: Database["public"]["Enums"]["visibility_level"]
          created_at?: string
          identity?: Database["public"]["Enums"]["visibility_level"]
          intent?: Database["public"]["Enums"]["visibility_level"]
          links?: Database["public"]["Enums"]["visibility_level"]
          location?: Database["public"]["Enums"]["visibility_level"]
          member_id: string
          standing?: Database["public"]["Enums"]["visibility_level"]
          updated_at?: string
          work?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          connection?: Database["public"]["Enums"]["visibility_level"]
          created_at?: string
          identity?: Database["public"]["Enums"]["visibility_level"]
          intent?: Database["public"]["Enums"]["visibility_level"]
          links?: Database["public"]["Enums"]["visibility_level"]
          location?: Database["public"]["Enums"]["visibility_level"]
          member_id?: string
          standing?: Database["public"]["Enums"]["visibility_level"]
          updated_at?: string
          work?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "member_visibility_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          birth_month: number | null
          birth_year: number | null
          chapter_id: string | null
          city: string | null
          class_year: number
          connection_types: Database["public"]["Enums"]["connection_type"][]
          country: string | null
          created_at: string
          credential_id: string
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          first_name: string | null
          handle: string | null
          handle_changed_at: string | null
          id: string
          joined_at: string
          last_affirmed_at: string | null
          last_name: string | null
          member_number: number
          primary_connection:
            | Database["public"]["Enums"]["connection_type"]
            | null
          pseudonymized_at: string | null
          region_interests: string[]
          status: Database["public"]["Enums"]["member_status"]
          timezone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_month?: number | null
          birth_year?: number | null
          chapter_id?: string | null
          city?: string | null
          class_year?: number
          connection_types?: Database["public"]["Enums"]["connection_type"][]
          country?: string | null
          created_at?: string
          credential_id: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          first_name?: string | null
          handle?: string | null
          handle_changed_at?: string | null
          id?: string
          joined_at?: string
          last_affirmed_at?: string | null
          last_name?: string | null
          member_number: number
          primary_connection?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          pseudonymized_at?: string | null
          region_interests?: string[]
          status?: Database["public"]["Enums"]["member_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_month?: number | null
          birth_year?: number | null
          chapter_id?: string | null
          city?: string | null
          class_year?: number
          connection_types?: Database["public"]["Enums"]["connection_type"][]
          country?: string | null
          created_at?: string
          credential_id?: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          first_name?: string | null
          handle?: string | null
          handle_changed_at?: string | null
          id?: string
          joined_at?: string
          last_affirmed_at?: string | null
          last_name?: string | null
          member_number?: number
          primary_connection?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          pseudonymized_at?: string | null
          region_interests?: string[]
          status?: Database["public"]["Enums"]["member_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_chapter_fk"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_country_fkey"
            columns: ["country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      number_reservations: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          expires_at: string
          id: string
          member_number: number
          reserved_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          expires_at: string
          id?: string
          member_number: number
          reserved_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          expires_at?: string
          id?: string
          member_number?: number
          reserved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "number_reservations_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_handles: {
        Row: {
          handle: string
          reason: string
        }
        Insert: {
          handle: string
          reason?: string
        }
        Update: {
          handle?: string
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credential_id: {
        Args: { join_year: number; member_number: number }
        Returns: string
      }
      current_member_id: { Args: never; Returns: string }
      damm_digit: { Args: { digits: string }; Returns: number }
      is_founding_member: {
        Args: { m: Database["public"]["Tables"]["members"]["Row"] }
        Returns: boolean
      }
      pseudonymize_member: {
        Args: { reason?: string; target: string }
        Returns: undefined
      }
      report_gender_distribution: {
        Args: { min_cell?: number }
        Returns: {
          gender: Database["public"]["Enums"]["gender_identity"]
          member_count: number
          suppressed: boolean
        }[]
      }
      reserve_member_number: {
        Args: never
        Returns: {
          credential_id: string
          expires_at: string
          member_number: number
        }[]
      }
    }
    Enums: {
      been_to_ghana:
        | "never"
        | "once"
        | "several_times"
        | "lived_there"
        | "live_there"
      conduct_level:
        | "note"
        | "warning"
        | "restriction"
        | "suspension"
        | "revocation"
      connection_type:
        | "ghanaian_abroad"
        | "ghanaian_heritage"
        | "african_diaspora"
        | "ghanaian_at_home"
        | "african_continental"
        | "ally"
      consent_type:
        | "directory_visibility"
        | "institutional_discoverability"
        | "daoop_sharing"
        | "marketing"
        | "aggregate_research"
        | "townhall_invites"
        | "programme_updates"
      gender_identity:
        | "prefer_not_to_say"
        | "woman"
        | "man"
        | "non_binary"
        | "self_described"
      member_status:
        | "pending_verification"
        | "active"
        | "dormant"
        | "suspended"
        | "revoked"
      standing_type:
        | "founding_member"
        | "contributing_member"
        | "fellow"
        | "chapter_leader"
        | "honours"
      visibility_level: "hidden" | "institutions" | "members" | "public"
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
      been_to_ghana: [
        "never",
        "once",
        "several_times",
        "lived_there",
        "live_there",
      ],
      conduct_level: [
        "note",
        "warning",
        "restriction",
        "suspension",
        "revocation",
      ],
      connection_type: [
        "ghanaian_abroad",
        "ghanaian_heritage",
        "african_diaspora",
        "ghanaian_at_home",
        "african_continental",
        "ally",
      ],
      consent_type: [
        "directory_visibility",
        "institutional_discoverability",
        "daoop_sharing",
        "marketing",
        "aggregate_research",
        "townhall_invites",
        "programme_updates",
      ],
      gender_identity: [
        "prefer_not_to_say",
        "woman",
        "man",
        "non_binary",
        "self_described",
      ],
      member_status: [
        "pending_verification",
        "active",
        "dormant",
        "suspended",
        "revoked",
      ],
      standing_type: [
        "founding_member",
        "contributing_member",
        "fellow",
        "chapter_leader",
        "honours",
      ],
      visibility_level: ["hidden", "institutions", "members", "public"],
    },
  },
} as const
