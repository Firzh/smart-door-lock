import { CONFIG } from '../config/config.js';
import { debugError, debugLog } from '../utils/notifications.js';

let supabaseClient = null;

export function isSupabaseSdkLoaded() {
  const loaded = Boolean(window.supabase && typeof window.supabase.createClient === 'function');
  if (!loaded) {
    debugError('CP-SDK', 'window.supabase.createClient tidak ditemukan (CDN gagal dimuat atau terblokir).');
  }
  return loaded;
}

export function isSupabaseConfigured() {
  const configured =
    Boolean(CONFIG.SUPABASE_URL) &&
    Boolean(CONFIG.SUPABASE_ANON_KEY) &&
    !CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    !CONFIG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

  if (!configured) {
    debugError('CP-CFG', 'SUPABASE_URL atau SUPABASE_ANON_KEY masih kosong/placeholder.');
  }
  return configured;
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseConfigured()) return null;
  if (!isSupabaseSdkLoaded()) return null;

  const keyPrefix = `${String(CONFIG.SUPABASE_ANON_KEY).slice(0, 18)}...`;
  debugLog('CP-CLIENT', 'Menginisialisasi Supabase client.', {
    origin: window.location.origin,
    pathname: window.location.pathname,
    supabaseUrl: CONFIG.SUPABASE_URL,
    keyPrefix,
  });

  supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
  return supabaseClient;
}
