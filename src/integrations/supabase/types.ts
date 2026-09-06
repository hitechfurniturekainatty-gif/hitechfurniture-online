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
      admin_vault_entries: {
        Row: {
          created_at: string
          created_by: string | null
          extras: Json
          heading: string
          id: string
          link: string | null
          password: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extras?: Json
          heading: string
          id?: string
          link?: string | null
          password?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extras?: Json
          heading?: string
          id?: string
          link?: string | null
          password?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      bundle_images: {
        Row: {
          bundle_id: string
          created_at: string
          display_order: number
          id: string
          image_url: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_images_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          display_order: number
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          display_order?: number
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          display_order?: number
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      busy_creditors: {
        Row: {
          created_at: string
          id: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          vendor_name?: string
        }
        Relationships: []
      }
      busy_item_master: {
        Row: {
          created_at: string
          id: string
          item_code: string | null
          item_name: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_code?: string | null
          item_name: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_code?: string | null
          item_name?: string
          unit?: string | null
        }
        Relationships: []
      }
      catalog_photo_sessions: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          pending_photos: Json
          products: Json
          status: string
          updated_at: string
          variants_per_product: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          pending_photos?: Json
          products?: Json
          status?: string
          updated_at?: string
          variants_per_product?: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          pending_photos?: Json
          products?: Json
          status?: string
          updated_at?: string
          variants_per_product?: number
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
      delivery_vehicles: {
        Row: {
          created_at: string
          display_order: number
          driver_user_id: string | null
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
          vehicle_number: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          driver_user_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          vehicle_number: string
        }
        Update: {
          created_at?: string
          display_order?: number
          driver_user_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
          vehicle_number?: string
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
          show_public_catalog: boolean
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
          show_public_catalog?: boolean
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
          show_public_catalog?: boolean
          singleton?: boolean
          updated_at?: string
          whatsapp_default_message?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      invoice_processing_log: {
        Row: {
          action: string
          color: string | null
          cost_price: number | null
          created_at: string
          id: string
          invoice_date: string | null
          invoice_number: string
          item_name: string | null
          mrp: number | null
          offer_price: number | null
          pending_item_id: string | null
          product_id: string | null
          qty: number | null
          vendor_item_code: string | null
          vendor_name: string | null
        }
        Insert: {
          action: string
          color?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number: string
          item_name?: string | null
          mrp?: number | null
          offer_price?: number | null
          pending_item_id?: string | null
          product_id?: string | null
          qty?: number | null
          vendor_item_code?: string | null
          vendor_name?: string | null
        }
        Update: {
          action?: string
          color?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          item_name?: string | null
          mrp?: number | null
          offer_price?: number | null
          pending_item_id?: string | null
          product_id?: string | null
          qty?: number | null
          vendor_item_code?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      job_work_orders: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_at: string | null
          id: string
          is_urgent: boolean
          item_ids: string[]
          job_type: string
          last_worker_update_at: string | null
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
          worker_update_note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_at?: string | null
          id?: string
          is_urgent?: boolean
          item_ids?: string[]
          job_type?: string
          last_worker_update_at?: string | null
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
          worker_update_note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_at?: string | null
          id?: string
          is_urgent?: boolean
          item_ids?: string[]
          job_type?: string
          last_worker_update_at?: string | null
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
          worker_update_note?: string | null
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
      pending_catalog_items: {
        Row: {
          color: string | null
          color_finish: string | null
          cost_price: number | null
          created_at: string
          delivery_condition: string | null
          dim_depth: number | null
          dim_height: number | null
          dim_width: number | null
          gallery_image_urls: string[] | null
          gst_rate: number | null
          hsn_code: string | null
          id: string
          image_url: string | null
          invoice_date: string | null
          invoice_number: string | null
          item_name: string
          location_id: string | null
          main_category_id: string | null
          match_status: string | null
          mrp: number | null
          notes: string | null
          offer_price: number | null
          primary_material: string | null
          qty: number
          review_status: string
          reviewed_at: string | null
          secondary_material: string | null
          sub_category_id: string | null
          suggested_main_category_id: string | null
          suggested_sub_category_id: string | null
          telegram_chat_id: number | null
          telegram_message_id: number | null
          vendor_item_code: string
          vendor_name: string
          warranty_period: string | null
        }
        Insert: {
          color?: string | null
          color_finish?: string | null
          cost_price?: number | null
          created_at?: string
          delivery_condition?: string | null
          dim_depth?: number | null
          dim_height?: number | null
          dim_width?: number | null
          gallery_image_urls?: string[] | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          item_name: string
          location_id?: string | null
          main_category_id?: string | null
          match_status?: string | null
          mrp?: number | null
          notes?: string | null
          offer_price?: number | null
          primary_material?: string | null
          qty: number
          review_status?: string
          reviewed_at?: string | null
          secondary_material?: string | null
          sub_category_id?: string | null
          suggested_main_category_id?: string | null
          suggested_sub_category_id?: string | null
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          vendor_item_code: string
          vendor_name: string
          warranty_period?: string | null
        }
        Update: {
          color?: string | null
          color_finish?: string | null
          cost_price?: number | null
          created_at?: string
          delivery_condition?: string | null
          dim_depth?: number | null
          dim_height?: number | null
          dim_width?: number | null
          gallery_image_urls?: string[] | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          item_name?: string
          location_id?: string | null
          main_category_id?: string | null
          match_status?: string | null
          mrp?: number | null
          notes?: string | null
          offer_price?: number | null
          primary_material?: string | null
          qty?: number
          review_status?: string
          reviewed_at?: string | null
          secondary_material?: string | null
          sub_category_id?: string | null
          suggested_main_category_id?: string | null
          suggested_sub_category_id?: string | null
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          vendor_item_code?: string
          vendor_name?: string
          warranty_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_catalog_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "product_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_catalog_items_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_catalog_items_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "pending_catalog_items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
          },
          {
            foreignKeyName: "pending_catalog_items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_catalog_items_suggested_main_category_id_fkey"
            columns: ["suggested_main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_catalog_items_suggested_main_category_id_fkey"
            columns: ["suggested_main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "pending_catalog_items_suggested_sub_category_id_fkey"
            columns: ["suggested_sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
          },
          {
            foreignKeyName: "pending_catalog_items_suggested_sub_category_id_fkey"
            columns: ["suggested_sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          quotation_id: string | null
          read_at: string | null
          read_by: string | null
          recipients: string[]
          source_id: string | null
          source_type: string
          stage: number | null
          target_role: Database["public"]["Enums"]["app_role"]
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          quotation_id?: string | null
          read_at?: string | null
          read_by?: string | null
          recipients?: string[]
          source_id?: string | null
          source_type?: string
          stage?: number | null
          target_role: Database["public"]["Enums"]["app_role"]
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          quotation_id?: string | null
          read_at?: string | null
          read_by?: string | null
          recipients?: string[]
          source_id?: string | null
          source_type?: string
          stage?: number | null
          target_role?: Database["public"]["Enums"]["app_role"]
          title?: string
        }
        Relationships: []
      }
      product_bundles: {
        Row: {
          available_colors: string[] | null
          bundle_code: string
          cost_price: number | null
          created_at: string
          created_by: string | null
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
          main_image_url: string | null
          material: string | null
          mrp: number
          name: string
          offer_price: number | null
          show_item_prices_public: boolean
          show_item_prices_staff: boolean
          stock_status: string
          sub_category_id: string | null
          updated_at: string
        }
        Insert: {
          available_colors?: string[] | null
          bundle_code: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
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
          main_image_url?: string | null
          material?: string | null
          mrp?: number
          name: string
          offer_price?: number | null
          show_item_prices_public?: boolean
          show_item_prices_staff?: boolean
          stock_status?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Update: {
          available_colors?: string[] | null
          bundle_code?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
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
          main_image_url?: string | null
          material?: string | null
          mrp?: number
          name?: string
          offer_price?: number | null
          show_item_prices_public?: boolean
          show_item_prices_staff?: boolean
          stock_status?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "main_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bundles_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "product_bundles_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
          },
          {
            foreignKeyName: "product_bundles_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
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
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
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
          part: string | null
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
          part?: string | null
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
          part?: string | null
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          cost_price: number | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          mrp: number | null
          note: string | null
          product_id: string
          selling_price: number | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          mrp?: number | null
          note?: string | null
          product_id: string
          selling_price?: number | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          mrp?: number | null
          note?: string | null
          product_id?: string
          selling_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_colors: string[] | null
          color_finish: string | null
          cost_price: number | null
          created_at: string
          creation_method: string
          deleted_at: string | null
          deleted_by: string | null
          delivery_condition: string | null
          description: string | null
          dim_depth: number | null
          dim_height: number | null
          dim_width: number | null
          dimensions: string | null
          floor_display_order: number
          gst_rate: number | null
          hsn_code: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          location_id: string | null
          main_category_id: string
          material: string | null
          mrp: number
          offer_price: number | null
          primary_image_url: string | null
          primary_material: string | null
          product_code: string
          product_name: string
          reorder_level: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          secondary_material: string | null
          stock_quantity: number
          stock_status: string
          sub_category_id: string | null
          submitted_by: string | null
          updated_at: string
          warranty_period: string | null
        }
        Insert: {
          available_colors?: string[] | null
          color_finish?: string | null
          cost_price?: number | null
          created_at?: string
          creation_method?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_condition?: string | null
          description?: string | null
          dim_depth?: number | null
          dim_height?: number | null
          dim_width?: number | null
          dimensions?: string | null
          floor_display_order?: number
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          location_id?: string | null
          main_category_id: string
          material?: string | null
          mrp: number
          offer_price?: number | null
          primary_image_url?: string | null
          primary_material?: string | null
          product_code: string
          product_name: string
          reorder_level?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_material?: string | null
          stock_quantity?: number
          stock_status?: string
          sub_category_id?: string | null
          submitted_by?: string | null
          updated_at?: string
          warranty_period?: string | null
        }
        Update: {
          available_colors?: string[] | null
          color_finish?: string | null
          cost_price?: number | null
          created_at?: string
          creation_method?: string
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_condition?: string | null
          description?: string | null
          dim_depth?: number | null
          dim_height?: number | null
          dim_width?: number | null
          dimensions?: string | null
          floor_display_order?: number
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          location_id?: string | null
          main_category_id?: string
          material?: string | null
          mrp?: number
          offer_price?: number | null
          primary_image_url?: string | null
          primary_material?: string | null
          product_code?: string
          product_name?: string
          reorder_level?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secondary_material?: string | null
          stock_quantity?: number
          stock_status?: string
          sub_category_id?: string | null
          submitted_by?: string | null
          updated_at?: string
          warranty_period?: string | null
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
            foreignKeyName: "products_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
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
      quotation_followups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          outcome: string | null
          quotation_id: string
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          outcome?: string | null
          quotation_id: string
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          outcome?: string | null
          quotation_id?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_followups_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          amount: number
          bundle_id: string | null
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
          item_notes: string | null
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
          bundle_id?: string | null
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
          item_notes?: string | null
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
          bundle_id?: string | null
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
          item_notes?: string | null
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
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
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
          commercial_status: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          discount_amount: number
          dispatch_driver_id: string | null
          dispatch_driver_name: string | null
          dispatch_driver_phone: string | null
          dispatch_vehicle: string | null
          dispatch_vehicle_id: string | null
          dispatch_vehicle_number: string | null
          dispatched_at: string | null
          document_type: string
          enquiry_contacted_at: string | null
          enquiry_type: string | null
          expected_delivery_date: string | null
          gst_amount: number
          gst_percent: number
          id: string
          is_direct_order: boolean
          last_follow_up_at: string | null
          lead_type: string
          lost_reason: string | null
          next_follow_up_at: string | null
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
          commercial_status?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          dispatch_driver_id?: string | null
          dispatch_driver_name?: string | null
          dispatch_driver_phone?: string | null
          dispatch_vehicle?: string | null
          dispatch_vehicle_id?: string | null
          dispatch_vehicle_number?: string | null
          dispatched_at?: string | null
          document_type?: string
          enquiry_contacted_at?: string | null
          enquiry_type?: string | null
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          is_direct_order?: boolean
          last_follow_up_at?: string | null
          lead_type?: string
          lost_reason?: string | null
          next_follow_up_at?: string | null
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
          commercial_status?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_place?: string | null
          delivery_route_id?: string | null
          discount_amount?: number
          dispatch_driver_id?: string | null
          dispatch_driver_name?: string | null
          dispatch_driver_phone?: string | null
          dispatch_vehicle?: string | null
          dispatch_vehicle_id?: string | null
          dispatch_vehicle_number?: string | null
          dispatched_at?: string | null
          document_type?: string
          enquiry_contacted_at?: string | null
          enquiry_type?: string | null
          expected_delivery_date?: string | null
          gst_amount?: number
          gst_percent?: number
          id?: string
          is_direct_order?: boolean
          last_follow_up_at?: string | null
          lead_type?: string
          lost_reason?: string | null
          next_follow_up_at?: string | null
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
            foreignKeyName: "quotations_dispatch_vehicle_id_fkey"
            columns: ["dispatch_vehicle_id"]
            isOneToOne: false
            referencedRelation: "delivery_vehicles"
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
      receivable_call_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          receivable_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          receivable_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          receivable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_call_logs_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_followups: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          outcome: string | null
          receivable_id: string
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          outcome?: string | null
          receivable_id: string
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          outcome?: string | null
          receivable_id?: string
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_followups_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_method: string | null
          quotation_id: string | null
          receivable_id: string
          received_at: string
          received_by: string | null
          reference_no: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          quotation_id?: string | null
          receivable_id: string
          received_at?: string
          received_by?: string | null
          reference_no?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          quotation_id?: string | null
          receivable_id?: string
          received_at?: string
          received_by?: string | null
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivable_payments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          batch: number
          bill_no: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          email: string | null
          id: string
          last_follow_up_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          original_amount: number | null
          pending_amount: number
          phone: string | null
          place: string | null
          quotation_id: string | null
          raw_text: string | null
          source: string
          updated_at: string
        }
        Insert: {
          batch?: number
          bill_no?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          email?: string | null
          id?: string
          last_follow_up_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          original_amount?: number | null
          pending_amount?: number
          phone?: string | null
          place?: string | null
          quotation_id?: string | null
          raw_text?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          batch?: number
          bill_no?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          email?: string | null
          id?: string
          last_follow_up_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          original_amount?: number | null
          pending_amount?: number
          phone?: string | null
          place?: string | null
          quotation_id?: string | null
          raw_text?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
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
      scheme_parties: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          created_by: string | null
          gst_number: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          place: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          gst_number?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          place?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          place?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheme_party_notes: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          file_type: string
          file_url: string
          id: string
          party_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          file_type?: string
          file_url: string
          id?: string
          party_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          file_type?: string
          file_url?: string
          id?: string
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_party_notes_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "scheme_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_period_rules: {
        Row: {
          benefit_receipts: Json
          created_at: string
          created_by: string | null
          fy_year: number
          id: string
          party_id: string
          period_key: string
          period_type: string
          scheme_config: Json
          scheme_kind: string
          updated_at: string
        }
        Insert: {
          benefit_receipts?: Json
          created_at?: string
          created_by?: string | null
          fy_year: number
          id?: string
          party_id: string
          period_key: string
          period_type: string
          scheme_config?: Json
          scheme_kind?: string
          updated_at?: string
        }
        Update: {
          benefit_receipts?: Json
          created_at?: string
          created_by?: string | null
          fy_year?: number
          id?: string
          party_id?: string
          period_key?: string
          period_type?: string
          scheme_config?: Json
          scheme_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_period_rules_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "scheme_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_rules: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          notes: string | null
          period: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          notes?: string | null
          period?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          notes?: string | null
          period?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheme_vendor_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          item_key: string | null
          item_name: string
          mrp: number
          party_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_key?: string | null
          item_name: string
          mrp?: number
          party_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_key?: string | null
          item_name?: string
          mrp?: number
          party_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_vendor_items_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "scheme_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_vendor_months: {
        Row: {
          benefit_receipts: Json
          created_at: string
          created_by: string | null
          fy_year: number
          id: string
          invoices: Json
          month: number
          notes: string | null
          party_id: string
          purchase_rows: Json
          purchases_text: string | null
          scheme_config: Json
          scheme_kind: string
          updated_at: string
        }
        Insert: {
          benefit_receipts?: Json
          created_at?: string
          created_by?: string | null
          fy_year: number
          id?: string
          invoices?: Json
          month: number
          notes?: string | null
          party_id: string
          purchase_rows?: Json
          purchases_text?: string | null
          scheme_config?: Json
          scheme_kind?: string
          updated_at?: string
        }
        Update: {
          benefit_receipts?: Json
          created_at?: string
          created_by?: string | null
          fy_year?: number
          id?: string
          invoices?: Json
          month?: number
          notes?: string | null
          party_id?: string
          purchase_rows?: Json
          purchases_text?: string | null
          scheme_config?: Json
          scheme_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_vendor_months_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "scheme_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_health_snapshots: {
        Row: {
          avg_position: number | null
          clicks: number | null
          created_at: string
          ctr: number | null
          id: string
          impressions: number | null
          notes: string | null
          page_views: number | null
          sessions: number | null
          snapshot_date: string
          source: string
          top_queries: Json | null
          users: number | null
        }
        Insert: {
          avg_position?: number | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          page_views?: number | null
          sessions?: number | null
          snapshot_date: string
          source: string
          top_queries?: Json | null
          users?: number | null
        }
        Update: {
          avg_position?: number | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          id?: string
          impressions?: number | null
          notes?: string | null
          page_views?: number | null
          sessions?: number | null
          snapshot_date?: string
          source?: string
          top_queries?: Json | null
          users?: number | null
        }
        Relationships: []
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
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
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
          {
            foreignKeyName: "sub_categories_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
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
      vault_config: {
        Row: {
          id: boolean
          master_password: string
          recovery_dob: string | null
          recovery_phone: string | null
          secret_pin: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          master_password: string
          recovery_dob?: string | null
          recovery_phone?: string | null
          secret_pin: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          master_password?: string
          recovery_dob?: string | null
          recovery_phone?: string | null
          secret_pin?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      vendor_item_map: {
        Row: {
          created_at: string
          id: string
          product_id: string
          updated_at: string
          vendor_item_code: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          vendor_item_code: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          vendor_item_code?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_item_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_delivery_status: {
        Row: {
          created_at: string
          error_code: number | null
          error_message: string | null
          error_title: string | null
          id: string
          message_id: string | null
          raw: Json | null
          recipient_phone: string | null
          status: string | null
          status_timestamp: string | null
        }
        Insert: {
          created_at?: string
          error_code?: number | null
          error_message?: string | null
          error_title?: string | null
          id?: string
          message_id?: string | null
          raw?: Json | null
          recipient_phone?: string | null
          status?: string | null
          status_timestamp?: string | null
        }
        Update: {
          created_at?: string
          error_code?: number | null
          error_message?: string | null
          error_title?: string | null
          id?: string
          message_id?: string | null
          raw?: Json | null
          recipient_phone?: string | null
          status?: string | null
          status_timestamp?: string | null
        }
        Relationships: []
      }
      whatsapp_followups_sent: {
        Row: {
          last_inbound_at: string
          phone: string
          sent_at: string
        }
        Insert: {
          last_inbound_at: string
          phone: string
          sent_at?: string
        }
        Update: {
          last_inbound_at?: string
          phone?: string
          sent_at?: string
        }
        Relationships: []
      }
      whatsapp_inbound_log: {
        Row: {
          created_at: string
          customer_name: string | null
          id: number
          phone: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: number
          phone: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: number
          phone?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          customer_name: string | null
          direction: string
          id: number
          message_text: string
          phone: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          direction: string
          id?: never
          message_text: string
          phone: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          direction?: string
          id?: never
          message_text?: string
          phone?: string
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
      command_center_snapshot: {
        Row: {
          catalog_missing_category: number | null
          catalog_pending_review: number | null
          complaints_open: number | null
          delivery_queue: number | null
          delivery_queue_unassigned: number | null
          dispatched_value_today: number | null
          invoices_processed_24h: number | null
          last_backup_status: string | null
          leads_active_stage_early: number | null
          measurement_tasks_pending: number | null
          pipeline_events_24h: number | null
          pipeline_stage_counts: Json | null
          products_deleted_pending: number | null
          products_low_stock: number | null
          quotations_active: number | null
          quotations_dispatched_today: number | null
          snapshot_generated_at: string | null
          warehouse_queue: number | null
          whatsapp_messages_24h: number | null
        }
        Relationships: []
      }
      products_inventory_filterable: {
        Row: {
          available_colors: string[] | null
          building: string | null
          color_finish: string | null
          cost_price: number | null
          created_at: string | null
          creation_method: string | null
          description: string | null
          dim_depth: number | null
          dim_height: number | null
          dim_width: number | null
          dimensions: string | null
          floor: string | null
          floor_display_order: number | null
          gallery_image_count: number | null
          gst_rate: number | null
          hsn_code: string | null
          id: string | null
          is_published: boolean | null
          location_id: string | null
          main_category_id: string | null
          main_category_name: string | null
          main_category_slug: string | null
          mrp: number | null
          offer_price: number | null
          part: string | null
          primary_image_url: string | null
          primary_material: string | null
          product_code: string | null
          product_name: string | null
          reorder_level: number | null
          review_status: string | null
          secondary_material: string | null
          section: string | null
          stock_quantity: number | null
          stock_status: string | null
          sub_category_id: string | null
          sub_category_name: string | null
          sub_category_slug: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "product_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      products_safe_search: {
        Row: {
          availability_status: string | null
          available_colors: string[] | null
          color_finish: string | null
          created_at: string | null
          delivery_condition: string | null
          description: string | null
          dimensions: string | null
          discount_percent: number | null
          gallery_images: string[] | null
          id: string | null
          is_featured: boolean | null
          main_category_id: string | null
          material: string | null
          mrp: number | null
          offer_price: number | null
          primary_image_url: string | null
          primary_material: string | null
          product_code: string | null
          product_name: string | null
          stock_quantity: number | null
          sub_category_id: string | null
          warranty_period: string | null
        }
        Insert: {
          availability_status?: never
          available_colors?: string[] | null
          color_finish?: string | null
          created_at?: string | null
          delivery_condition?: string | null
          description?: string | null
          dimensions?: string | null
          discount_percent?: never
          gallery_images?: never
          id?: string | null
          is_featured?: boolean | null
          main_category_id?: string | null
          material?: string | null
          mrp?: number | null
          offer_price?: number | null
          primary_image_url?: string | null
          primary_material?: string | null
          product_code?: string | null
          product_name?: string | null
          stock_quantity?: number | null
          sub_category_id?: string | null
          warranty_period?: string | null
        }
        Update: {
          availability_status?: never
          available_colors?: string[] | null
          color_finish?: string | null
          created_at?: string | null
          delivery_condition?: string | null
          description?: string | null
          dimensions?: string | null
          discount_percent?: never
          gallery_images?: never
          id?: string | null
          is_featured?: boolean | null
          main_category_id?: string | null
          material?: string | null
          mrp?: number | null
          offer_price?: number | null
          primary_image_url?: string | null
          primary_material?: string | null
          product_code?: string | null
          product_name?: string | null
          stock_quantity?: number | null
          sub_category_id?: string | null
          warranty_period?: string | null
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
            foreignKeyName: "products_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
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
      products_staff_catalog: {
        Row: {
          building: string | null
          color_finish: string | null
          cost_price: number | null
          creation_method: string | null
          delivery_condition: string | null
          dim_depth: number | null
          dim_height: number | null
          dim_width: number | null
          floor: string | null
          floor_display_order: number | null
          gst_rate: number | null
          hsn_code: string | null
          id: string | null
          main_category_id: string | null
          mrp: number | null
          offer_price: number | null
          part: string | null
          primary_image_url: string | null
          primary_material: string | null
          product_code: string | null
          product_name: string | null
          reorder_level: number | null
          review_status: string | null
          secondary_material: string | null
          section: string | null
          stock_quantity: number | null
          stock_status: string | null
          sub_category_id: string | null
          warranty_period: string | null
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
            foreignKeyName: "products_main_category_id_fkey"
            columns: ["main_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["main_category_id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "products_inventory_filterable"
            referencedColumns: ["sub_category_id"]
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
      warehouse_order_items: {
        Row: {
          advance_amount: number | null
          balance_to_collect: number | null
          catalog_image_url: string | null
          commercial_status: string | null
          delivered_at: string | null
          delivery_place: string | null
          delivery_route_id: string | null
          description: string | null
          dispatch_driver_name: string | null
          dispatch_driver_phone: string | null
          dispatch_vehicle: string | null
          dispatch_vehicle_number: string | null
          dispatched_at: string | null
          expected_delivery_date: string | null
          fulfillment_route: string | null
          id: string | null
          item_image_url: string | null
          item_notes: string | null
          measurement_image_url: string | null
          order_confirmed: boolean | null
          party_address: string | null
          party_name: string | null
          party_phone: string | null
          party_place: string | null
          pipeline_stage: number | null
          quantity: number | null
          quotation_id: string | null
          quotation_number: string | null
          quotation_status: string | null
          readiness_label: string | null
          total: number | null
          warehouse_ready: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_delivery_route_id_fkey"
            columns: ["delivery_route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_product_price_change: {
        Args: {
          _cost_price: number
          _effective_from?: string
          _mrp: number
          _note?: string
          _product_id: string
          _selling_price: number
        }
        Returns: string
      }
      backlog_pin_is_set: { Args: never; Returns: boolean }
      calculate_mrp_and_offer: {
        Args: { p_purchase_rate: number; p_tax_percent?: number }
        Returns: {
          calculated_mrp: number
          final_mrp: number
          landed_cost: number
          offer_price: number
        }[]
      }
      catalog_pin_is_set: { Args: never; Returns: boolean }
      check_delivery_prep_reminders: { Args: never; Returns: number }
      check_due_quotation_followups: { Args: never; Returns: number }
      check_due_receivable_followups: { Args: never; Returns: number }
      check_payment_reminders: { Args: never; Returns: number }
      check_quotation_expiry: { Args: never; Returns: number }
      check_stuck_production_jobs: { Args: never; Returns: number }
      check_uncontacted_lead_reminders: { Args: never; Returns: number }
      check_whatsapp_followups: { Args: never; Returns: undefined }
      consume_bundle_stock: {
        Args: { _bundle_id: string; _qty: number; _reason: string }
        Returns: undefined
      }
      current_worker_id: { Args: never; Returns: string }
      generate_full_backup: { Args: never; Returns: Json }
      get_all_auth_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          user_metadata: Json
        }[]
      }
      get_reserved_stock: {
        Args: never
        Returns: {
          product_id: string
          reserved: number
        }[]
      }
      get_shared_delivery_note: { Args: { p_token: string }; Returns: Json }
      get_shared_job_work_order: { Args: { p_token: string }; Returns: Json }
      get_shared_quotation: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_incoming_item: {
        Args: {
          p_color?: string
          p_item_name: string
          p_similarity_threshold?: number
          p_vendor_item_code: string
          p_vendor_name: string
        }
        Returns: {
          color_match_status: string
          match_status: string
          matched_product_id: string
          matched_product_name: string
          name_similarity: number
          needs_image_generation: boolean
        }[]
      }
      next_complaint_id: { Args: never; Returns: string }
      next_po_id: { Args: { _party: string; _place: string }; Returns: string }
      next_quotation_id: {
        Args: { _party: string; _place: string }
        Returns: string
      }
      next_service_id: { Args: never; Returns: string }
      override_advance_quotation: {
        Args: { _quotation_id: string; _target_stage: number }
        Returns: undefined
      }
      purge_old_trash: {
        Args: never
        Returns: {
          removed: number
          table_name: string
        }[]
      }
      recompute_bundle_stock: {
        Args: { _bundle_id: string }
        Returns: undefined
      }
      reject_quotation: { Args: { _quotation_id: string }; Returns: undefined }
      resolve_role_recipients: { Args: { p_role: string }; Returns: string[] }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      stage_or_autoupdate_item: {
        Args: {
          p_color: string
          p_color_finish: string
          p_cost_price: number
          p_delivery_condition: string
          p_dim_depth: number
          p_dim_height: number
          p_dim_width: number
          p_gst_rate: number
          p_hsn_code: string
          p_image_url: string
          p_invoice_date: string
          p_invoice_number: string
          p_item_name: string
          p_main_category_id: string
          p_mrp: number
          p_notes: string
          p_offer_price: number
          p_primary_material: string
          p_qty: number
          p_secondary_material: string
          p_sub_category_id: string
          p_suggested_main_category_id: string
          p_suggested_sub_category_id: string
          p_vendor_item_code: string
          p_vendor_name: string
          p_warranty_period: string
        }
        Returns: {
          action: string
          cost_price: number
          id: string
          invoice_date: string
          invoice_number: string
          item_name: string
          match_status: string
          mrp: number
          offer_price: number
          qty: number
          vendor_item_code: string
          vendor_name: string
        }[]
      }
      start_lead_chat: { Args: { p_quotation_id: string }; Returns: Json }
      upsert_catalog_item: {
        Args: {
          p_color?: string
          p_cost_price?: number
          p_image_url?: string
          p_invoice_number?: string
          p_item_name: string
          p_main_category_id?: string
          p_mrp?: number
          p_offer_price?: number
          p_qty: number
          p_sub_category_id?: string
          p_vendor_item_code: string
          p_vendor_name: string
        }
        Returns: {
          action_taken: string
          new_stock_quantity: number
          product_id: string
        }[]
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
