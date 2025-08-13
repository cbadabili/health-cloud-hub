import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Prefer environment variables (Vite), fall back to hard-coded dev values
// These env vars should be configured on Vercel:
//  - VITE_SUPABASE_URL
//  - VITE_SUPABASE_ANON_KEY
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://iphefsyarbbeoqlpkfxl.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwaGVmc3lhcmJiZW9xbHBrZnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5ODY1NzksImV4cCI6MjA2NzU2MjU3OX0.m-ENvfeGGlbvHBz6VahItkUZq3WKTrLUOoeI_cNbHkc';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});