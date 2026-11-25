import { CONFIG } from '../config/config.js';

let supabaseClient = null;

export function isSupabaseSdkLoaded() {
  return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
}

export function isSupabaseConfigured() {
  return (
    Boolean(CONFIG.SUPABASE_URL) &&
    Boolean(CONFIG.SUPABASE_ANON_KEY) &&
    !CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    !CONFIG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseConfigured()) return null;

  if (!isSupabaseSdkLoaded()) {
    console.warn('Supabase SDK gagal dimuat dari CDN.');
    return null;
  }

  supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
  return supabaseClient;
}
