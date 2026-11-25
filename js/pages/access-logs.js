import { getAccessLogs } from '../services/database.js';
import { renderAccessTable } from '../components/access-table.js';
import { showToast } from '../utils/notifications.js';

export async function renderAccessLogs(container) {
  if (!container) return;

  container.innerHTML = `<div class="loading-state">Memuat riwayat akses...</div>`;
  const { data: allLogs, error, configured } = await getAccessLogs(100);

  if (error) {
    showToast(`Gagal memuat log akses: ${error.message}`, 'error');
  }

  const emptyMessage = !configured
    ? 'Konfigurasi Supabase di js/config/config.js untuk menampilkan riwayat akses.'
    : error
      ? `Gagal memuat riwayat akses: ${error.message}`
      : 'Belum ada riwayat akses.';

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header logs-toolbar">
        <h2 class="panel-title">Riwayat Akses Pintu</h2>
        <div class="toolbar-filters">
          <input
            id="log-search-input"
            type="search"
            class="form-control"
            placeholder="Cari UID, perangkat, atau alasan..."
            style="width: 240px;"
          />
          <select id="log-status-filter" class="form-control" style="width: 170px;">
            <option value="all">Semua Hasil</option>
            <option value="GRANTED">Diterima (GRANTED)</option>
            <option value="DENIED">Ditolak (DENIED)</option>
          </select>
          <button id="refresh-logs-btn" type="button" class="btn btn-outline btn-sm">Muat Ulang</button>
        </div>
      </div>

      <div id="logs-table-container">
        ${renderAccessTable(allLogs, emptyMessage)}
      </div>
    </section>
  `;

  const searchInput = container.querySelector('#log-search-input');
  const statusSelect = container.querySelector('#log-status-filter');
  const tableContainer = container.querySelector('#logs-table-container');

  function applyFilters() {
    if (error || !configured) return;

    const query = (searchInput?.value || '').trim().toLowerCase();
    const resultFilter = statusSelect?.value || 'all';

    const filtered = allLogs.filter((log) => {
      const uid = String(log.uid || '').toLowerCase();
      const deviceId = String(log.device_id || '').toLowerCase();
      const method = String(log.method || '').toLowerCase();
      const reason = String(log.reason || '').toLowerCase();
      const result = String(log.result || '').toUpperCase();

      const matchesQuery =
        !query ||
        uid.includes(query) ||
        deviceId.includes(query) ||
        method.includes(query) ||
        reason.includes(query);

      const matchesResult = resultFilter === 'all' || result === resultFilter;
      return matchesQuery && matchesResult;
    });

    if (tableContainer) {
      tableContainer.innerHTML = renderAccessTable(
        filtered,
        'Tidak ada log yang cocok dengan filter.'
      );
    }
  }

  searchInput?.addEventListener('input', applyFilters);
  statusSelect?.addEventListener('change', applyFilters);
  container.querySelector('#refresh-logs-btn')?.addEventListener('click', () => {
    renderAccessLogs(container);
  });
}
