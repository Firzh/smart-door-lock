import { getSession, signIn } from '../auth/auth.js';
import { isSupabaseConfigured, isSupabaseSdkLoaded } from '../services/supabase.js';
import { debugError, debugLog, showToast } from '../utils/notifications.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-submit');
  if (!form || !submitBtn) return;

  debugLog('CP-LOGIN-INIT', 'Halaman login dimuat.', {
    href: window.location.href,
    origin: window.location.origin,
    sdkLoaded: isSupabaseSdkLoaded(),
    supabaseConfigured: isSupabaseConfigured(),
  });

  if (!isSupabaseSdkLoaded()) {
    showToast('Supabase SDK gagal dimuat dari CDN.', 'error', 6000);
  } else if (isSupabaseConfigured()) {
    const existingSession = await getSession();
    if (existingSession) {
      debugLog('CP-LOGIN-INIT', 'Session aktif ditemukan, redirect ke ../index.html.');
      window.location.href = '../index.html';
      return;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isSupabaseSdkLoaded()) {
      debugError('CP-LOGIN-SUBMIT', 'Submit dibatalkan: Supabase SDK belum termuat.');
      showToast('Supabase SDK belum termuat.', 'error', 6000);
      return;
    }

    if (!isSupabaseConfigured()) {
      debugError('CP-LOGIN-SUBMIT', 'Submit dibatalkan: config Supabase belum diisi.');
      showToast('Konfigurasi Supabase di js/config/config.js terlebih dahulu.', 'warning', 6000);
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      debugError('CP-LOGIN-SUBMIT', 'Validasi form gagal: email atau password kosong.');
      showToast('Email dan password wajib diisi.', 'warning');
      return;
    }

    debugLog('CP-LOGIN-SUBMIT', 'Form login disubmit.', { email });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        debugError('CP-LOGIN-RESULT', 'Login gagal di halaman login.', {
          status: error.status,
          code: error.code,
          message: error.message,
        });
        showToast(error.message || 'Login gagal.', 'error', 6000);
        return;
      }

      debugLog('CP-LOGIN-REDIRECT', 'Login sukses, mengarahkan ke ../index.html.', {
        hasSession: Boolean(data?.session),
        userEmail: data?.user?.email || null,
      });

      showToast('Login berhasil.', 'success');
      window.location.href = '../index.html';
    } catch (err) {
      debugError('CP-LOGIN-RESULT', 'Exception tak terduga saat login.', err);
      showToast(err?.message || 'Terjadi kesalahan jaringan saat login.', 'error', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
    }
  });
});
