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
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      customer_complaints: {
        Row: {
          complaint_code: string
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          customer_place: string
          deleted_at: string | null
          deleted_by: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          id: string
          issue_description: string
          notes: string | null
          original_quotation_code: string | null
          original_quotation_id: string | null
          paid_parts_amount: number
          paid_parts_description: string | null
          photos: string | null
          service_quotation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          complaint_code: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_place: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          id?: string
          issue_description: string
          notes?: string | null
          original_quotation_code?: string | null
          original_quotation_id?: string | null
          paid_parts_amount?: number
          paid_parts_description?: string | null
          photos?: string | null
          service_quotation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          complaint_code?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_place?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          id?: string
          issue_description?: string
          notes?: string | null
          original_quotation_code?: string | null
          original_quotation_id?: string | null
          paid_parts_amount?: number
          paid_parts_description?: string | null
          photos?: string | null
          service_quotation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_complaints_delivery_route_id_fkey"
            columns: ["delivery_route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_original_quotation_id_fkey"
            columns: ["original_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_complaints_service_quotation_id_fkey"
            columns: ["service_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_services: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          customer_place: string
          deleted_at: string | null
          deleted_by: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          estimated_cost: number
          id: string
          item_description: string
          notes: string | null
          photos: string | null
          quotation_id: string | null
          service_code: string
          status: string
          updated_at: string
          work_needed: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_place: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          estimated_cost?: number
          id?: string
          item_description: string
          notes?: string | null
          photos?: string | null
          quotation_id?: string | null
          service_code: string
          status?: string
          updated_at?: string
          work_needed?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_place?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          estimated_cost?: number
          id?: string
          item_description?: string
          notes?: string | null
          photos?: string | null
          quotation_id?: string | null
          service_code?: string
          status?: string
          updated_at?: string
          work_needed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_services_delivery_route_id_fkey"
            columns: ["delivery_route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_services_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      homepage_hero_slides: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_link: string | null
          display_order: number
          headline: string | null
          id: string
          image_url: string
          is_visible: boolean
          subheadline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          display_order?: number
          headline?: string | null
          id?: string
          image_url: string
          is_visible?: boolean
          subheadline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          display_order?: number
          headline?: string | null
          id?: string
          image_url?: string
          is_visible?: boolean
          subheadline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          body: string | null
          created_at: string
          cta_label: string | null
          cta_link: string | null
          display_order: number
          eyebrow: string | null
          id: string
          image_url: string | null
          image_urls: string | null
          is_visible: boolean
          section_key: string
          style_preset: string
          text_align: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          display_order?: number
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string | null
          is_visible?: boolean
          section_key: string
          style_preset?: string
          text_align?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          display_order?: number
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string | null
          is_visible?: boolean
          section_key?: string
          style_preset?: string
          text_align?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      homepage_settings: {
        Row: {
          address_lines: string[]
          brand_tagline: string
          contact_email: string | null
          contact_phone: string | null
          contact_phone_secondary: string | null
          created_at: string
          facebook_url: string | null
          footer_about: string | null
          google_maps_embed_url: string | null
          google_maps_url: string | null
          hero_arch_image_url: string | null
          hero_brand_text: string | null
          hero_caption_eyebrow: string | null
          hero_caption_title: string | null
          hero_glass_door_image_url: string | null
          hero_headline_line1: string | null
          hero_headline_line2: string | null
          hero_interior_image_url: string | null
          hero_scroll_hint: string | null
          hide_public_prices: boolean
          id: string
          instagram_url: string | null
          managing_partner: string | null
          show_google_review: boolean
          show_hero_text: boolean
          show_hero_window: boolean
          singleton: boolean
          updated_at: string
          whatsapp_default_message: string
          whatsapp_number: string
        }
        Insert: {
          address_lines?: string[]
          brand_tagline?: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_phone_secondary?: string | null
          created_at?: string
          facebook_url?: string | null
          footer_about?: string | null
          google_maps_embed_url?: string | null
          google_maps_url?: string | null
          hero_arch_image_url?: string | null
          hero_brand_text?: string | null
          hero_caption_eyebrow?: string | null
          hero_caption_title?: string | null
          hero_glass_door_image_url?: string | null
          hero_headline_line1?: string | null
          hero_headline_line2?: string | null
          hero_interior_image_url?: string | null
          hero_scroll_hint?: string | null
          hide_public_prices?: boolean
          id?: string
          instagram_url?: string | null
          managing_partner?: string | null
          show_google_review?: boolean
          show_hero_text?: boolean
          show_hero_window?: boolean
          singleton?: boolean
          updated_at?: string
          whatsapp_default_message?: string
          whatsapp_number?: string
        }
        Update: {
          address_lines?: string[]
          brand_tagline?: string
          contact_email?: string | null
          contact_phone?: string | null
          contact_phone_secondary?: string | null
          created_at?: string
          facebook_url?: string | null
          footer_about?: string | null
          google_maps_embed_url?: string | null
          google_maps_url?: string | null
          hero_arch_image_url?: string | null
          hero_brand_text?: string | null
          hero_caption_eyebrow?: string | null
          hero_caption_title?: string | null
          hero_glass_door_image_url?: string | null
          hero_headline_line1?: string | null
          hero_headline_line2?: string | null
          hero_interior_image_url?: string | null
          hero_scroll_hint?: string | null
          hide_public_prices?: boolean
          id?: string
          instagram_url?: string | null
          managing_partner?: string | null
          show_google_review?: boolean
          show_hero_text?: boolean
          show_hero_window?: boolean
          singleton?: boolean
          updated_at?: string
          whatsapp_default_message?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      job_work_orders: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_urgent: boolean
          item_ids: string[]
          job_type: string
          notes: string | null
          quotation_id: string | null
          share_token: string | null
          source_complaint_id: string | null
          source_service_id: string | null
          status: string
          status_updated_at: string
          updated_at: string
          warehouse_status: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_urgent?: boolean
          item_ids?: string[]
          job_type?: string
          notes?: string | null
          quotation_id?: string | null
          share_token?: string | null
          source_complaint_id?: string | null
          source_service_id?: string | null
          status?: string
          status_updated_at?: string
          updated_at?: string
          warehouse_status?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_urgent?: boolean
          item_ids?: string[]
          job_type?: string
          notes?: string | null
          quotation_id?: string | null
          share_token?: string | null
          source_complaint_id?: string | null
          source_service_id?: string | null
          status?: string
          status_updated_at?: string
          updated_at?: string
          warehouse_status?: string
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
            foreignKeyName: "job_work_orders_source_complaint_id_fkey"
            columns: ["source_complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_work_orders_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: false
            referencedRelation: "customer_services"
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
          deleted_at: string | null
          deleted_by: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
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
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          customer_place: string
          deleted_at: string | null
          deleted_by: string | null
          draft_quotation_id: string | null
          id: string
          requirement: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_place: string
          deleted_at?: string | null
          deleted_by?: string | null
          draft_quotation_id?: string | null
          id?: string
          requirement?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_place?: string
          deleted_at?: string | null
          deleted_by?: string | null
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
      pipeline_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          quotation_id: string
          read_at: string | null
          read_by: string | null
          stage: number
          target_role: Database["public"]["Enums"]["app_role"]
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          quotation_id: string
          read_at?: string | null
          read_by?: string | null
          stage: number
          target_role: Database["public"]["Enums"]["app_role"]
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          quotation_id?: string
          read_at?: string | null
          read_by?: string | null
          stage?: number
          target_role?: Database["public"]["Enums"]["app_role"]
          title?: string
        }
        Relationships: []
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
      product_locations: {
        Row: {
          building: string
          created_at: string
          display_order: number
          floor: string
          id: string
          is_active: boolean
          section: string | null
          updated_at: string
        }
        Insert: {
          building: string
          created_at?: string
          display_order?: number
          floor: string
          id?: string
          is_active?: boolean
          section?: string | null
          updated_at?: string
        }
        Update: {
          building?: string
          created_at?: string
          display_order?: number
          floor?: string
          id?: string
          is_active?: boolean
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_variant_stock: {
        Row: {
          created_at: string
          floor_display_order: number
          id: string
          location_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          floor_display_order?: number
          id?: string
          location_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          floor_display_order?: number
          id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "product_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color_hex: string | null
          color_name: string
          created_at: string
          display_order: number
          floor_display_order: number
          id: string
          image_url: string | null
          location_id: string | null
          product_id: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          color_hex?: string | null
          color_name: string
          created_at?: string
          display_order?: number
          floor_display_order?: number
          id?: string
          image_url?: string | null
          location_id?: string | null
          product_id: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          color_hex?: string | null
          color_name?: string
          created_at?: string
          display_order?: number
          floor_display_order?: number
          id?: string
          image_url?: string | null
          location_id?: string | null
          product_id?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
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
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          dimensions: string | null
          floor_display_order: number
          id: string
          is_featured: boolean
          is_published: boolean
          location_id: string | null
          main_category_id: string
          material: string | null
          mrp: number
          offer_price: number | null
          product_code: string
          product_name: string
          reorder_level: number
          stock_quantity: number
          stock_status: string
          sub_category_id: string | null
          updated_at: string
        }
        Insert: {
          available_colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          dimensions?: string | null
          floor_display_order?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          location_id?: string | null
          main_category_id: string
          material?: string | null
          mrp: number
          offer_price?: number | null
          product_code: string
          product_name: string
          reorder_level?: number
          stock_quantity?: number
          stock_status?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Update: {
          available_colors?: string[] | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          dimensions?: string | null
          floor_display_order?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          location_id?: string | null
          main_category_id?: string
          material?: string | null
          mrp?: number
          offer_price?: number | null
          product_code?: string
          product_name?: string
          reorder_level?: number
          stock_quantity?: number
          stock_status?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "product_locations"
            referencedColumns: ["id"]
          },
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
      quotation_attached_notes: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          display_order: number
          file_type: string
          file_url: string
          id: string
          quotation_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_type?: string
          file_url: string
          id?: string
          quotation_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          file_type?: string
          file_url?: string
          id?: string
          quotation_id?: string
          updated_at?: string
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
          delivered_at: string | null
          description: string
          dispatched_at: string | null
          display_order: number
          fulfillment_route: string
          id: string
          item_image_url: string | null
          measurement: string | null
          measurement_image_url: string | null
          product_id: string | null
          quantity: number
          quotation_id: string
          site_photos: string | null
          sketch_url: string | null
          unit_price: number
        }
        Insert: {
          amount?: number
          catalog_image_url?: string | null
          catalog_text?: string | null
          created_at?: string
          delivered_at?: string | null
          description: string
          dispatched_at?: string | null
          display_order?: number
          fulfillment_route?: string
          id?: string
          item_image_url?: string | null
          measurement?: string | null
          measurement_image_url?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id: string
          site_photos?: string | null
          sketch_url?: string | null
          unit_price?: number
        }
        Update: {
          amount?: number
          catalog_image_url?: string | null
          catalog_text?: string | null
          created_at?: string
          delivered_at?: string | null
          description?: string
          dispatched_at?: string | null
          display_order?: number
          fulfillment_route?: string
          id?: string
          item_image_url?: string | null
          measurement?: string | null
          measurement_image_url?: string | null
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          site_photos?: string | null
          sketch_url?: string | null
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
      quotation_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          quotation_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          quotation_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          quotation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_status_history_quotation_id_fkey"
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
          deleted_at: string | null
          deleted_by: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          discount_amount: number
          document_type: string
          expected_delivery_date: string | null
          gst_amount: number
          gst_percent: number
          id: string
          is_direct_order: boolean
          lead_type: string
          notes: string | null
          party_address: string | null
          party_name: string
          party_phone: string | null
          party_place: string
          pipeline_stage: number
          quotation_date: string
          quotation_id: string
          salesperson_name: string | null
          service_type: string
          share_token: string | null
          show_price_to_delivery: boolean
          source_complaint_id: string | null
          source_service_id: string | null
          source_task_id: string | null
          status: string
          submitted_for_pricing_at: string | null
          subtotal: number
          terms: string | null
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advance_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          document_type?: string
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          is_direct_order?: boolean
          lead_type?: string
          notes?: string | null
          party_address?: string | null
          party_name: string
          party_phone?: string | null
          party_place: string
          pipeline_stage?: number
          quotation_date?: string
          quotation_id: string
          salesperson_name?: string | null
          service_type?: string
          share_token?: string | null
          show_price_to_delivery?: boolean
          source_complaint_id?: string | null
          source_service_id?: string | null
          source_task_id?: string | null
          status?: string
          submitted_for_pricing_at?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advance_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          document_type?: string
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          is_direct_order?: boolean
          lead_type?: string
          notes?: string | null
          party_address?: string | null
          party_name?: string
          party_phone?: string | null
          party_place?: string
          pipeline_stage?: number
          quotation_date?: string
          quotation_id?: string
          salesperson_name?: string | null
          service_type?: string
          share_token?: string | null
          show_price_to_delivery?: boolean
          source_complaint_id?: string | null
          source_service_id?: string | null
          source_task_id?: string | null
          status?: string
          submitted_for_pricing_at?: string | null
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_delivery_route_id_fkey"
            columns: ["delivery_route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_source_complaint_id_fkey"
            columns: ["source_complaint_id"]
            isOneToOne: false
            referencedRelation: "customer_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: false
            referencedRelation: "customer_services"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          batch: number
          bill_no: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          notes: string | null
          pending_amount: number
          phone: string | null
          place: string | null
          raw_text: string | null
          updated_at: string
        }
        Insert: {
          batch?: number
          bill_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number
          phone?: string | null
          place?: string | null
          raw_text?: string | null
          updated_at?: string
        }
        Update: {
          batch?: number
          bill_no?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          pending_amount?: number
          phone?: string | null
          place?: string | null
          raw_text?: string | null
          updated_at?: string
        }
        Relationships: []
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
      stock_movements: {
        Row: {
          change_qty: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          reason: string
          resulting_stock: number
        }
        Insert: {
          change_qty: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          reason: string
          resulting_stock: number
        }
        Update: {
          change_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          reason?: string
          resulting_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          has_issue: boolean
          id: string
          issue_note: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          has_issue?: boolean
          id?: string
          issue_note?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          has_issue?: boolean
          id?: string
          issue_note?: string | null
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
      worker_status_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          note: string | null
          photo_url: string | null
          status: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          note?: string | null
          photo_url?: string | null
          status: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          note?: string | null
          photo_url?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_status_updates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_status_updates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          login_phone: string | null
          name: string
          notes: string | null
          phone: string | null
          trade: string | null
          updated_at: string
          user_id: string | null
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          login_phone?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          login_phone?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          trade?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backlog_pin_is_set: { Args: never; Returns: boolean }
      catalog_pin_is_set: { Args: never; Returns: boolean }
      current_worker_id: { Args: never; Returns: string }
      get_shared_job_work_order: { Args: { p_token: string }; Returns: Json }
      get_shared_quotation: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_complaint_id: { Args: never; Returns: string }
      next_po_id: { Args: { _party: string; _place: string }; Returns: string }
      next_quotation_id: {
        Args: { _party: string; _place: string }
        Returns: string
      }
      next_service_id: { Args: never; Returns: string }
      purge_old_trash: {
        Args: never
        Returns: {
          removed: number
          table_name: string
        }[]
      }
      set_backlog_pin: { Args: { _pin: string }; Returns: undefined }
      set_catalog_pin: { Args: { _pin: string }; Returns: undefined }
      set_quotation_stage: {
        Args: {
          _body: string
          _quotation_id: string
          _stage: number
          _target_role: Database["public"]["Enums"]["app_role"]
          _title: string
        }
        Returns: undefined
      }
      verify_backlog_pin: { Args: { _pin: string }; Returns: boolean }
      verify_catalog_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "measurement_staff"
        | "delivery"
        | "worker"
        | "warehouse"
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
      app_role: [
        "admin",
        "staff",
        "measurement_staff",
        "delivery",
        "worker",
        "warehouse",
      ],
    },
  },
} as const
