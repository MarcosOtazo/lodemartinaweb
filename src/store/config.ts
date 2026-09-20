import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { SiteConfig } from '../types';
import type { Database, Json } from '../types/database';
import { DEFAULT_WEEK } from '../lib/utils';

type SiteConfigUpdate = Database['public']['Tables']['site_config']['Update'];

const DEFAULT_CONFIG: SiteConfig = {
  id: 1,
  site_name: 'Lo de Martina',
  logo_url: null,
  primary_color: '#e85d04',
  secondary_color: '#1f2937',
  hero_title: 'Lo de Martina',
  hero_subtitle: 'Hamburguesas, tostadas y combos para todos los gustos',
  whatsapp_number: import.meta.env.VITE_WHATSAPP_NUMBER || '',
  address: '',
  facebook_url: '',
  instagram_url: '',
  hero_image_url: null,
  about_text: '',
  footer_pattern_url: null,
  delivery_fee: 0,
  min_order_amount: 0,
  opening_hours: DEFAULT_WEEK,
  created_at: '',
  updated_at: '',
};

interface ConfigStore {
  config: SiteConfig;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: Partial<SiteConfig>) => Promise<{ error: string | null }>;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: DEFAULT_CONFIG,

  loadConfig: async () => {
    const { data } = await supabase.from('site_config').select('*').eq('id', 1).single();
    if (data) {
      const storedHours = data.opening_hours as unknown as Record<string, { open: string; close: string; closed: boolean }> | null;
      set({
        config: {
          ...get().config,
          ...data,
          whatsapp_number: data.whatsapp_number || '',
          address: data.address || '',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          hero_image_url: data.hero_image_url ?? null,
          about_text: data.about_text || '',
          footer_pattern_url: data.footer_pattern_url ?? null,
          opening_hours:
            storedHours && Object.keys(storedHours).length > 0
              ? storedHours
              : DEFAULT_WEEK,
        } as SiteConfig,
      });
    }
    applyCssVars(get().config);
  },

  updateConfig: async (updates) => {
    const dbUpdates: SiteConfigUpdate = {
      site_name: updates.site_name,
      logo_url: updates.logo_url,
      primary_color: updates.primary_color,
      secondary_color: updates.secondary_color,
      hero_title: updates.hero_title,
      hero_subtitle: updates.hero_subtitle,
      whatsapp_number: updates.whatsapp_number,
      address: updates.address,
      facebook_url: updates.facebook_url,
      instagram_url: updates.instagram_url,
      hero_image_url: updates.hero_image_url,
      about_text: updates.about_text,
      footer_pattern_url: updates.footer_pattern_url,
      delivery_fee: updates.delivery_fee,
      min_order_amount: updates.min_order_amount,
      opening_hours: updates.opening_hours as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('site_config').update(dbUpdates).eq('id', 1);
    if (error) return { error: error.message };
    const newConfig = { ...get().config, ...updates };
    set({ config: newConfig });
    applyCssVars(newConfig);
    return { error: null };
  },
}));

function applyCssVars(config: SiteConfig) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', config.primary_color);
  root.style.setProperty('--color-primary-hover', shadeColor(config.primary_color, -20));
  root.style.setProperty('--color-primary-light', config.primary_color + '1a');
  root.style.setProperty('--color-secondary', config.secondary_color);
  if (config.site_name) document.title = config.site_name;
}

function shadeColor(color: string, percent: number): string {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
