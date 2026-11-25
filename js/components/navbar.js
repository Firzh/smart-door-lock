import { escapeHtml } from '../utils/formatter.js';

const MQTT_BADGE_MAP = {
  connected: { label: 'MQTT: Terhubung', className: 'badge-success' },
  connecting: { label: 'MQTT: Menghubungkan...', className: 'badge-warning' },
  disconnected: { label: 'MQTT: Terputus', className: 'badge-neutral' },
  unconfigured: { label: 'MQTT: Belum Dikonfigurasi', className: 'badge-neutral' },
  offline: { label: 'MQTT: Offline', className: 'badge-danger' },
  error: { label: 'MQTT: Error', className: 'badge-danger' },
};

export function renderNavbar(container, { title, mqttStatus = 'disconnected', onToggleSidebar }) {
  if (!container) return;

  const badge = MQTT_BADGE_MAP[mqttStatus] || MQTT_BADGE_MAP.disconnected;

  container.innerHTML = `
    <div class="navbar-left">
      <button id="sidebar-toggle-btn" type="button" class="menu-toggle" aria-label="Buka menu">
        &#9776;
      </button>
      <h1 class="navbar-title">${escapeHtml(title)}</h1>
    </div>
    <div class="navbar-right">
      <span id="navbar-mqtt-badge" class="badge ${badge.className}">${badge.label}</span>
    </div>
  `;

  const toggleBtn = container.querySelector('#sidebar-toggle-btn');
  if (toggleBtn && typeof onToggleSidebar === 'function') {
    toggleBtn.addEventListener('click', onToggleSidebar);
  }
}

export function updateNavbarMqttStatus(status) {
  const badgeEl = document.getElementById('navbar-mqtt-badge');
  if (!badgeEl) return;

  const badge = MQTT_BADGE_MAP[status] || MQTT_BADGE_MAP.disconnected;
  badgeEl.className = `badge ${badge.className}`;
  badgeEl.textContent = badge.label;
}
