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
      orders: {
        Row: {
          id: string;
          user_id: string;
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
          user_id: string;
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
