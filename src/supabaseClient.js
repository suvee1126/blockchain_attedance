import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qheqjumkbqczmygfymwe.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hp-QiVaif8bW6GDtWzweyw_O3But7xN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
