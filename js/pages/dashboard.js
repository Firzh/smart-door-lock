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
    return {
      value: 'TERBUKA',
      stateClass: 'is-unlocked',
      meta: 'Solenoid aktif (auto-lock 5 dtk)',
    };
  }
  if (state === 'LOCKED') {
    return {
      value: 'TERKUNCI',
      stateClass: 'is-locked',
      meta: 'Pintu dalam kondisi aman',
    };
  }
  return {
    value: 'BELUM DIKETAHUI',
    stateClass: 'is-neutral',
    meta: 'Menunggu respons status ESP32',
  };
}

function getDeviceDisplay(status, deviceId, seenAt) {
  const lastSeenText = seenAt ? formatDateTime(seenAt) : null;

  if (status === 'ONLINE') {
    return {
      value: 'ONLINE',
      stateClass: 'is-online',
      meta: `ID: ${deviceId} • Aktif: ${lastSeenText || '-'}`,
    };
  }
  if (status === 'CHECKING') {
    return {
      value: 'MEMERIKSA...',
      stateClass: 'is-checking',
      meta: `ID: ${deviceId} • Menunggu balasan PING...`,
    };
  }
  if (status === 'UNRESPONSIVE') {
    return {
      value: 'TIDAK MERESPONS',
      stateClass: 'is-offline',
      meta: lastSeenText
        ? `ID: ${deviceId} • Timeout 5 dtk (terakhir: ${lastSeenText})`
        : `ID: ${deviceId} • Tidak ada balasan PING (5 dtk)`,
    };
  }
  if (status === 'OFFLINE') {
    return {
      value: 'OFFLINE',
      stateClass: 'is-offline',
      meta: lastSeenText
        ? `ID: ${deviceId} • Terputus (terakhir: ${lastSeenText})`
        : `ID: ${deviceId} • Perangkat terputus`,
    };
  }
  return {
    value: 'BELUM DIKETAHUI',
    stateClass: 'is-neutral',
    meta: lastSeenText
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

  const secondaryMetricsHtml = [
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
    <section class="dashboard-hero-grid" aria-label="Status utama dan kontrol pintu">
      <article class="hero-status-card ${deviceDisplay.stateClass}">
        <span class="hero-card-label">Perangkat</span>
        <div class="hero-card-value">${escapeHtml(deviceDisplay.value)}</div>
        <div class="hero-card-meta">${escapeHtml(deviceDisplay.meta)}</div>
        <button id="btn-ping-device" type="button" class="btn btn-outline btn-sm">Cek Status (PING)</button>
      </article>

      <article class="hero-status-card ${doorDisplay.stateClass}">
        <span class="hero-card-label">Status kunci</span>
        <div class="hero-card-value">${escapeHtml(doorDisplay.value)}</div>
        <div class="hero-card-meta">${escapeHtml(doorDisplay.meta)}</div>
        <div class="hero-card-meta">Topik: <code>${escapeHtml(topics.STATUS || '-')}</code></div>
      </article>

      <button id="btn-unlock-door" type="button" class="hero-action-btn">
        <span class="hero-action-title">BUKA PINTU</span>
        <span class="hero-action-subtitle">Kirim UNLOCK ke ${escapeHtml(commandTopicLabel)}</span>
      </button>
    </section>

    <section class="metrics-strip" aria-label="Ringkasan koneksi dan statistik">
      ${secondaryMetricsHtml}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Riwayat Akses</h2>
        <a href="#access-logs" class="btn btn-outline btn-sm">Lihat Semua</a>
      </div>
      ${renderAccessTable(logsRes.data, logsEmptyMessage)}
    </section>
  `;

  const unlockBtn = container.querySelector('#btn-unlock-door');
  const unlockTitleEl = unlockBtn?.querySelector('.hero-action-title');
  unlockBtn?.addEventListener('click', async () => {
    unlockBtn.disabled = true;
    if (unlockTitleEl) unlockTitleEl.textContent = 'MENGIRIM...';

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
      if (unlockTitleEl) unlockTitleEl.textContent = 'BUKA PINTU';
    }
  });

  const pingBtn = container.querySelector('#btn-ping-device');
  pingBtn?.addEventListener('click', () => {
    if (typeof actions.onPing === 'function') {
      actions.onPing();
    }
  });
}
