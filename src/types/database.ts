export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: 'admin' | 'client';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: 'admin' | 'client';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: 'admin' | 'client';
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          category: string;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          price: number;
          category: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string;
          price?: number;
          category?: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          image_url?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          image_url?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_options: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          required: boolean;
          multiple: boolean;
          min_selections: number;
          max_selections: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          required?: boolean;
          multiple?: boolean;
          min_selections?: number;
          max_selections?: number;
          sort_order?: number;
        };
        Update: {
          name?: string;
          required?: boolean;
          multiple?: boolean;
          min_selections?: number;
          max_selections?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'option_items_option_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'option_items';
            referencedColumns: ['option_id'];
          },
        ];
      };
      option_items: {
        Row: {
          id: string;
          option_id: string;
          name: string;
          price: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          option_id: string;
          name: string;
          price?: number;
          sort_order?: number;
        };
        Update: {
          name?: string;
          price?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      insumos: {
        Row: {
          id: string;
          name: string;
          unit: string;
          cost: number;
          category: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          unit?: string;
          cost?: number;
          category?: string;
          quantity?: number;
        };
        Update: {
          name?: string;
          unit?: string;
          cost?: number;
          category?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      recetas: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receta_ingredientes: {
        Row: {
          id: string;
          receta_id: string;
          insumo_id: string;
          quantity: number;
          unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          receta_id: string;
          insumo_id: string;
          quantity: number;
          unit?: string;
        };
        Update: {
          receta_id?: string;
          insumo_id?: string;
          quantity?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receta_ingredientes_insumo_id_fkey';
            columns: ['insumo_id'];
            isOneToOne: false;
            referencedRelation: 'insumos';
            referencedColumns: ['id'];
          },
        ];
      };
      receta_subrecetas: {
        Row: {
          id: string;
          receta_id: string;
          subreceta_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          receta_id: string;
          subreceta_id: string;
        };
        Update: {
          receta_id?: string;
          subreceta_id?: string;
        };
        Relationships: [];
      };
      producto_recetas: {
        Row: {
          id: string;
          product_id: string;
          receta_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          receta_id: string;
        };
        Update: {
          product_id?: string;
          receta_id?: string;
        };
        Relationships: [];
      };
      producto_insumos: {
        Row: {
          id: string;
          product_id: string;
          insumo_id: string;
          quantity: number;
          unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          insumo_id: string;
          quantity: number;
          unit?: string;
        };
        Update: {
          product_id?: string;
          insumo_id?: string;
          quantity?: number;
          unit?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          user_name: string;
          user_phone: string;
          items: Json;
          subtotal: number;
          delivery_fee: number;
          total: number;
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
          payment_method: 'cash' | 'card' | 'transfer';
          delivery_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_name: string;
          user_phone: string;
          items?: Json;
          subtotal: number;
          delivery_fee?: number;
          total: number;
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
          payment_method?: 'cash' | 'card' | 'transfer';
          delivery_address?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
          payment_method?: 'cash' | 'card' | 'transfer';
          delivery_address?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_config: {
        Row: {
          id: number;
          site_name: string;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          hero_title: string;
          hero_subtitle: string;
          whatsapp_number: string;
          address: string | null;
          footer_pattern_url: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          hero_image_url: string | null;
          about_text: string | null;
          delivery_fee: number;
          min_order_amount: number;
          is_open: boolean;
          opening_hours: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          site_name?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          hero_title?: string;
          hero_subtitle?: string;
          whatsapp_number?: string;
          address?: string | null;
          footer_pattern_url?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          hero_image_url?: string | null;
          about_text?: string | null;
          delivery_fee?: number;
          min_order_amount?: number;
          is_open?: boolean;
          opening_hours?: Json;
        };
        Update: {
          site_name?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          hero_title?: string;
          hero_subtitle?: string;
          whatsapp_number?: string;
          address?: string | null;
          footer_pattern_url?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          hero_image_url?: string | null;
          about_text?: string | null;
          delivery_fee?: number;
          min_order_amount?: number;
          is_open?: boolean;
          opening_hours?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      make_admin: {
        Args: { target_email: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
