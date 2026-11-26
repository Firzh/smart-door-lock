import { CONFIG } from '../config/config.js';
import { getSupabaseClient, isSupabaseSdkLoaded } from '../services/supabase.js';
import { debugError, debugLog } from '../utils/notifications.js';

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

  debugLog('CP-AUTH-SIGNIN-START', 'Memanggil supabase.auth.signInWithPassword.', {
    email,
    origin: window.location.origin,
  });

  const result = await client.auth.signInWithPassword({ email, password });

  if (result.error) {
    debugError('CP-AUTH-SIGNIN-RESULT', 'Supabase Auth menolak/gagal login.', {
      status: result.error.status,
      code: result.error.code,
      message: result.error.message,
    });
  } else {
    debugLog('CP-AUTH-SIGNIN-RESULT', 'Supabase Auth login berhasil.', {
      userId: result.data?.user?.id,
      email: result.data?.user?.email,
      emailConfirmedAt: result.data?.user?.email_confirmed_at,
      hasSession: Boolean(result.data?.session),
    });
  }

  return result;
}

export async function signOut() {
  debugLog('CP-AUTH-SIGNOUT', 'Menjalankan logout dan mengarahkan ke login.html.');
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  window.location.href = './pages/login.html';
}

export async function getSession() {
  const client = getSupabaseClient();
  if (!client) {
    debugError('CP-AUTH-SESSION', 'Client Supabase null saat cek session.');
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    debugError('CP-AUTH-SESSION', 'Gagal membaca session Supabase.', {
      status: error.status,
      message: error.message,
    });
    return null;
  }

  debugLog('CP-AUTH-SESSION', 'Hasil pemeriksaan session.', {
    hasSession: Boolean(data?.session),
    userEmail: data?.session?.user?.email || null,
    expiresAt: data?.session?.expires_at || null,
  });

  return data?.session || null;
}

export async function requireAuth() {
  debugLog('CP-AUTH-GUARD', 'Memeriksa guard autentikasi.', {
    requireAuth: CONFIG.APP.REQUIRE_AUTH,
    pathname: window.location.pathname,
  });

  if (!CONFIG.APP.REQUIRE_AUTH) return true;

  const session = await getSession();
  if (!session) {
    debugError('CP-AUTH-GUARD', 'Session tidak ditemukan — redirect ke ./pages/login.html.');
    window.location.href = './pages/login.html';
    return false;
  }

  return true;
}

export function watchAuthState(onSignedOut) {
  const client = getSupabaseClient();
  if (!client || typeof onSignedOut !== 'function') return null;

  const { data } = client.auth.onAuthStateChange((event, session) => {
    debugLog('CP-AUTH-STATE', 'Perubahan state autentikasi terdeteksi.', {
      event,
      hasSession: Boolean(session),
      userEmail: session?.user?.email || null,
    });

    if (event === 'SIGNED_OUT' || (CONFIG.APP.REQUIRE_AUTH && !session)) {
      debugError('CP-AUTH-STATE', 'Trigger onSignedOut karena session kosong atau SIGNED_OUT.', { event });
      onSignedOut();
    }
  });

  return data?.subscription || null;
}
