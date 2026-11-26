import { loadAppConfig } from './config/config.js';
import { requireAuth, signOut, watchAuthState } from './auth/auth.js';
import { getSupabaseClient } from './services/supabase.js';
import { mqttService } from './services/mqtt.js';
import { renderSidebar } from './components/sidebar.js';
import { renderNavbar, updateNavbarMqttStatus } from './components/navbar.js';
import { renderDashboard, setDeviceStatus, setDoorState } from './pages/dashboard.js';
import { renderManageCards } from './pages/manage-cards.js';
import { renderAccessLogs } from './pages/access-logs.js';
import { debugError, debugLog, showToast } from './utils/notifications.js';

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  'manage-cards': { title: 'Kelola Kartu RFID', render: renderManageCards },
  'access-logs': { title: 'Riwayat Akses', render: renderAccessLogs },
};

let currentRoute = 'dashboard';
let refreshTimerId = null;
let runtimeConfig = null;

function getRouteFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  return ROUTES[hash] ? hash : 'dashboard';
}

function toggleMobileSidebar(forceClose = false) {
  const sidebar = document.getElementById('sidebar-container');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;

  if (forceClose) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    return;
  }

  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

function scheduleRouteRefresh() {
  if (currentRoute !== 'dashboard' && currentRoute !== 'access-logs') return;
  if (refreshTimerId) window.clearTimeout(refreshTimerId);

  refreshTimerId = window.setTimeout(() => {
    refreshTimerId = null;
    const contentContainer = document.getElementById('app-content');
    if (contentContainer && ROUTES[currentRoute]) {
      ROUTES[currentRoute].render(contentContainer, runtimeConfig);
    }
  }, 600);
}

async function navigate(route) {
  debugLog('CP-APP-NAV', 'Navigasi route dimulai.', { route });
  const isAllowed = await requireAuth();
  if (!isAllowed) return;

  currentRoute = ROUTES[route] ? route : 'dashboard';
  if (window.location.hash !== `#${currentRoute}`) {
    window.location.hash = `#${currentRoute}`;
  }

  const sidebarContainer = document.getElementById('sidebar-container');
  const navbarContainer = document.getElementById('navbar-container');
  const contentContainer = document.getElementById('app-content');

  renderSidebar(sidebarContainer, currentRoute, navigate, signOut);
  renderNavbar(navbarContainer, {
    title: ROUTES[currentRoute].title,
    mqttStatus: mqttService.getStatus(),
    onToggleSidebar: () => toggleMobileSidebar(false),
  });

  toggleMobileSidebar(true);
  await ROUTES[currentRoute].render(contentContainer, runtimeConfig);
}

function handleStatusMessage(rawMessage) {
  try {
    const payload = JSON.parse(rawMessage);
    if (!payload || typeof payload !== 'object') return;

    const statusStr = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
    let changed = false;

    if (payload.online === false || statusStr === 'OFFLINE') {
      changed = setDeviceStatus('OFFLINE') || changed;
    } else if (payload.online === true || ['LOCKED', 'UNLOCKED', 'ONLINE'].includes(statusStr)) {
      changed = setDeviceStatus('ONLINE') || changed;
    }

    if (statusStr === 'LOCKED' || statusStr === 'UNLOCKED') {
      changed = setDoorState(statusStr) || changed;
    }

    if (changed && currentRoute === 'dashboard') {
      const contentContainer = document.getElementById('app-content');
      renderDashboard(contentContainer, runtimeConfig);
    }
  } catch (err) {
    console.warn('Payload status MQTT bukan JSON valid:', err?.message || err);
  }
}

function handleEventMessage(rawMessage) {
  try {
    const payload = JSON.parse(rawMessage);
    if (!payload || typeof payload.event !== 'string') return;

    setDeviceStatus('ONLINE');

    const eventName = payload.event.toUpperCase();
    const uidText = payload.card_uid || payload.uid || '-';

    if (eventName === 'RFID_ACCESS_GRANTED') {
      showToast(`Akses diterima (UID: ${uidText})`, 'success');
    } else if (eventName === 'RFID_ACCESS_DENIED') {
      showToast(`Akses ditolak (UID: ${uidText})`, 'error');
    } else {
      showToast(`Event perangkat: ${payload.event}`, 'info');
    }

    scheduleRouteRefresh();
  } catch (err) {
    console.warn('Payload event MQTT bukan JSON valid:', err?.message || err);
  }
}

function setupMqttListeners(config) {
  const statusTopic = config?.MQTT?.TOPICS?.STATUS;
  const eventTopic = config?.MQTT?.TOPICS?.EVENT;

  debugLog('CP-APP-MQTT', 'Memulai koneksi MQTT dengan runtime config.', {
    hasConfig: Boolean(config?.MQTT),
    brokerUrl: config?.MQTT?.BROKER_URL || null,
    statusTopic: statusTopic || null,
    eventTopic: eventTopic || null,
  });

  mqttService.onStatusChange((status) => {
    debugLog('CP-APP-MQTT', 'Perubahan status MQTT.', { status });
    if (status === 'disconnected' || status === 'offline' || status === 'error') {
      setDeviceStatus('UNKNOWN');
    }
    updateNavbarMqttStatus(status);
    if (currentRoute === 'dashboard') {
      const contentContainer = document.getElementById('app-content');
      renderDashboard(contentContainer, runtimeConfig);
    }
  });

  mqttService.onError((err) => {
    debugError('CP-APP-MQTT', 'Error koneksi MQTT.', err?.message || err);
    showToast(err?.message || 'Terjadi gangguan koneksi MQTT.', 'error');
  });

  mqttService.onMessage((topic, message) => {
    if (statusTopic && topic === statusTopic) {
      handleStatusMessage(message);
    } else if (eventTopic && topic === eventTopic) {
      handleEventMessage(message);
    }
  });

  mqttService.connect(config?.MQTT);
}

async function initApp() {
  debugLog('CP-APP-INIT', 'Inisialisasi aplikasi dashboard dimulai.', {
    href: window.location.href,
  });

  const isAllowed = await requireAuth();
  if (!isAllowed) return;

  watchAuthState(() => {
    mqttService.disconnect();
    window.location.href = './pages/login.html';
  });

  const overlay = document.getElementById('sidebar-overlay');
  overlay?.addEventListener('click', () => toggleMobileSidebar(true));

  window.addEventListener('hashchange', () => {
    navigate(getRouteFromHash());
  });

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      debugLog('CP-APP-CONFIG', 'Memuat app_config dari Supabase...');
      runtimeConfig = await loadAppConfig(supabase);
      debugLog('CP-APP-CONFIG', 'app_config berhasil dimuat.', {
        deviceId: runtimeConfig.DEVICE_ID,
        brokerUrl: runtimeConfig.MQTT?.BROKER_URL,
        topics: runtimeConfig.MQTT?.TOPICS,
      });
    } catch (err) {
      debugError('CP-APP-CONFIG', 'Gagal memuat app_config dari Supabase.', err?.message || err);
      showToast(err?.message || 'Gagal memuat konfigurasi app_config.', 'error', 6000);
    }
  } else {
    debugError('CP-APP-CONFIG', 'Supabase client tidak tersedia saat initApp.');
  }

  await navigate(getRouteFromHash());
  setupMqttListeners(runtimeConfig);
}

document.addEventListener('DOMContentLoaded', initApp);
