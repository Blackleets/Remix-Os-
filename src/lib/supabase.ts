import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as Record<string, string | undefined>;

export const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || '';
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || '';
export const supabaseProductBucket = env.VITE_SUPABASE_PRODUCT_BUCKET?.trim() || '';

export const isSupabaseStorageConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseProductBucket
);

export const supabase: SupabaseClient | null = isSupabaseStorageConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
