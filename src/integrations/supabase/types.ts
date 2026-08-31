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
      activity_events: {
        Row: {
          actor_member_id: string | null
          id: number
          kind_slug: string
          occurred_at: string
          payload: Json
          place_slug: string | null
          subject_id: string
          subject_kind: string
        }
        Insert: {
          actor_member_id?: string | null
          id?: never
          kind_slug: string
          occurred_at?: string
          payload?: Json
          place_slug?: string | null
          subject_id: string
          subject_kind: string
        }
        Update: {
          actor_member_id?: string | null
          id?: never
          kind_slug?: string
          occurred_at?: string
          payload?: Json
          place_slug?: string | null
          subject_id?: string
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_kind_slug_fkey"
            columns: ["kind_slug"]
            isOneToOne: false
            referencedRelation: "activity_kinds"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "activity_events_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
        ]
      }
      activity_kinds: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
          visibility: string
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
          visibility: string
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
          visibility?: string
        }
        Relationships: []
      }
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
      connection_requests: {
        Row: {
          context_id: string
          context_kind: string
          created_at: string
          expires_at: string
          from_member: string
          id: string
          note: string | null
          responded_at: string | null
          state: string
          to_member: string
        }
        Insert: {
          context_id: string
          context_kind: string
          created_at?: string
          expires_at?: string
          from_member: string
          id?: string
          note?: string | null
          responded_at?: string | null
          state?: string
          to_member: string
        }
        Update: {
          context_id?: string
          context_kind?: string
          created_at?: string
          expires_at?: string
          from_member?: string
          id?: string
          note?: string | null
          responded_at?: string | null
          state?: string
          to_member?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_from_member_fkey"
            columns: ["from_member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_to_member_fkey"
            columns: ["to_member"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          ended_at: string | null
          established_at: string
          member_high: string
          member_low: string
          source: string
        }
        Insert: {
          ended_at?: string | null
          established_at?: string
          member_high: string
          member_low: string
          source: string
        }
        Update: {
          ended_at?: string | null
          established_at?: string
          member_high?: string
          member_low?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_member_high_fkey"
            columns: ["member_high"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_member_low_fkey"
            columns: ["member_low"]
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
      data_confidence_levels: {
        Row: {
          description: string
          label: string
          publishable: boolean
          sort_order: number
        }
        Insert: {
          description: string
          label: string
          publishable: boolean
          sort_order: number
        }
        Update: {
          description?: string
          label?: string
          publishable?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      declaration_visibilities: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      declarations: {
        Row: {
          available_from: string
          available_until: string
          capacity_note: string | null
          created_at: string
          detail: string | null
          direction: string
          headline: string
          id: string
          member_id: string
          pathway_slug: string
          place_slug: string
          sector_slug: string | null
          state: string
          updated_at: string
          visibility: string
          withdrawn_at: string | null
        }
        Insert: {
          available_from?: string
          available_until: string
          capacity_note?: string | null
          created_at?: string
          detail?: string | null
          direction: string
          headline: string
          id?: string
          member_id: string
          pathway_slug: string
          place_slug: string
          sector_slug?: string | null
          state?: string
          updated_at?: string
          visibility?: string
          withdrawn_at?: string | null
        }
        Update: {
          available_from?: string
          available_until?: string
          capacity_note?: string | null
          created_at?: string
          detail?: string | null
          direction?: string
          headline?: string
          id?: string
          member_id?: string
          pathway_slug?: string
          place_slug?: string
          sector_slug?: string | null
          state?: string
          updated_at?: string
          visibility?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "declarations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declarations_pathway_slug_fkey"
            columns: ["pathway_slug"]
            isOneToOne: false
            referencedRelation: "pathways"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "declarations_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "declarations_sector_slug_fkey"
            columns: ["sector_slug"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "declarations_visibility_fkey"
            columns: ["visibility"]
            isOneToOne: false
            referencedRelation: "declaration_visibilities"
            referencedColumns: ["slug"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          address: string
          created_at: string
          detail: string | null
          member_id: string | null
          reason: string
        }
        Insert: {
          address: string
          created_at?: string
          detail?: string | null
          member_id?: string | null
          reason: string
        }
        Update: {
          address?: string
          created_at?: string
          detail?: string | null
          member_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_participants: {
        Row: {
          contribution_note: string | null
          engagement_id: string
          joined_at: string
          left_at: string | null
          member_id: string
          participant_role: string
        }
        Insert: {
          contribution_note?: string | null
          engagement_id: string
          joined_at?: string
          left_at?: string | null
          member_id: string
          participant_role?: string
        }
        Update: {
          contribution_note?: string | null
          engagement_id?: string
          joined_at?: string
          left_at?: string | null
          member_id?: string
          participant_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_participants_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_states: {
        Row: {
          description: string
          is_terminal: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          is_terminal?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          is_terminal?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      engagement_transitions: {
        Row: {
          actor: string
          from_state: string
          note: string | null
          to_state: string
        }
        Insert: {
          actor: string
          from_state: string
          note?: string | null
          to_state: string
        }
        Update: {
          actor?: string
          from_state?: string
          note?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_transitions_from_state_fkey"
            columns: ["from_state"]
            isOneToOne: false
            referencedRelation: "engagement_states"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "engagement_transitions_to_state_fkey"
            columns: ["to_state"]
            isOneToOne: false
            referencedRelation: "engagement_states"
            referencedColumns: ["slug"]
          },
        ]
      }
      engagements: {
        Row: {
          closed_at: string | null
          created_at: string
          declaration_id: string | null
          delivered_at: string | null
          direction: string
          entity: string | null
          held_until: string | null
          id: string
          identity_revealed_at: string | null
          need_id: string | null
          opened_at: string
          opened_by: string
          outcome_note: string | null
          place_slug: string
          r17_role: string | null
          redirect_note: string | null
          redirected_to_id: string | null
          review_due_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          declaration_id?: string | null
          delivered_at?: string | null
          direction: string
          entity?: string | null
          held_until?: string | null
          id?: string
          identity_revealed_at?: string | null
          need_id?: string | null
          opened_at?: string
          opened_by: string
          outcome_note?: string | null
          place_slug: string
          r17_role?: string | null
          redirect_note?: string | null
          redirected_to_id?: string | null
          review_due_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          declaration_id?: string | null
          delivered_at?: string | null
          direction?: string
          entity?: string | null
          held_until?: string | null
          id?: string
          identity_revealed_at?: string | null
          need_id?: string | null
          opened_at?: string
          opened_by?: string
          outcome_note?: string | null
          place_slug?: string
          r17_role?: string | null
          redirect_note?: string | null
          redirected_to_id?: string | null
          review_due_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "engagements_redirected_to_id_fkey"
            columns: ["redirected_to_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_state_fkey"
            columns: ["state"]
            isOneToOne: false
            referencedRelation: "engagement_states"
            referencedColumns: ["slug"]
          },
        ]
      }
      erasure_log: {
        Row: {
          actor_id: string | null
          auth_deleted_at: string | null
          auth_user_id: string | null
          created_at: string
          erased_at: string
          id: string
          member_id: string
          reason: string
        }
        Insert: {
          actor_id?: string | null
          auth_deleted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          erased_at?: string
          id?: string
          member_id: string
          reason: string
        }
        Update: {
          actor_id?: string | null
          auth_deleted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          erased_at?: string
          id?: string
          member_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "erasure_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erasure_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_campaigns: {
        Row: {
          channel: string
          code: string
          created_at: string
          id: string
          name: string
          offering_id: string
          partner: string | null
        }
        Insert: {
          channel: string
          code: string
          created_at?: string
          id?: string
          name: string
          offering_id: string
          partner?: string | null
        }
        Update: {
          channel?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          offering_id?: string
          partner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_campaigns_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_segments: {
        Row: {
          created_at: string
          id: string
          minutes: number | null
          notes: string | null
          offering_id: string
          sequence: number
          speaker_name: string | null
          speaker_role: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes?: number | null
          notes?: string | null
          offering_id: string
          sequence: number
          speaker_name?: string | null
          speaker_role?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number | null
          notes?: string | null
          offering_id?: string
          sequence?: number
          speaker_name?: string | null
          speaker_role?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_segments_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      ghana_regions: {
        Row: {
          band: string | null
          capital: string | null
          created_2018_from: string | null
          data_confidence: string | null
          fill_token: string | null
          former_name: string | null
          ink_token: string | null
          name: string
          pattern: number | null
          reference_source: string | null
          reference_verified: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          band?: string | null
          capital?: string | null
          created_2018_from?: string | null
          data_confidence?: string | null
          fill_token?: string | null
          former_name?: string | null
          ink_token?: string | null
          name: string
          pattern?: number | null
          reference_source?: string | null
          reference_verified?: string | null
          slug: string
          sort_order: number
        }
        Update: {
          band?: string | null
          capital?: string | null
          created_2018_from?: string | null
          data_confidence?: string | null
          fill_token?: string | null
          former_name?: string | null
          ink_token?: string | null
          name?: string
          pattern?: number | null
          reference_source?: string | null
          reference_verified?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ghana_regions_data_confidence_fkey"
            columns: ["data_confidence"]
            isOneToOne: false
            referencedRelation: "data_confidence_levels"
            referencedColumns: ["label"]
          },
          {
            foreignKeyName: "ghana_regions_place_fkey"
            columns: ["slug"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
        ]
      }
      handle_reviews: {
        Row: {
          created_at: string
          handle: string
          id: string
          match_reason: string
          matched: string
          member_id: string
          reviewed_at: string | null
          reviewer_note: string | null
          status: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          match_reason: string
          matched: string
          member_id: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          match_reason?: string
          matched?: string
          member_id?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "handle_reviews_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          declaration_id: string
          dismissed_at: string | null
          id: string
          member_id: string
          need_id: string
          notified_at: string | null
          reasons: string[]
          score: number
          state: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          declaration_id: string
          dismissed_at?: string | null
          id?: string
          member_id: string
          need_id: string
          notified_at?: string | null
          reasons?: string[]
          score: number
          state?: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          declaration_id?: string
          dismissed_at?: string | null
          id?: string
          member_id?: string
          need_id?: string
          notified_at?: string | null
          reasons?: string[]
          score?: number
          state?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_declaration_id_fkey"
            columns: ["declaration_id"]
            isOneToOne: false
            referencedRelation: "declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string
          byte_size: number | null
          caption: string | null
          created_at: string
          credit: string
          credit_url: string | null
          height: number | null
          id: string
          is_cleared: boolean
          kind: string
          licence: string
          place_slug: string | null
          storage_path: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text: string
          byte_size?: number | null
          caption?: string | null
          created_at?: string
          credit: string
          credit_url?: string | null
          height?: number | null
          id?: string
          is_cleared?: boolean
          kind?: string
          licence?: string
          place_slug?: string | null
          storage_path: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          byte_size?: number | null
          caption?: string | null
          created_at?: string
          credit?: string
          credit_url?: string | null
          height?: number | null
          id?: string
          is_cleared?: boolean
          kind?: string
          licence?: string
          place_slug?: string | null
          storage_path?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
        ]
      }
      member_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
      member_onboarding: {
        Row: {
          campaign_code: string | null
          completed_at: string | null
          current_step: string
          member_id: string
          referral_source: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          campaign_code?: string | null
          completed_at?: string | null
          current_step?: string
          member_id: string
          referral_source?: string | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          campaign_code?: string | null
          completed_at?: string | null
          current_step?: string
          member_id?: string
          referral_source?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_onboarding_current_step_fkey"
            columns: ["current_step"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
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
          founding_member: boolean
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
          subdivision: string | null
          timezone: string
          updated_at: string
          user_id: string | null
          welcome_email_sent_at: string | null
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
          founding_member?: boolean
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
          subdivision?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          welcome_email_sent_at?: string | null
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
          founding_member?: boolean
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
          subdivision?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          welcome_email_sent_at?: string | null
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
      message_attachments: {
        Row: {
          byte_size: number | null
          created_at: string
          filename: string | null
          id: string
          kind: string
          message_id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          filename?: string | null
          id?: string
          kind: string
          message_id: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string
          message_id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          member_id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          member_id: string
          message_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          member_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          ciphertext: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
          state: string
          thread_id: string
        }
        Insert: {
          body?: string | null
          ciphertext?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
          state?: string
          thread_id: string
        }
        Update: {
          body?: string | null
          ciphertext?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
          state?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_preferences: {
        Row: {
          inbound_open: boolean
          member_id: string
          read_receipts: boolean
          retention_months: number
          typing_indicators: boolean
          updated_at: string
        }
        Insert: {
          inbound_open?: boolean
          member_id: string
          read_receipts?: boolean
          retention_months?: number
          typing_indicators?: boolean
          updated_at?: string
        }
        Update: {
          inbound_open?: boolean
          member_id?: string
          read_receipts?: boolean
          retention_months?: number
          typing_indicators?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_on: string | null
          created_at: string
          detail: string | null
          due_on: string | null
          engagement_id: string
          id: string
          reported_at: string | null
          reported_by: string | null
          sequence: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_on?: string | null
          created_at?: string
          detail?: string | null
          due_on?: string | null
          engagement_id: string
          id?: string
          reported_at?: string | null
          reported_by?: string | null
          sequence: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_on?: string | null
          created_at?: string
          detail?: string | null
          due_on?: string | null
          engagement_id?: string
          id?: string
          reported_at?: string | null
          reported_by?: string | null
          sequence?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      need_pathways: {
        Row: {
          need_id: string
          pathway_slug: string
        }
        Insert: {
          need_id: string
          pathway_slug: string
        }
        Update: {
          need_id?: string
          pathway_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_pathways_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_pathways_pathway_slug_fkey"
            columns: ["pathway_slug"]
            isOneToOne: false
            referencedRelation: "pathways"
            referencedColumns: ["slug"]
          },
        ]
      }
      need_statuses: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      need_tags: {
        Row: {
          need_id: string
          tag_slug: string
        }
        Insert: {
          need_id: string
          tag_slug: string
        }
        Update: {
          need_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "need_tags_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "opportunity_tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      needs: {
        Row: {
          closes_at: string | null
          created_at: string
          data_confidence: string
          detail: string | null
          direction: string
          id: string
          investment_amount: number | null
          investment_currency: string | null
          investment_note: string | null
          opportunity_type: string | null
          place_slug: string
          projected_annual_sales: number | null
          projected_employment: number | null
          projected_sales_currency: string | null
          published_at: string | null
          published_by: string | null
          reference_source: string | null
          reference_verified: string | null
          review_flag: string | null
          sector_slug: string | null
          state: string
          status_slug: string
          submitted_at: string
          submitted_by: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          data_confidence?: string
          detail?: string | null
          direction: string
          id?: string
          investment_amount?: number | null
          investment_currency?: string | null
          investment_note?: string | null
          opportunity_type?: string | null
          place_slug: string
          projected_annual_sales?: number | null
          projected_employment?: number | null
          projected_sales_currency?: string | null
          published_at?: string | null
          published_by?: string | null
          reference_source?: string | null
          reference_verified?: string | null
          review_flag?: string | null
          sector_slug?: string | null
          state?: string
          status_slug?: string
          submitted_at?: string
          submitted_by?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          data_confidence?: string
          detail?: string | null
          direction?: string
          id?: string
          investment_amount?: number | null
          investment_currency?: string | null
          investment_note?: string | null
          opportunity_type?: string | null
          place_slug?: string
          projected_annual_sales?: number | null
          projected_employment?: number | null
          projected_sales_currency?: string | null
          published_at?: string | null
          published_by?: string | null
          reference_source?: string | null
          reference_verified?: string | null
          review_flag?: string | null
          sector_slug?: string | null
          state?: string
          status_slug?: string
          submitted_at?: string
          submitted_by?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_data_confidence_fkey"
            columns: ["data_confidence"]
            isOneToOne: false
            referencedRelation: "data_confidence_levels"
            referencedColumns: ["label"]
          },
          {
            foreignKeyName: "needs_opportunity_type_fkey"
            columns: ["opportunity_type"]
            isOneToOne: false
            referencedRelation: "opportunity_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "needs_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "needs_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_sector_slug_fkey"
            columns: ["sector_slug"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "needs_status_slug_fkey"
            columns: ["status_slug"]
            isOneToOne: false
            referencedRelation: "need_statuses"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "needs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_channels: {
        Row: {
          description: string
          is_live: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          is_live?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          is_live?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel_slug: string
          claimed_at: string | null
          created_at: string
          digest_key: string | null
          error: string | null
          id: string
          member_id: string
          next_attempt_at: string | null
          notification_id: string
          provider: string | null
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          state: string
        }
        Insert: {
          attempts?: number
          channel_slug: string
          claimed_at?: string | null
          created_at?: string
          digest_key?: string | null
          error?: string | null
          id?: string
          member_id: string
          next_attempt_at?: string | null
          notification_id: string
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          state?: string
        }
        Update: {
          attempts?: number
          channel_slug?: string
          claimed_at?: string | null
          created_at?: string
          digest_key?: string | null
          error?: string | null
          id?: string
          member_id?: string
          next_attempt_at?: string | null
          notification_id?: string
          provider?: string | null
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_channel_slug_fkey"
            columns: ["channel_slug"]
            isOneToOne: false
            referencedRelation: "notification_channels"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notification_deliveries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_kinds: {
        Row: {
          default_cadence: string
          default_email: boolean
          description: string
          is_essential: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          default_cadence?: string
          default_email?: boolean
          description: string
          is_essential?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          default_cadence?: string
          default_email?: boolean
          description?: string
          is_essential?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          cadence: string
          channel_slug: string
          enabled: boolean
          kind_slug: string
          member_id: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          channel_slug: string
          enabled?: boolean
          kind_slug: string
          member_id: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          channel_slug?: string
          enabled?: boolean
          kind_slug?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_channel_slug_fkey"
            columns: ["channel_slug"]
            isOneToOne: false
            referencedRelation: "notification_channels"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notification_preferences_kind_slug_fkey"
            columns: ["kind_slug"]
            isOneToOne: false
            referencedRelation: "notification_kinds"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          digest_hour: number
          email_enabled: boolean
          member_id: string
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          updated_at: string
        }
        Insert: {
          digest_hour?: number
          email_enabled?: boolean
          member_id: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
        }
        Update: {
          digest_hour?: number
          email_enabled?: boolean
          member_id?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dismissed_at: string | null
          emailed_at: string | null
          id: string
          kind: string
          member_id: string
          read_at: string | null
          state: string
          subject_id: string
          subject_kind: string
          title: string
          url_path: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          emailed_at?: string | null
          id?: string
          kind: string
          member_id: string
          read_at?: string | null
          state?: string
          subject_id: string
          subject_kind: string
          title: string
          url_path?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          emailed_at?: string | null
          id?: string
          kind?: string
          member_id?: string
          read_at?: string | null
          state?: string
          subject_id?: string
          subject_kind?: string
          title?: string
          url_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
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
      offering_downloads: {
        Row: {
          id: number
          member_id: string | null
          occurred_at: string
          offering_id: string
        }
        Insert: {
          id?: never
          member_id?: string | null
          occurred_at?: string
          offering_id: string
        }
        Update: {
          id?: never
          member_id?: string | null
          occurred_at?: string
          offering_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_downloads_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_downloads_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_feedback: {
        Row: {
          comment: string | null
          created_at: string
          member_id: string
          offering_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          member_id: string
          offering_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          member_id?: string
          offering_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "offering_feedback_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_feedback_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_media: {
        Row: {
          media_id: string
          offering_id: string
          role: string
          sequence: number
        }
        Insert: {
          media_id: string
          offering_id: string
          role?: string
          sequence?: number
        }
        Update: {
          media_id?: string
          offering_id?: string
          role?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "offering_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_media_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_perks: {
        Row: {
          created_at: string
          discount_percent: number | null
          member_price_amount: number | null
          member_price_currency: string | null
          note: string | null
          offering_id: string
          perk_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          member_price_amount?: number | null
          member_price_currency?: string | null
          note?: string | null
          offering_id: string
          perk_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          member_price_amount?: number | null
          member_price_currency?: string | null
          note?: string | null
          offering_id?: string
          perk_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_perks_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: true
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_perks_perk_kind_fkey"
            columns: ["perk_kind"]
            isOneToOne: false
            referencedRelation: "perk_kinds"
            referencedColumns: ["slug"]
          },
        ]
      }
      offering_registrations: {
        Row: {
          attended_at: string | null
          campaign_code: string | null
          check_in_code: string | null
          check_in_method: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          external_ref: string | null
          member_id: string
          note: string | null
          offering_id: string
          referrer: string | null
          registered_at: string
          state: string
        }
        Insert: {
          attended_at?: string | null
          campaign_code?: string | null
          check_in_code?: string | null
          check_in_method?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          external_ref?: string | null
          member_id: string
          note?: string | null
          offering_id: string
          referrer?: string | null
          registered_at?: string
          state?: string
        }
        Update: {
          attended_at?: string | null
          campaign_code?: string | null
          check_in_code?: string | null
          check_in_method?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          external_ref?: string | null
          member_id?: string
          note?: string | null
          offering_id?: string
          referrer?: string | null
          registered_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_registrations_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_surfaces: {
        Row: {
          offering_id: string
          priority: number
          surface_slug: string
          variant: string
        }
        Insert: {
          offering_id: string
          priority?: number
          surface_slug: string
          variant?: string
        }
        Update: {
          offering_id?: string
          priority?: number
          surface_slug?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_surfaces_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_surfaces_surface_slug_fkey"
            columns: ["surface_slug"]
            isOneToOne: false
            referencedRelation: "render_surfaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      offering_tags: {
        Row: {
          offering_id: string
          tag_slug: string
        }
        Insert: {
          offering_id: string
          tag_slug: string
        }
        Update: {
          offering_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_tags_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "opportunity_tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      offering_type_fields: {
        Row: {
          field_key: string
          help: string | null
          input: string
          is_required: boolean
          label: string
          options: Json | null
          sort_order: number
          type_slug: string
        }
        Insert: {
          field_key: string
          help?: string | null
          input: string
          is_required?: boolean
          label: string
          options?: Json | null
          sort_order: number
          type_slug: string
        }
        Update: {
          field_key?: string
          help?: string | null
          input?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          sort_order?: number
          type_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_type_fields_type_slug_fkey"
            columns: ["type_slug"]
            isOneToOne: false
            referencedRelation: "offering_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      offering_types: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      offerings: {
        Row: {
          attendee_count: number
          audience: string
          badge_text: string | null
          capacity: number | null
          card: Json
          chapter_slug: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_mode: string
          cta_url: string | null
          delivery: string
          detail: string | null
          doors_open_minutes: number
          download_count: number
          ends_at: string | null
          entity: string
          external_event_id: string | null
          host_platform: string | null
          id: string
          join_url: string | null
          list_price_amount: number | null
          list_price_currency: string | null
          location: string | null
          place_slug: string | null
          price_note: string | null
          provider_logo_media_id: string | null
          provider_name: string | null
          publish_at: string | null
          published_at: string | null
          published_by: string | null
          rating_count: number
          rating_sum: number
          registration_url: string | null
          replay_url: string | null
          scheduled_by: string | null
          scope_mode: string
          sector_slug: string | null
          slug: string
          starts_at: string | null
          state: string
          summary: string
          timezone: string
          title: string
          type_slug: string
          unpublish_at: string | null
          updated_at: string
        }
        Insert: {
          attendee_count?: number
          audience?: string
          badge_text?: string | null
          capacity?: number | null
          card?: Json
          chapter_slug?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_mode?: string
          cta_url?: string | null
          delivery?: string
          detail?: string | null
          doors_open_minutes?: number
          download_count?: number
          ends_at?: string | null
          entity: string
          external_event_id?: string | null
          host_platform?: string | null
          id?: string
          join_url?: string | null
          list_price_amount?: number | null
          list_price_currency?: string | null
          location?: string | null
          place_slug?: string | null
          price_note?: string | null
          provider_logo_media_id?: string | null
          provider_name?: string | null
          publish_at?: string | null
          published_at?: string | null
          published_by?: string | null
          rating_count?: number
          rating_sum?: number
          registration_url?: string | null
          replay_url?: string | null
          scheduled_by?: string | null
          scope_mode?: string
          sector_slug?: string | null
          slug: string
          starts_at?: string | null
          state?: string
          summary: string
          timezone?: string
          title: string
          type_slug: string
          unpublish_at?: string | null
          updated_at?: string
        }
        Update: {
          attendee_count?: number
          audience?: string
          badge_text?: string | null
          capacity?: number | null
          card?: Json
          chapter_slug?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_mode?: string
          cta_url?: string | null
          delivery?: string
          detail?: string | null
          doors_open_minutes?: number
          download_count?: number
          ends_at?: string | null
          entity?: string
          external_event_id?: string | null
          host_platform?: string | null
          id?: string
          join_url?: string | null
          list_price_amount?: number | null
          list_price_currency?: string | null
          location?: string | null
          place_slug?: string | null
          price_note?: string | null
          provider_logo_media_id?: string | null
          provider_name?: string | null
          publish_at?: string | null
          published_at?: string | null
          published_by?: string | null
          rating_count?: number
          rating_sum?: number
          registration_url?: string | null
          replay_url?: string | null
          scheduled_by?: string | null
          scope_mode?: string
          sector_slug?: string | null
          slug?: string
          starts_at?: string | null
          state?: string
          summary?: string
          timezone?: string
          title?: string
          type_slug?: string
          unpublish_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "offerings_provider_logo_media_id_fkey"
            columns: ["provider_logo_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_sector_slug_fkey"
            columns: ["sector_slug"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "offerings_type_slug_fkey"
            columns: ["type_slug"]
            isOneToOne: false
            referencedRelation: "offering_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          description: string
          is_required: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          is_required?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          is_required?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      opportunity_tags: {
        Row: {
          created_at: string
          description: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          is_active?: boolean
          name: string
          slug: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      opportunity_types: {
        Row: {
          applies_to: string
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          applies_to: string
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          applies_to?: string
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      pathways: {
        Row: {
          created_at: string
          description: string
          is_active: boolean
          name: string
          offer_label: string
          seek_label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          is_active?: boolean
          name: string
          offer_label: string
          seek_label: string
          slug: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          is_active?: boolean
          name?: string
          offer_label?: string
          seek_label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      perk_kinds: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      place_link_types: {
        Row: {
          description: string
          name: string
          single_parent: boolean
          slug: string
        }
        Insert: {
          description: string
          name: string
          single_parent: boolean
          slug: string
        }
        Update: {
          description?: string
          name?: string
          single_parent?: boolean
          slug?: string
        }
        Relationships: []
      }
      place_links: {
        Row: {
          child_slug: string
          created_at: string
          link_type_slug: string
          parent_slug: string
        }
        Insert: {
          child_slug: string
          created_at?: string
          link_type_slug: string
          parent_slug: string
        }
        Update: {
          child_slug?: string
          created_at?: string
          link_type_slug?: string
          parent_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_links_child_slug_fkey"
            columns: ["child_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "place_links_link_type_slug_fkey"
            columns: ["link_type_slug"]
            isOneToOne: false
            referencedRelation: "place_link_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "place_links_parent_slug_fkey"
            columns: ["parent_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
        ]
      }
      place_types: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      places: {
        Row: {
          capital: string | null
          created_at: string
          cultural_review_at: string | null
          cultural_review_note: string | null
          data_confidence: string
          depth_slug: string
          is_published: boolean
          name: string
          reference_source: string | null
          reference_verified: string | null
          slug: string
          summary: string | null
          type_slug: string
          updated_at: string
          url_path: string
          zone: string | null
        }
        Insert: {
          capital?: string | null
          created_at?: string
          cultural_review_at?: string | null
          cultural_review_note?: string | null
          data_confidence?: string
          depth_slug?: string
          is_published?: boolean
          name: string
          reference_source?: string | null
          reference_verified?: string | null
          slug: string
          summary?: string | null
          type_slug: string
          updated_at?: string
          url_path: string
          zone?: string | null
        }
        Update: {
          capital?: string | null
          created_at?: string
          cultural_review_at?: string | null
          cultural_review_note?: string | null
          data_confidence?: string
          depth_slug?: string
          is_published?: boolean
          name?: string
          reference_source?: string | null
          reference_verified?: string | null
          slug?: string
          summary?: string | null
          type_slug?: string
          updated_at?: string
          url_path?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_data_confidence_fkey"
            columns: ["data_confidence"]
            isOneToOne: false
            referencedRelation: "data_confidence_levels"
            referencedColumns: ["label"]
          },
          {
            foreignKeyName: "places_depth_slug_fkey"
            columns: ["depth_slug"]
            isOneToOne: false
            referencedRelation: "publication_depths"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "places_type_slug_fkey"
            columns: ["type_slug"]
            isOneToOne: false
            referencedRelation: "place_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      publication_depths: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      region_priority_sectors: {
        Row: {
          created_at: string
          data_confidence: string
          declared_at: string
          declared_by: string | null
          note: string | null
          place_slug: string
          rank: number
          reference_source: string | null
          reference_verified: string | null
          sector_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_confidence?: string
          declared_at?: string
          declared_by?: string | null
          note?: string | null
          place_slug: string
          rank: number
          reference_source?: string | null
          reference_verified?: string | null
          sector_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_confidence?: string
          declared_at?: string
          declared_by?: string | null
          note?: string | null
          place_slug?: string
          rank?: number
          reference_source?: string | null
          reference_verified?: string | null
          sector_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_priority_sectors_data_confidence_fkey"
            columns: ["data_confidence"]
            isOneToOne: false
            referencedRelation: "data_confidence_levels"
            referencedColumns: ["label"]
          },
          {
            foreignKeyName: "region_priority_sectors_place_slug_fkey"
            columns: ["place_slug"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "region_priority_sectors_sector_slug_fkey"
            columns: ["sector_slug"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["slug"]
          },
        ]
      }
      render_surfaces: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          excerpt: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          state: string
          subject_id: string
          subject_kind: string
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          state?: string
          subject_id: string
          subject_kind: string
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          state?: string
          subject_id?: string
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_handles: {
        Row: {
          handle: string
          norm: string | null
          reason: string
        }
        Insert: {
          handle: string
          norm?: string | null
          reason?: string
        }
        Update: {
          handle?: string
          norm?: string | null
          reason?: string
        }
        Relationships: []
      }
      role_subject_kinds: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
          source_table: string
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
          source_table: string
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
          source_table?: string
        }
        Relationships: []
      }
      role_types: {
        Row: {
          description: string
          grants_need_submission: boolean
          is_active: boolean
          name: string
          requires_verification: boolean
          slug: string
          sort_order: number
          subject_kind: string
        }
        Insert: {
          description: string
          grants_need_submission?: boolean
          is_active?: boolean
          name: string
          requires_verification?: boolean
          slug: string
          sort_order: number
          subject_kind: string
        }
        Update: {
          description?: string
          grants_need_submission?: boolean
          is_active?: boolean
          name?: string
          requires_verification?: boolean
          slug?: string
          sort_order?: number
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_types_subject_kind_fkey"
            columns: ["subject_kind"]
            isOneToOne: false
            referencedRelation: "role_subject_kinds"
            referencedColumns: ["slug"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          member_id: string
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_slug: string
          state: string
          subject_kind: string
          subject_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_slug: string
          state?: string
          subject_kind: string
          subject_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_slug?: string
          state?: string
          subject_kind?: string
          subject_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_role_slug_fkey"
            columns: ["role_slug"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "roles_subject_kind_fkey"
            columns: ["subject_kind"]
            isOneToOne: false
            referencedRelation: "role_subject_kinds"
            referencedColumns: ["slug"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          description: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          is_active?: boolean
          name: string
          slug: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_subject_kinds: {
        Row: {
          description: string
          name: string
          slug: string
          sort_order: number
          source_table: string
        }
        Insert: {
          description: string
          name: string
          slug: string
          sort_order: number
          source_table: string
        }
        Update: {
          description?: string
          name?: string
          slug?: string
          sort_order?: number
          source_table?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          notify: boolean
          state: string
          subject_id: string
          subject_kind: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id: string
          notify?: boolean
          state?: string
          subject_id: string
          subject_kind: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id?: string
          notify?: boolean
          state?: string
          subject_id?: string
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subject_kind_fkey"
            columns: ["subject_kind"]
            isOneToOne: false
            referencedRelation: "subscription_subject_kinds"
            referencedColumns: ["slug"]
          },
        ]
      }
      thread_participants: {
        Row: {
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          member_id: string
          muted: boolean
          thread_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          member_id: string
          muted?: boolean
          thread_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          member_id?: string
          muted?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          archived_at: string | null
          created_at: string
          engagement_id: string | null
          id: string
          kind: string
          last_message_at: string | null
          state: string
          subject: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          engagement_id?: string | null
          id?: string
          kind: string
          last_message_at?: string | null
          state?: string
          subject?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          engagement_id?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          state?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribe_tokens: {
        Row: {
          created_at: string
          kind_slug: string | null
          member_id: string
          scope: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          kind_slug?: string | null
          member_id: string
          scope?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          kind_slug?: string | null
          member_id?: string
          scope?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribe_tokens_kind_slug_fkey"
            columns: ["kind_slug"]
            isOneToOne: false
            referencedRelation: "notification_kinds"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "unsubscribe_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      incomplete_erasures: {
        Row: {
          auth_user_id: string | null
          erased_at: string | null
          member_id: string | null
          reason: string | null
        }
        Insert: {
          auth_user_id?: string | null
          erased_at?: string | null
          member_id?: string | null
          reason?: string | null
        }
        Update: {
          auth_user_id?: string | null
          erased_at?: string | null
          member_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erasure_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_state: { Args: never; Returns: Json }
      activate_membership: {
        Args: { p_handle?: string }
        Returns: {
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
          founding_member: boolean
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
          subdivision: string | null
          timezone: string
          updated_at: string
          user_id: string | null
          welcome_email_sent_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_with_declaration: {
        Args: {
          p_capacity_note?: string
          p_consents: string[]
          p_direction: string
          p_headline: string
          p_months?: number
          p_pathway: string
          p_place: string
          p_policy_version: string
          p_sector?: string
          p_visibility?: string
        }
        Returns: Json
      }
      admin_change_handle: {
        Args: { p_handle: string; p_member: string; p_note: string }
        Returns: undefined
      }
      call_notifier_drain: { Args: never; Returns: number }
      can_message: { Args: { p_from: string; p_to: string }; Returns: boolean }
      can_submit_need: { Args: { p_place_slug: string }; Returns: boolean }
      check_in: { Args: { p_code: string; p_method?: string }; Returns: Json }
      claim_account: { Args: never; Returns: Json }
      claim_due_deliveries: {
        Args: { p_channel?: string; p_limit?: number }
        Returns: {
          body: string
          created_at: string
          delivery_id: string
          digest_key: string
          kind: string
          member_id: string
          notification_id: string
          title: string
          url_path: string
        }[]
      }
      claim_email_batch: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          delivery_id: string
          digest_key: string
          display_name: string
          email: string
          kind: string
          member_id: string
          occurred_at: string
          timezone: string
          title: string
          unsubscribe_token: string
          url_path: string
        }[]
      }
      composer_schema: { Args: { p_type: string }; Returns: Json }
      consume_unsubscribe_token: { Args: { p_token: string }; Returns: Json }
      credential_id: {
        Args: { join_year: number; member_number: number }
        Returns: string
      }
      current_member_id: { Args: never; Returns: string }
      damm_digit: { Args: { digits: string }; Returns: number }
      ensure_unsubscribe_token: { Args: { p_member: string }; Returns: string }
      event_conversion: {
        Args: { p_days?: number; p_offering: string }
        Returns: Json
      }
      event_funnel: { Args: { p_offering: string }; Returns: Json }
      expire_declarations: { Args: never; Returns: number }
      generate_matches_for_declaration: {
        Args: { p_decl: string }
        Returns: number
      }
      generate_matches_for_need: { Args: { p_need: string }; Returns: number }
      get_notifier_config: { Args: never; Returns: Json }
      handle_available: { Args: { candidate: string }; Returns: boolean }
      is_founding_member: {
        Args: { m: Database["public"]["Tables"]["members"]["Row"] }
        Returns: boolean
      }
      is_operator: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_actor: string
          p_kind: string
          p_payload?: Json
          p_place: string
          p_subject_id: string
          p_subject_kind: string
        }
        Returns: undefined
      }
      mark_auth_user_deleted: { Args: { p_member: string }; Returns: undefined }
      mark_delivery_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      mark_delivery_sent: {
        Args: {
          p_id: string
          p_provider: string
          p_provider_message_id: string
        }
        Returns: undefined
      }
      match_candidates_for_need: {
        Args: { p_need: string }
        Returns: {
          declaration_id: string
          member_id: string
          reasons: string[]
          score: number
        }[]
      }
      member_dashboard: { Args: never; Returns: Json }
      member_is_activated: { Args: { p_member: string }; Returns: boolean }
      member_perks: {
        Args: { p_limit?: number }
        Returns: {
          audience: string
          discount_percent: number
          list_currency: string
          list_price: number
          member_currency: string
          member_price: number
          offering_id: string
          perk_kind: string
          place_name: string
          place_slug: string
          registration_url: string
          slug: string
          starts_at: string
          summary: string
          title: string
          type: string
        }[]
      }
      next_send_time: {
        Args: { p_cadence: string; p_member: string }
        Returns: string
      }
      normalize_handle: { Args: { t: string }; Returns: string }
      notifier_config_status: {
        Args: never
        Returns: {
          chars: number
          is_set: boolean
          secret_name: string
        }[]
      }
      notify_watchers_of_need: { Args: { p_need: string }; Returns: number }
      notify_watchers_of_offering: {
        Args: { p_offering: string }
        Returns: number
      }
      offering_card: { Args: { p_id: string }; Returns: Json }
      onboarding_status: { Args: { p_member?: string }; Returns: Json }
      ops_activation: { Args: { p_days?: number }; Returns: Json }
      ops_campaign_board: {
        Args: never
        Returns: {
          band: string
          declarations: number
          depth: string
          districts: number
          districts_partnered: number
          districts_profiled: number
          engagements: number
          last_activity: string
          priority_sectors: number
          published_postings: number
          region_name: string
          region_slug: string
          representatives: number
          watchers: number
        }[]
      }
      ops_data_quality: { Args: never; Returns: Json }
      ops_health: { Args: never; Returns: Json }
      ops_publication_queue: {
        Args: never
        Returns: {
          data_confidence: string
          days_waiting: number
          direction: string
          need_id: string
          place_name: string
          place_slug: string
          reference_source: string
          review_flag: string
          sector: string
          status: string
          submitted_at: string
          title: string
        }[]
      }
      ops_recruit: {
        Args: {
          p_direction?: string
          p_limit?: number
          p_pathway?: string
          p_place: string
          p_sector?: string
        }
        Returns: {
          available_until: string
          capacity_note: string
          declaration_id: string
          declared_place: string
          display_name: string
          headline: string
          member_id: string
          pathway: string
          sector: string
          visibility: string
        }[]
      }
      ops_response_queue: {
        Args: { p_limit?: number }
        Returns: {
          engagement_id: string
          hours_overdue: number
          opened_at: string
          participants: number
          place_name: string
          place_slug: string
          review_due_at: string
          state: string
          title: string
          unsolicited: boolean
        }[]
      }
      place_activity: {
        Args: { p_limit?: number; p_slug: string }
        Returns: {
          kind: string
          name: string
          occurred_at: string
          payload: Json
          place_slug: string
        }[]
      }
      place_descendants: {
        Args: { p_slug: string }
        Returns: {
          slug: string
        }[]
      }
      place_descendants_up: {
        Args: { p_slug: string }
        Returns: {
          slug: string
        }[]
      }
      place_impact: {
        Args: { p_floor?: number; p_slug: string }
        Returns: Json
      }
      places_on_same_chain: { Args: { a: string; b: string }; Returns: boolean }
      pseudonymize_member: {
        Args: { actor?: string; reason?: string; target: string }
        Returns: string
      }
      publish_scheduled_offerings: { Args: never; Returns: number }
      purge_inactive_threads: { Args: never; Returns: number }
      region_payload: { Args: { p_slug: string }; Returns: Json }
      register_member: {
        Args: {
          p_birth_month?: number
          p_birth_year?: number
          p_city?: string
          p_connection_types?: Database["public"]["Enums"]["connection_type"][]
          p_country?: string
          p_display_name?: string
          p_email?: string
          p_first_name?: string
          p_handle?: string
          p_last_name?: string
          p_member_number: number
          p_primary_connection?: Database["public"]["Enums"]["connection_type"]
          p_region_interests?: string[]
          p_subdivision?: string
          p_timezone?: string
        }
        Returns: {
          credential_id: string
          member_id: string
          member_number: number
        }[]
      }
      renew_declaration: {
        Args: { p_declaration: string; p_months?: number }
        Returns: Json
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
      reserve_test_member_number: {
        Args: never
        Returns: {
          credential_id: string
          expires_at: string
          member_number: number
        }[]
      }
      reset_test_account: { Args: { p_email: string }; Returns: Json }
      resolve_delivery: {
        Args: { p_channel: string; p_kind: string; p_member: string }
        Returns: {
          cadence: string
          enabled: boolean
        }[]
      }
      retire_test_member: {
        Args: { p_confirm?: boolean; p_email: string }
        Returns: Json
      }
      set_notifier_secret: {
        Args: { p_name: string; p_value: string }
        Returns: string
      }
      slug_part: { Args: { t: string }; Returns: string }
      suggest_handles: {
        Args: {
          first_name: string
          last_name: string
          want?: number
          wanted?: string
        }
        Returns: {
          basis: string
          handle: string
        }[]
      }
      suppress_address: {
        Args: { p_address: string; p_detail?: string; p_reason: string }
        Returns: undefined
      }
      surface_offerings: {
        Args: {
          p_chapter?: string
          p_limit?: number
          p_place?: string
          p_surface: string
        }
        Returns: {
          audience: string
          chapter_slug: string
          discount_percent: number
          hero_alt: string
          hero_credit: string
          hero_path: string
          list_currency: string
          list_price: number
          offering_id: string
          perk_kind: string
          place_slug: string
          priority: number
          slug: string
          starts_at: string
          summary: string
          title: string
          type: string
          variant: string
        }[]
      }
      verify_credential_id: {
        Args: { candidate: string }
        Returns: {
          join_year: number
          member_number: number
          normalized: string
          valid: boolean
        }[]
      }
      verify_drain_secret: { Args: { p_token: string }; Returns: boolean }
      withdraw_declaration: { Args: { p_declaration: string }; Returns: Json }
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
        | "matching"
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
        | "erased"
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
        "matching",
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
        "erased",
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
