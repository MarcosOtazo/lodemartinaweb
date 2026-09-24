import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  loadUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  initializing: true,

  loadUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ user: null, initializing: false });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      set({
        user: profile
          ? {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              full_name: profile.full_name || undefined,
               phone: profile.phone || undefined,
               client_number: profile.client_number,
               created_at: profile.created_at,
              updated_at: profile.updated_at,
            }
          : null,
        initializing: false,
      });
    } catch {
      set({ user: null, initializing: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      return { error: error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : error.message };
    }
    await useAuthStore.getState().loadUser();
    set({ loading: false });
    return { error: null };
  },

  signUp: async (email, password, fullName, phone) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    if (error) {
      set({ loading: false });
      return { error: error.message === 'User already registered'
        ? 'Ya existe una cuenta con ese email'
        : error.message };
    }
    if (data.session) {
      await useAuthStore.getState().loadUser();
    }
    set({ loading: false });
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
