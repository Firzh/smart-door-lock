import { mqttService } from '../services/mqtt.js';
import { getAccessLogs, getDashboardStats } from '../services/database.js';
import { createStatusCard } from '../components/status-card.js';
import { renderAccessTable } from '../components/access-table.js';
import { escapeHtml, formatDateTime } from '../utils/formatter.js';
import { showToast } from '../utils/notifications.js';

let doorState = 'UNKNOWN';
let deviceStatus = 'UNKNOWN';
let lastSeenAt = null;

export function getDoorState() {
  return doorState;
}

export function setDoorState(nextState) {
  const normalized = String(nextState || '').trim().toUpperCase();
  if (normalized === 'UNLOCKED') {
    doorState = 'UNLOCKED';
    return true;
  }
  if (normalized === 'LOCKED') {
    doorState = 'LOCKED';
    return true;
  }
  return false;
}

export function getDeviceStatus() {
  return deviceStatus;
}

export function setDeviceStatus(nextStatus, timestamp = new Date().toISOString()) {
  const normalized = String(nextStatus || '').trim().toUpperCase();
  if (normalized === 'ONLINE') {
    deviceStatus = 'ONLINE';
    lastSeenAt = timestamp;
    return true;
  }
  if (['OFFLINE', 'UNRESPONSIVE', 'CHECKING', 'UNKNOWN'].includes(normalized)) {
    deviceStatus = normalized;
    return true;
  }
  return false;
}

function getDoorDisplay(state) {
  if (state === 'UNLOCKED') {
    return { value: 'Terbuka', badgeText: 'UNLOCKED', badgeType: 'warning' };
  }
  if (state === 'LOCKED') {
    return { value: 'Terkunci', badgeText: 'LOCKED', badgeType: 'success' };
  }
  return { value: 'Belum diketahui', badgeText: 'MENUNGGU STATUS', badgeType: 'neutral' };
}

function getDeviceDisplay(status, deviceId, seenAt) {
  const lastSeenText = seenAt ? formatDateTime(seenAt) : null;

  if (status === 'ONLINE') {
    return {
      value: 'Online',
      badgeText: 'ONLINE',
      badgeType: 'success',
      subtitle: `ID: ${deviceId} • Aktif: ${lastSeenText || '-'}`,
    };
  }
  if (status === 'CHECKING') {
    return {
      value: 'Memeriksa...',
      badgeText: 'PING...',
      badgeType: 'warning',
      subtitle: `ID: ${deviceId} • Menunggu balasan ESP32...`,
    };
  }
  if (status === 'UNRESPONSIVE') {
    return {
      value: 'Offline / Tidak merespons',
      badgeText: 'TIDAK MERESPONS',
      badgeType: 'danger',
      subtitle: lastSeenText
        ? `ID: ${deviceId} • Tidak ada balasan PING 5 dtk (terakhir aktif: ${lastSeenText})`
        : `ID: ${deviceId} • Tidak ada balasan PING (5 dtk)`,
    };
  }
  if (status === 'OFFLINE') {
    return {
      value: 'Offline',
      badgeText: 'OFFLINE',
      badgeType: 'danger',
      subtitle: lastSeenText
        ? `ID: ${deviceId} • Terputus (terakhir aktif: ${lastSeenText})`
        : `ID: ${deviceId} • Perangkat terputus`,
    };
  }
  return {
    value: 'Belum diketahui',
    badgeText: 'MENUNGGU ESP32',
    badgeType: 'neutral',
    subtitle: lastSeenText
      ? `ID: ${deviceId} • Terakhir aktif: ${lastSeenText}`
      : `ID: ${deviceId} • Belum ada sinyal dari perangkat`,
  };
}

function getMqttDisplay(status) {
  switch (status) {
    case 'connected':
      return { value: 'Online', badgeType: 'success' };
    case 'connecting':
      return { value: 'Menghubungkan', badgeType: 'warning' };
    case 'unconfigured':
      return { value: 'Belum Dikonfigurasi', badgeType: 'neutral' };
    default:
      return { value: 'Offline', badgeType: 'danger' };
  }
}

