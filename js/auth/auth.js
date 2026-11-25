import { CONFIG } from '../config/config.js';
import { getSupabaseClient, isSupabaseSdkLoaded } from '../services/supabase.js';

export async function signIn(email, password) {
  if (!isSupabaseSdkLoaded()) {
    return {
      data: null,
      error: new Error('Supabase SDK gagal dimuat. Periksa koneksi internet Anda.'),
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: new Error('Supabase belum dikonfigurasi di js/config/config.js'),
    };
  }

  return client.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  window.location.href = './pages/login.html';
}

export async function getSession() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error('Gagal memeriksa sesi Supabase:', error.message);
    return null;
  }
  return data?.session || null;
}

export async function requireAuth() {
  if (!CONFIG.APP.REQUIRE_AUTH) return true;

  const session = await getSession();
  if (!session) {
    window.location.href = './pages/login.html';
    return false;
  }

  return true;
}

export function watchAuthState(onSignedOut) {
  const client = getSupabaseClient();
  if (!client || typeof onSignedOut !== 'function') return null;

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (CONFIG.APP.REQUIRE_AUTH && !session)) {
      onSignedOut();
    }
  });

  return data?.subscription || null;
}
