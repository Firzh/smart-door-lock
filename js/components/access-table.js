import { escapeHtml, formatDateTime, formatUid } from '../utils/formatter.js';

function getResultBadge(result) {
  const normalized = String(result || '').toUpperCase();
  if (normalized === 'GRANTED') {
    return '<span class="badge badge-success">Diterima (GRANTED)</span>';
  }
  if (normalized === 'DENIED') {
    return '<span class="badge badge-danger">Ditolak (DENIED)</span>';
  }
  return `<span class="badge badge-neutral">${escapeHtml(result || '-')}</span>`;
}

export function renderAccessTable(logs = [], emptyMessage = 'Belum ada data riwayat akses.') {
  if (!logs.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  const rows = logs
    .map(
      (log) => `
      <tr>
        <td>${escapeHtml(formatDateTime(log.created_at))}</td>
        <td><span class="uid-code">${escapeHtml(formatUid(log.uid))}</span></td>
        <td>${escapeHtml(log.device_id || '-')}</td>
        <td>${escapeHtml(log.method || '-')}</td>
        <td>${getResultBadge(log.result)}</td>
        <td>${escapeHtml(log.reason || '-')}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>UID Kartu</th>
            <th>Perangkat</th>
            <th>Metode</th>
            <th>Hasil</th>
            <th>Alasan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
