export type UserRole = 'admin' | 'client';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export type ProductCategory = string;

export interface Category {
  id: ProductCategory;
  name: string;
  image_url: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  receta_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OptionItem {
  id: string;
  option_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  items: OptionItem[];
}

export interface SelectedOption {
  group_name: string;
  item_name: string;
  price: number;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  notes?: string;
  selected_options?: SelectedOption[];
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  payment_method: 'cash' | 'card' | 'transfer';
  delivery_address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

export interface SiteConfig {
  id: number;
  site_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  hero_title: string;
  hero_subtitle: string;
  whatsapp_number: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
  hero_image_url: string | null;
  about_text: string;
  footer_pattern_url: string | null;
  delivery_fee: number;
  min_order_amount: number;
  opening_hours: Record<string, DaySchedule>;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  key: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  notes?: string;
  product: Product;
  selected_options: SelectedOption[];
}

export interface Insumo {
  id: string;
  name: string;
  unit: string;
  cost: number;
  category: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  receta_id: string;
  insumo_id: string;
  quantity: number;
  unit: string;
  insumo?: Insumo;
}

export interface Receta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
}
