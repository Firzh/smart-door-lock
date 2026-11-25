export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return `${diffSeconds} detik lalu`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

export function formatUid(uid) {
  if (!uid) return '-';
  return String(uid).trim().toUpperCase();
}

export function isValidHexUid(uid, minLen = 8, maxLen = 20) {
  const normalized = String(uid || '').trim().toUpperCase();
  if (!normalized) return false;
  if (!/^[0-9A-F]+$/.test(normalized)) return false;
  if (normalized.length % 2 !== 0) return false;
  return normalized.length >= minLen && normalized.length <= maxLen;
}
