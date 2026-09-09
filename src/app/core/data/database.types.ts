export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      analytics_daily: {
        Row: {
          business_id: string;
          day: string;
          event_count: number;
          event_type: Database['public']['Enums']['analytics_event_type'];
          updated_at: string;
        };
        Insert: {
          business_id: string;
          day: string;
          event_count?: number;
          event_type: Database['public']['Enums']['analytics_event_type'];
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          day?: string;
          event_count?: number;
          event_type?: Database['public']['Enums']['analytics_event_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_daily_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_events: {
        Row: {
          business_id: string | null;
          created_at: string;
          event_type: Database['public']['Enums']['analytics_event_type'];
          id: number;
          landing_path: string | null;
          metadata: Json;
          referrer_host: string | null;
          session_id: string;
        };
        Insert: {
          business_id?: string | null;
          created_at?: string;
          event_type: Database['public']['Enums']['analytics_event_type'];
          id?: never;
          landing_path?: string | null;
          metadata?: Json;
          referrer_host?: string | null;
          session_id: string;
        };
        Update: {
          business_id?: string | null;
          created_at?: string;
          event_type?: Database['public']['Enums']['analytics_event_type'];
          id?: never;
          landing_path?: string | null;
          metadata?: Json;
          referrer_host?: string | null;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_hours: {
        Row: {
          business_id: string;
          closes_at: string | null;
          created_at: string;
          day_of_week: number;
          id: string;
          is_24h: boolean;
          is_closed: boolean;
          opens_at: string | null;
        };
        Insert: {
          business_id: string;
          closes_at?: string | null;
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_24h?: boolean;
          is_closed?: boolean;
          opens_at?: string | null;
        };
        Update: {
          business_id?: string;
          closes_at?: string | null;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_24h?: boolean;
          is_closed?: boolean;
          opens_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'business_hours_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_locations: {
        Row: {
          business_id: string;
          created_at: string;
          is_primary: boolean;
          location_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          is_primary?: boolean;
          location_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          is_primary?: boolean;
          location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_locations_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'business_locations_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      business_media: {
        Row: {
          alt_text: string | null;
          business_id: string;
          created_at: string;
          id: string;
          media_type: Database['public']['Enums']['media_type'];
          sort_order: number;
          storage_path: string;
        };
        Insert: {
          alt_text?: string | null;
          business_id: string;
          created_at?: string;
          id?: string;
          media_type?: Database['public']['Enums']['media_type'];
          sort_order?: number;
          storage_path: string;
        };
        Update: {
          alt_text?: string | null;
          business_id?: string;
          created_at?: string;
          id?: string;
          media_type?: Database['public']['Enums']['media_type'];
          sort_order?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_media_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_services: {
        Row: {
          business_id: string;
          created_at: string;
          service_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          service_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_services_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'business_services_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      business_slug_history: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          old_slug: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          old_slug: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          old_slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_slug_history_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      businesses: {
        Row: {
          address: string | null;
          business_name: string;
          category_id: string;
          city: string;
          claimed_at: string | null;
          created_at: string;
          description: string | null;
          district: string | null;
          driver_name: string | null;
          geo: unknown;
          google_maps_url: string | null;
          id: string;
          last_verified_at: string | null;
          latitude: number | null;
          longitude: number | null;
          name_normalized: string | null;
          neighborhood: string | null;
          owner_id: string | null;
          phone_display: string | null;
          phone_e164: string | null;
          plan: Database['public']['Enums']['business_plan'];
          possible_duplicate_of: string | null;
          slug: string;
          source_note: string | null;
          source_type: Database['public']['Enums']['source_type'];
          status: Database['public']['Enums']['business_status'];
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_by: string | null;
          website: string | null;
          whatsapp_e164: string | null;
        };
        Insert: {
          address?: string | null;
          business_name: string;
          category_id: string;
          city?: string;
          claimed_at?: string | null;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          driver_name?: string | null;
          geo?: unknown;
          google_maps_url?: string | null;
          id?: string;
          last_verified_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name_normalized?: string | null;
          neighborhood?: string | null;
          owner_id?: string | null;
          phone_display?: string | null;
          phone_e164?: string | null;
          plan?: Database['public']['Enums']['business_plan'];
          possible_duplicate_of?: string | null;
          slug: string;
          source_note?: string | null;
          source_type: Database['public']['Enums']['source_type'];
          status?: Database['public']['Enums']['business_status'];
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_by?: string | null;
          website?: string | null;
          whatsapp_e164?: string | null;
        };
        Update: {
          address?: string | null;
          business_name?: string;
          category_id?: string;
          city?: string;
          claimed_at?: string | null;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          driver_name?: string | null;
          geo?: unknown;
          google_maps_url?: string | null;
          id?: string;
          last_verified_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name_normalized?: string | null;
          neighborhood?: string | null;
          owner_id?: string | null;
          phone_display?: string | null;
          phone_e164?: string | null;
          plan?: Database['public']['Enums']['business_plan'];
          possible_duplicate_of?: string | null;
          slug?: string;
          source_note?: string | null;
          source_type?: Database['public']['Enums']['source_type'];
          status?: Database['public']['Enums']['business_status'];
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_by?: string | null;
          website?: string | null;
          whatsapp_e164?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'businesses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'businesses_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'businesses_possible_duplicate_of_fkey';
            columns: ['possible_duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'businesses_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      claims: {
        Row: {
          approved_at: string | null;
          business_id: string;
          contact_phone_e164: string | null;
          id: string;
          note: string | null;
          rejected_at: string | null;
          reviewed_by: string | null;
          reviewer_note: string | null;
          status: Database['public']['Enums']['claim_status'];
          submitted_at: string;
          user_id: string;
          verification_method: Database['public']['Enums']['verification_method'];
        };
        Insert: {
          approved_at?: string | null;
          business_id: string;
          contact_phone_e164?: string | null;
          id?: string;
          note?: string | null;
          rejected_at?: string | null;
          reviewed_by?: string | null;
          reviewer_note?: string | null;
          status?: Database['public']['Enums']['claim_status'];
          submitted_at?: string;
          user_id: string;
          verification_method?: Database['public']['Enums']['verification_method'];
        };
        Update: {
          approved_at?: string | null;
          business_id?: string;
          contact_phone_e164?: string | null;
          id?: string;
          note?: string | null;
          rejected_at?: string | null;
          reviewed_by?: string | null;
          reviewer_note?: string | null;
          status?: Database['public']['Enums']['claim_status'];
          submitted_at?: string;
          user_id?: string;
          verification_method?: Database['public']['Enums']['verification_method'];
        };
        Relationships: [
          {
            foreignKeyName: 'claims_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claims_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claims_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      landing_pages: {
        Row: {
          created_at: string;
          h1: string;
          id: string;
          intro: string | null;
          is_published: boolean;
          location_id: string | null;
          meta_description: string | null;
          min_business_count: number;
          service_id: string | null;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          h1: string;
          id?: string;
          intro?: string | null;
          is_published?: boolean;
          location_id?: string | null;
          meta_description?: string | null;
          min_business_count?: number;
          service_id?: string | null;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          h1?: string;
          id?: string;
          intro?: string | null;
          is_published?: boolean;
          location_id?: string | null;
          meta_description?: string | null;
          min_business_count?: number;
          service_id?: string | null;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'landing_pages_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'landing_pages_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          name: string;
          parent_id: string | null;
          slug: string;
          source_note: string | null;
          source_type: Database['public']['Enums']['source_type'];
          type: Database['public']['Enums']['location_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          parent_id?: string | null;
          slug: string;
          source_note?: string | null;
          source_type?: Database['public']['Enums']['source_type'];
          type: Database['public']['Enums']['location_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          source_note?: string | null;
          source_type?: Database['public']['Enums']['source_type'];
          type?: Database['public']['Enums']['location_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone_e164: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone_e164?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone_e164?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      removal_requests: {
        Row: {
          business_id: string;
          contact_email: string | null;
          created_at: string;
          id: string;
          reason: string;
          requested_by: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['removal_request_status'];
        };
        Insert: {
          business_id: string;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          reason: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['removal_request_status'];
        };
        Update: {
          business_id?: string;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          reason?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['removal_request_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'removal_requests_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'removal_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'removal_requests_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          author_id: string | null;
          business_id: string;
          created_at: string;
          id: string;
          rating: number;
          review_text: string | null;
          status: Database['public']['Enums']['review_status'];
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          business_id: string;
          created_at?: string;
          id?: string;
          rating: number;
          review_text?: string | null;
          status?: Database['public']['Enums']['review_status'];
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          business_id?: string;
          created_at?: string;
          id?: string;
          rating?: number;
          review_text?: string | null;
          status?: Database['public']['Enums']['review_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      landing_page_stats: {
        Row: {
          business_count: number | null;
          h1: string | null;
          id: string | null;
          intro: string | null;
          is_indexable: boolean | null;
          is_published: boolean | null;
          location_id: string | null;
          meta_description: string | null;
          min_business_count: number | null;
          service_id: string | null;
          slug: string | null;
          sort_order: number | null;
          title: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'landing_pages_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'landing_pages_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      admin_quick_add_business: {
        Args: {
          p_address?: string;
          p_business_name: string;
          p_description?: string;
          p_district?: string;
          p_neighborhood?: string;
          p_phone?: string;
          p_website?: string;
          p_whatsapp?: string;
        };
        Returns: {
          id: string;
          slug: string;
        }[];
      };
      approve_claim: {
        Args: { p_claim_id: string; p_note?: string };
        Returns: undefined;
      };
      can_write_business_media: {
        Args: { object_name: string };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      nearby_businesses: {
        Args: { lat: number; lon: number; radius_meters?: number };
        Returns: {
          business_name: string;
          distance_meters: number;
          district: string;
          google_maps_url: string;
          id: string;
          last_verified_at: string;
          neighborhood: string;
          phone_display: string;
          phone_e164: string;
          plan: Database['public']['Enums']['business_plan'];
          slug: string;
          verification_status: Database['public']['Enums']['verification_status'];
          whatsapp_e164: string;
        }[];
      };
      normalize_name: { Args: { value: string }; Returns: string };
      normalize_tr_phone: { Args: { value: string }; Returns: string };
      prune_analytics_events: {
        Args: { retention_days?: number };
        Returns: number;
      };
      reject_claim: {
        Args: { p_claim_id: string; p_note?: string };
        Returns: undefined;
      };
      request_business_removal: {
        Args: {
          p_business_id: string;
          p_contact_email?: string;
          p_reason: string;
        };
        Returns: {
          id: string;
        }[];
      };
      resolve_missing_business_slug: {
        Args: { target_slug: string };
        Returns: Database['public']['CompositeTypes']['slug_resolution'];
        SetofOptions: {
          from: '*';
          to: 'slug_resolution';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      rollup_analytics_daily: { Args: { target_day?: string }; Returns: number };
      slugify: { Args: { value: string }; Returns: string };
      submit_business:
        | {
            Args: {
              p_address?: string;
              p_business_name: string;
              p_description?: string;
              p_district?: string;
              p_neighborhood?: string;
              p_phone?: string;
              p_website?: string;
              p_whatsapp?: string;
            };
            Returns: {
              id: string;
              possible_duplicate: boolean;
              slug: string;
            }[];
          }
        | {
            Args: {
              p_address?: string;
              p_business_name: string;
              p_description?: string;
              p_district?: string;
              p_driver_name?: string;
              p_neighborhood?: string;
              p_phone?: string;
              p_website?: string;
              p_whatsapp?: string;
            };
            Returns: {
              id: string;
              possible_duplicate: boolean;
              slug: string;
            }[];
          };
      unique_business_slug: { Args: { base_name: string }; Returns: string };
    };
    Enums: {
      analytics_event_type:
        | 'profile_view'
        | 'call_click'
        | 'whatsapp_click'
        | 'directions_click'
        | 'website_click'
        | 'claim_started'
        | 'claim_completed'
        | 'listing_submitted'
        | 'listing_approved'
        | 'search_performed';
      business_plan: 'free' | 'pro' | 'premium';
      business_status: 'pending' | 'active' | 'suspended' | 'rejected' | 'archived';
      claim_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      location_type:
        | 'city'
        | 'district'
        | 'neighborhood'
        | 'landmark'
        | 'airport'
        | 'hospital'
        | 'university'
        | 'bus_station';
      media_type: 'logo' | 'photo' | 'cover';
      removal_request_status: 'pending' | 'completed' | 'dismissed';
      review_status: 'pending' | 'approved' | 'rejected';
      source_type:
        'manual' | 'public_business_listing' | 'owner_submitted' | 'owner_verified' | 'osm';
      user_role: 'customer' | 'business_owner' | 'admin';
      verification_method: 'phone_otp' | 'callback' | 'document' | 'manual_admin';
      verification_status: 'unverified' | 'pending' | 'verified' | 'owner_claimed';
    };
    CompositeTypes: {
      slug_resolution: {
        outcome: string | null;
        new_slug: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      analytics_event_type: [
        'profile_view',
        'call_click',
        'whatsapp_click',
        'directions_click',
        'website_click',
        'claim_started',
        'claim_completed',
        'listing_submitted',
        'listing_approved',
        'search_performed',
      ],
      business_plan: ['free', 'pro', 'premium'],
      business_status: ['pending', 'active', 'suspended', 'rejected', 'archived'],
      claim_status: ['pending', 'approved', 'rejected', 'cancelled'],
      location_type: [
        'city',
        'district',
        'neighborhood',
        'landmark',
        'airport',
        'hospital',
        'university',
        'bus_station',
      ],
      media_type: ['logo', 'photo', 'cover'],
      removal_request_status: ['pending', 'completed', 'dismissed'],
      review_status: ['pending', 'approved', 'rejected'],
      source_type: [
        'manual',
        'public_business_listing',
        'owner_submitted',
        'owner_verified',
        'osm',
      ],
      user_role: ['customer', 'business_owner', 'admin'],
      verification_method: ['phone_otp', 'callback', 'document', 'manual_admin'],
      verification_status: ['unverified', 'pending', 'verified', 'owner_claimed'],
    },
  },
} as const;
