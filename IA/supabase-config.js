// IA/supabase-config.js

const SUPABASE_URL = "https://klxriiatgxxhmbmmctbw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6vu0yPFD8pxEP1uzG5-Wzw_NE6XzEri";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);