export async function renderDashboard(container, runtimeConfig = null, actions = {}) {
  if (!container) return;

  container.innerHTML = `<div class="loading-state">Memuat ringkasan dashboard...</div>`;

  const [stats, logsRes] = await Promise.all([
    getDashboardStats(),
    getAccessLogs(8),
  ]);

  if (stats.error) {
    showToast(`Gagal memuat statistik: ${stats.error.message}`, 'error');
  }
  if (logsRes.error) {
    showToast(`Gagal memuat riwayat terbaru: ${logsRes.error.message}`, 'error');
  }

  const topics = runtimeConfig?.MQTT?.TOPICS || mqttService.getTopics();
  const brokerUrl = runtimeConfig?.MQTT?.BROKER_URL || mqttService.getBrokerUrl();
  const deviceId = runtimeConfig?.DEVICE_ID || '-';

  const mqttStatus = mqttService.getStatus();
  const mqttDisplay = getMqttDisplay(mqttStatus);
  const doorDisplay = getDoorDisplay(doorState);
  const deviceDisplay = getDeviceDisplay(deviceStatus, deviceId, lastSeenAt);

  const cardsSubtitle = !stats.configured
    ? 'Supabase belum dikonfigurasi'
    : stats.error
      ? 'Gagal membaca data (periksa RLS/koneksi)'
      : `Total terdaftar: ${stats.totalCards}`;

  const logsSubtitle = !stats.configured
    ? 'Supabase belum dikonfigurasi'
    : stats.error
      ? 'Gagal membaca data (periksa RLS/koneksi)'
      : `Perangkat: ${deviceId}`;

  const statsCardsHtml = [
    createStatusCard({
      title: 'Status Pintu',
      value: doorDisplay.value,
      subtitle: topics.STATUS ? `Topik: ${topics.STATUS}` : 'Topik status belum dimuat',
      badgeText: doorDisplay.badgeText,
      badgeType: doorDisplay.badgeType,
    }),
    createStatusCard({
      title: 'Status Perangkat ESP32',
      value: deviceDisplay.value,
      subtitle: deviceDisplay.subtitle,
      badgeText: deviceDisplay.badgeText,
      badgeType: deviceDisplay.badgeType,
    }),
    createStatusCard({
      title: 'Koneksi MQTT',
      value: mqttDisplay.value,
      subtitle: brokerUrl || 'Menunggu konfigurasi app_config',
      badgeText: mqttStatus,
      badgeType: mqttDisplay.badgeType,
    }),
    createStatusCard({
      title: 'Kartu Aktif',
      value: stats.error ? 'Error' : String(stats.activeCards),
      subtitle: cardsSubtitle,
    }),
    createStatusCard({
      title: 'Total Log Akses',
      value: stats.error ? 'Error' : String(stats.totalLogs),
      subtitle: logsSubtitle,
    }),
  ].join('');

  const logsEmptyMessage = !logsRes.configured
    ? 'Konfigurasi Supabase di js/config/config.js untuk menampilkan log.'
    : logsRes.error
      ? `Gagal memuat log akses: ${logsRes.error.message}`
      : 'Belum ada riwayat akses.';

  const commandTopicLabel = topics.COMMAND || 'Belum dimuat';

  container.innerHTML = `
    <section class="stats-grid" aria-label="Ringkasan status">
      ${statsCardsHtml}
    </section>

    <section class="panel control-panel">
      <div class="control-info">
        <h2>Kontrol Pintu Jarak Jauh</h2>
        <p class="text-muted">
          Kirim perintah JSON <code>{"command":"UNLOCK"}</code> atau <code>{"command":"PING"}</code> ke ESP32 melalui topik
          <code>${escapeHtml(commandTopicLabel)}</code>. Pintu akan terkunci otomatis setelah 5 detik.
        </p>
      </div>
      <div class="control-actions">
        <button id="btn-unlock-door" type="button" class="btn btn-success">Buka Pintu (UNLOCK)</button>
        <button id="btn-ping-device" type="button" class="btn btn-outline">Cek Status (PING)</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Aktivitas Akses Terbaru</h2>
        <a href="#access-logs" class="btn btn-outline btn-sm">Lihat Semua</a>
      </div>
      ${renderAccessTable(logsRes.data, logsEmptyMessage)}
    </section>
  `;

  const unlockBtn = container.querySelector('#btn-unlock-door');
  unlockBtn?.addEventListener('click', async () => {
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Mengirim...';

    try {
      const result = await mqttService.publish(topics.COMMAND, {
        command: 'UNLOCK',
      });

      if (result.ok) {
        showToast('Perintah UNLOCK dikirim ke broker MQTT. Menunggu status dari ESP32...', 'info');
      } else {
        showToast(result.error?.message || 'MQTT belum terhubung.', 'warning');
      }
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Buka Pintu (UNLOCK)';
    }
  });

  const pingBtn = container.querySelector('#btn-ping-device');
  pingBtn?.addEventListener('click', () => {
    if (typeof actions.onPing === 'function') {
      actions.onPing();
    }
  });
}
