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
      delivery_routes: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          destination_lat: number
          destination_lng: number
          destination_name: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          destination_lat: number
          destination_lng: number
          destination_name: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_work_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_ids: string[]
          notes: string | null
          quotation_id: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_ids?: string[]
          notes?: string | null
          quotation_id: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_ids?: string[]
          notes?: string | null
          quotation_id?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_work_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_work_orders_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      main_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      measurement_tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          customer_place: string
          draft_quotation_id: string | null
          id: string
          requirement: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_place: string
          draft_quotation_id?: string | null
          id?: string
          requirement?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_place?: string
          draft_quotation_id?: string | null
          id?: string
          requirement?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_tasks_draft_quotation_id_fkey"
            columns: ["draft_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_colors: string[] | null
          cost_price: number | null
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          main_category_id: string
          material: string | null
          mrp: number
          offer_price: number | null
          product_code: string
          product_name: string
          stock_quantity: number
          sub_category_id: string | null
          updated_at: string
        }
        Insert: {
          available_colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          main_category_id: string
          material?: string | null
          mrp: number
          offer_price?: number | null
          product_code: string
          product_name: string
          stock_quantity?: number
          sub_category_id?: string | null
          updated_at?: string
        }
        Update: {
          available_colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          main_category_id?: string
          material?: string | null
          mrp?: number
          offer_price?: number | null
          product_code?: string
          product_name?: string
          stock_quantity?: number
          sub_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      quotation_counters: {
        Row: {
          last_serial: number
          scope: string
        }
        Insert: {
          last_serial?: number
          scope: string
        }
        Update: {
          last_serial?: number
          scope?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          amount: number
          catalog_image_url: string | null
          catalog_text: string | null
          created_at: string
          description: string
          display_order: number
          id: string
          item_image_url: string | null
          measurement: string | null
          measurement_image_url: string | null
          product_id: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          catalog_image_url?: string | null
          catalog_text?: string | null
          created_at?: string
          description: string
          display_order?: number
          id?: string
          item_image_url?: string | null
          measurement?: string | null
          measurement_image_url?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          catalog_image_url?: string | null
          catalog_text?: string | null
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          item_image_url?: string | null
          measurement?: string | null
          measurement_image_url?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          advance_amount: number
          created_at: string
          created_by: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          discount_amount: number
          expected_delivery_date: string | null
          gst_amount: number
          gst_percent: number
          id: string
          notes: string | null
          party_address: string | null
          party_name: string
          party_phone: string | null
          party_place: string
          quotation_date: string
          quotation_id: string
          source_task_id: string | null
          status: string
          subtotal: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          advance_amount?: number
          created_at?: string
          created_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          notes?: string | null
          party_address?: string | null
          party_name: string
          party_phone?: string | null
          party_place: string
          quotation_date?: string
          quotation_id: string
          source_task_id?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          advance_amount?: number
          created_at?: string
          created_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          notes?: string | null
          party_address?: string | null
          party_name?: string
          party_phone?: string | null
          party_place?: string
          quotation_date?: string
          quotation_id?: string
          source_task_id?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_delivery_route_id_fkey"
            columns: ["delivery_route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_waypoints: {
        Row: {
          created_at: string
          display_order: number
          id: string
          lat: number
          lng: number
          name: string
          route_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          lat: number
          lng: number
          name: string
          route_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_waypoints_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          main_category_id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          main_category_id: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          main_category_id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_quotations: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          quotation_id: string
          stop_order: number
          trip_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          quotation_id: string
          stop_order?: number
          trip_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          quotation_id?: string
          stop_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_quotations_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_quotations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          assigned_driver_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          route_id: string | null
          status: string
          trip_date: string
          updated_at: string
        }
        Insert: {
          assigned_driver_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          status?: string
          trip_date?: string
          updated_at?: string
        }
        Update: {
          assigned_driver_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          status?: string
          trip_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
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
      workers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          trade: string | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string
          whatsapp_number?: string
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
      next_quotation_id: {
        Args: { _party: string; _place: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "measurement_staff" | "delivery"
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
      app_role: ["admin", "staff", "measurement_staff", "delivery"],
    },
  },
} as const
