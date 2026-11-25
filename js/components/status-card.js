import { escapeHtml } from '../utils/formatter.js';

export function createStatusCard({
  title,
  value,
  subtitle = '',
  badgeText = '',
  badgeType = 'neutral',
}) {
  const badgeHtml = badgeText
    ? `<span class="badge badge-${escapeHtml(badgeType)}">${escapeHtml(badgeText)}</span>`
    : '';

  const subtitleHtml = subtitle
    ? `<div class="status-card-subtitle">${escapeHtml(subtitle)}</div>`
    : '';

  return `
    <article class="status-card">
      <div class="status-card-header">
        <span class="status-card-title">${escapeHtml(title)}</span>
        ${badgeHtml}
      </div>
      <div class="status-card-value">${escapeHtml(value)}</div>
      ${subtitleHtml}
    </article>
  `;
}
