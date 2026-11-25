import { getSession, signIn } from '../auth/auth.js';
import { isSupabaseConfigured, isSupabaseSdkLoaded } from '../services/supabase.js';
import { showToast } from '../utils/notifications.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-submit');
  if (!form || !submitBtn) return;

  if (!isSupabaseSdkLoaded()) {
    showToast('Supabase SDK gagal dimuat dari CDN.', 'error');
  } else if (isSupabaseConfigured()) {
    const existingSession = await getSession();
    if (existingSession) {
      window.location.href = '../index.html';
      return;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isSupabaseSdkLoaded()) {
      showToast('Supabase SDK belum termuat.', 'error');
      return;
    }

    if (!isSupabaseConfigured()) {
      showToast('Konfigurasi Supabase di js/config/config.js terlebih dahulu.', 'warning');
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showToast('Email dan password wajib diisi.', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    try {
      const { error } = await signIn(email, password);
      if (error) {
        showToast(error.message || 'Login gagal.', 'error');
        return;
      }

      showToast('Login berhasil.', 'success');
      window.location.href = '../index.html';
    } catch (err) {
      showToast(err?.message || 'Terjadi kesalahan jaringan saat login.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
    }
  });
});
