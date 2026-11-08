// Normally generated: `npx supabase gen types typescript --local > src/lib/database.types.ts`.
// The `enquiries`/`product_media`/`products` tables and `product_status`/
// `product_zone` enums (migration 0003_shop_and_enquiries) were added by
// hand instead — this sandbox has no local Supabase to regenerate against
// (docs/decisions.md D-47) — by matching the existing entries' exact shape
// against that migration's SQL. Re-run the real generator once a Supabase
// connection is available, to replace this manual edit with the genuine
// output.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      canvas_nodes: {
        Row: {
          height: number;
          id: string;
          layer: number;
          node_type: string;
          published: boolean;
          ref_id: string | null;
          ref_table: string | null;
          region: string;
          rotation: number;
          width: number;
          x: number;
          y: number;
          zoom_max: number;
          zoom_min: number;
        };
        ComputedFields: never;
        Insert: {
          height: number;
          id?: string;
          layer?: number;
          node_type: string;
          published?: boolean;
          ref_id?: string | null;
          ref_table?: string | null;
          region: string;
          rotation?: number;
          width: number;
          x: number;
          y: number;
          zoom_max?: number;
          zoom_min?: number;
        };
        Update: {
          height?: number;
          id?: string;
          layer?: number;
          node_type?: string;
          published?: boolean;
          ref_id?: string | null;
          ref_table?: string | null;
          region?: string;
          rotation?: number;
          width?: number;
          x?: number;
          y?: number;
          zoom_max?: number;
          zoom_min?: number;
        };
        Relationships: [];
      };
      enquiries: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          ip_hash: string | null;
          message: string;
          name: string;
          product_id: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          ip_hash?: string | null;
          message: string;
          name: string;
          product_id?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          ip_hash?: string | null;
          message?: string;
          name?: string;
          product_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enquiries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_film: {
        Row: {
          captions_path: string | null;
          created_at: string;
          id: string;
          media_id: string;
          published: boolean;
          title: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          captions_path?: string | null;
          created_at?: string;
          id?: string;
          media_id: string;
          published?: boolean;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          captions_path?: string | null;
          created_at?: string;
          id?: string;
          media_id?: string;
          published?: boolean;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_film_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          alt_text: string | null;
          blur_data_url: string | null;
          created_at: string;
          duration_s: number | null;
          height: number | null;
          hls_master: string | null;
          id: string;
          kind: Database["public"]["Enums"]["media_kind"];
          poster_path: string | null;
          renditions: NonNullable<Json>;
          sprite_meta: Json | null;
          sprite_path: string | null;
          status: Database["public"]["Enums"]["media_status"];
          storage_path: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          alt_text?: string | null;
          blur_data_url?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          hls_master?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["media_kind"];
          poster_path?: string | null;
          renditions?: NonNullable<Json>;
          sprite_meta?: Json | null;
          sprite_path?: string | null;
          status?: Database["public"]["Enums"]["media_status"];
          storage_path: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          blur_data_url?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          hls_master?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["media_kind"];
          poster_path?: string | null;
          renditions?: NonNullable<Json>;
          sprite_meta?: Json | null;
          sprite_path?: string | null;
          status?: Database["public"]["Enums"]["media_status"];
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      photo_sets: {
        Row: {
          id: string;
          location: string | null;
          published: boolean;
          shoot_date: string | null;
          sort_order: number;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          location?: string | null;
          published?: boolean;
          shoot_date?: string | null;
          sort_order?: number;
          title: string;
        };
        Update: {
          id?: string;
          location?: string | null;
          published?: boolean;
          shoot_date?: string | null;
          sort_order?: number;
          title?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          media_id: string;
          set_id: string;
          sort_order: number;
          taken_on: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          media_id: string;
          set_id: string;
          sort_order?: number;
          taken_on?: string | null;
          title: string;
        };
        Update: {
          id?: string;
          media_id?: string;
          set_id?: string;
          sort_order?: number;
          taken_on?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photos_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_set_id_fkey";
            columns: ["set_id"];
            isOneToOne: false;
            referencedRelation: "photo_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      product_media: {
        Row: {
          id: string;
          kind: string;
          media_id: string;
          product_id: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          kind: string;
          media_id: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          kind?: string;
          media_id?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_media_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          bullets: NonNullable<Json>;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          on_sale: boolean;
          poster_media_id: string | null;
          price_amount: number;
          price_currency: string;
          published: boolean;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["product_status"];
          updated_at: string;
          video_media_id: string | null;
          zone: Database["public"]["Enums"]["product_zone"];
        };
        ComputedFields: never;
        Insert: {
          bullets?: NonNullable<Json>;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          on_sale?: boolean;
          poster_media_id?: string | null;
          price_amount: number;
          price_currency?: string;
          published?: boolean;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_status"];
          updated_at?: string;
          video_media_id?: string | null;
          zone?: Database["public"]["Enums"]["product_zone"];
        };
        Update: {
          bullets?: NonNullable<Json>;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          on_sale?: boolean;
          poster_media_id?: string | null;
          price_amount?: number;
          price_currency?: string;
          published?: boolean;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["product_status"];
          updated_at?: string;
          video_media_id?: string | null;
          zone?: Database["public"]["Enums"]["product_zone"];
        };
        Relationships: [
          {
            foreignKeyName: "products_poster_media_id_fkey";
            columns: ["poster_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_video_media_id_fkey";
            columns: ["video_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      viewpoints: {
        Row: {
          in_guided_path: boolean;
          key: string;
          label: string;
          sort_order: number;
          x: number;
          y: number;
          zoom: number;
        };
        ComputedFields: never;
        Insert: {
          in_guided_path?: boolean;
          key: string;
          label: string;
          sort_order?: number;
          x: number;
          y: number;
          zoom: number;
        };
        Update: {
          in_guided_path?: boolean;
          key?: string;
          label?: string;
          sort_order?: number;
          x?: number;
          y?: number;
          zoom?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      media_kind: "image" | "video" | "hls";
      media_status: "processing" | "ready" | "failed";
      product_status: "available" | "sold" | "made_to_order";
      product_zone: "wall" | "floor";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      media_kind: ["image", "video", "hls"],
      media_status: ["processing", "ready", "failed"],
      product_status: ["available", "sold", "made_to_order"],
      product_zone: ["wall", "floor"],
    },
  },
} as const;
