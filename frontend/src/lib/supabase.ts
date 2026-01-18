import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// Get these from your Supabase project settings: https://supabase.com/dashboard/project/thrmkorvklpvbbctsgti/settings/api
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://thrmkorvklpvbbctsgti.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Please add it to your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
