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

const PING_TIMEOUT_MS = 5000;

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  'manage-cards': { title: 'Kelola Kartu RFID', render: renderManageCards },
  'access-logs': { title: 'Riwayat Akses', render: renderAccessLogs },
};

let currentRoute = 'dashboard';
let refreshTimerId = null;
let runtimeConfig = null;
let pendingPingRequestId = null;
let pingTimeoutId = null;

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

function renderActiveDashboard() {
  if (currentRoute !== 'dashboard') return;
  const contentContainer = document.getElementById('app-content');
  if (contentContainer) {
    renderDashboard(contentContainer, runtimeConfig, { onPing: sendDevicePing });
  }
}

function clearPendingPing() {
  pendingPingRequestId = null;
  if (pingTimeoutId) {
    window.clearTimeout(pingTimeoutId);
    pingTimeoutId = null;
  }
}

async function sendDevicePing() {
  const commandTopic = runtimeConfig?.MQTT?.TOPICS?.COMMAND || mqttService.getTopics().COMMAND;
  if (!commandTopic || mqttService.getStatus() !== 'connected') {
    showToast('MQTT belum terhubung. Tidak dapat mengirim PING ke ESP32.', 'warning');
    return;
  }

  clearPendingPing();

  const requestId = `ping-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
  pendingPingRequestId = requestId;
  setDeviceStatus('CHECKING');
  renderActiveDashboard();

  debugLog('CP-APP-PING', 'Mengirim PING ke ESP32.', { commandTopic, requestId });

  const result = await mqttService.publish(commandTopic, {
    command: 'PING',
    request_id: requestId,
  });

  if (!result.ok) {
    clearPendingPing();
    setDeviceStatus('UNKNOWN');
    renderActiveDashboard();
    showToast(result.error?.message || 'Gagal mengirim PING ke broker MQTT.', 'warning');
    return;
  }

  pingTimeoutId = window.setTimeout(() => {
    if (pendingPingRequestId !== requestId) return;
    clearPendingPing();
    setDeviceStatus('UNRESPONSIVE');
    renderActiveDashboard();
    debugError('CP-APP-PING', 'Timeout: ESP32 tidak membalas PING dalam 5 detik.', { requestId });
    showToast('ESP32 tidak merespons PING dalam 5 detik.', 'warning');
  }, PING_TIMEOUT_MS);
}

function scheduleRouteRefresh() {
  if (currentRoute !== 'dashboard' && currentRoute !== 'access-logs') return;
  if (refreshTimerId) window.clearTimeout(refreshTimerId);

  refreshTimerId = window.setTimeout(() => {
    refreshTimerId = null;
    const contentContainer = document.getElementById('app-content');
    if (contentContainer && ROUTES[currentRoute]) {
      ROUTES[currentRoute].render(contentContainer, runtimeConfig, { onPing: sendDevicePing });
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
  await ROUTES[currentRoute].render(contentContainer, runtimeConfig, { onPing: sendDevicePing });
}

function handleStatusMessage(rawMessage) {
  try {
    const payload = JSON.parse(rawMessage);
    if (!payload || typeof payload !== 'object') return;

    const reqId = typeof payload.request_id === 'string' ? payload.request_id.trim() : '';
    const deviceStateStr =
      typeof payload.device_status === 'string' ? payload.device_status.trim().toUpperCase() : '';
    const doorStateStr =
      typeof payload.door_status === 'string'
        ? payload.door_status.trim().toUpperCase()
        : typeof payload.status === 'string'
          ? payload.status.trim().toUpperCase()
          : '';

    if (reqId && pendingPingRequestId && reqId !== pendingPingRequestId) {
      debugLog('CP-APP-PING', 'Mengabaikan PONG dengan request_id berbeda.', {
        received: reqId,
        expected: pendingPingRequestId,
      });
      return;
    }

    const pingMatched = Boolean(reqId && pendingPingRequestId && reqId === pendingPingRequestId);
    if (pingMatched) {
      clearPendingPing();
    }

    let changed = false;

    if (payload.online === false || deviceStateStr === 'OFFLINE' || doorStateStr === 'OFFLINE') {
      clearPendingPing();
      changed = setDeviceStatus('OFFLINE') || changed;
    } else if (
      payload.online === true ||
      deviceStateStr === 'ONLINE' ||
      ['LOCKED', 'UNLOCKED', 'ONLINE'].includes(doorStateStr)
    ) {
      // Saat ada PING aktif, abaikan pesan status lama/retained yang tidak membawa request_id yang cocok
      if (!pendingPingRequestId || pingMatched) {
        changed = setDeviceStatus('ONLINE') || changed;
      }
    }

    if (doorStateStr === 'LOCKED' || doorStateStr === 'UNLOCKED') {
      changed = setDoorState(doorStateStr) || changed;
    }

    if (changed) {
      renderActiveDashboard();
    }
  } catch (err) {
    console.warn('Payload status MQTT bukan JSON valid:', err?.message || err);
  }
}

function handleEventMessage(rawMessage) {
  try {
    const payload = JSON.parse(rawMessage);
    if (!payload || typeof payload.event !== 'string') return;

    clearPendingPing();
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
      clearPendingPing();
      setDeviceStatus('UNKNOWN');
    }
    updateNavbarMqttStatus(status);
    renderActiveDashboard();
  });

  mqttService.onReady(() => {
    sendDevicePing();
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
    clearPendingPing();
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
