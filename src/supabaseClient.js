import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tqoeraicwsngrepagelv.supabase.co';
const supabaseAnonKey = 'sb_publishable_YNjsuexBTh4_K0QH7TntqQ_GRq6r1Ni';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
