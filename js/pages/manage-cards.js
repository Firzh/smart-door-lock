import { CONFIG } from '../config/config.js';
import { getCards, addCard, toggleCardStatus } from '../services/database.js';
import { escapeHtml, formatDateTime, formatUid, isValidHexUid } from '../utils/formatter.js';
import { showToast } from '../utils/notifications.js';

function renderCardsTable(cards, configured, error) {
  if (!configured) {
    return '<div class="empty-state">Konfigurasi Supabase di js/config/config.js untuk mengelola kartu RFID.</div>';
  }

  if (error) {
    return `<div class="empty-state">Gagal memuat daftar kartu: ${escapeHtml(error.message)}</div>`;
  }

  if (!cards.length) {
    return '<div class="empty-state">Belum ada kartu RFID yang terdaftar.</div>';
  }

  const rows = cards
    .map((card) => {
      const isActive = card.is_active !== false;
      return `
        <tr>
          <td><span class="uid-code">${escapeHtml(formatUid(card.uid))}</span></td>
          <td>${escapeHtml(card.owner_name || '-')}</td>
          <td>
            <span class="badge ${isActive ? 'badge-success' : 'badge-neutral'}">
              ${isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td>${escapeHtml(formatDateTime(card.created_at))}</td>
          <td>
            <div class="table-actions">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                data-action="toggle"
                data-id="${escapeHtml(card.id)}"
                data-active="${isActive ? 'true' : 'false'}"
              >
                ${isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>UID Kartu</th>
            <th>Nama Pemilik</th>
            <th>Status</th>
            <th>Ditambahkan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export async function renderManageCards(container) {
  if (!container) return;

  container.innerHTML = `<div class="loading-state">Memuat daftar kartu RFID...</div>`;
  const { data: cards, error, configured } = await getCards();

  if (error) {
    showToast(`Gagal memuat kartu: ${error.message}`, 'error');
  }

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Tambah Kartu RFID Baru</h2>
      </div>
      <form id="add-card-form" class="card-form-grid">
        <div class="form-group">
          <label for="card-uid">UID Kartu (Hex)</label>
          <input id="card-uid" name="uid" type="text" class="form-control" placeholder="Contoh: A1B2C3D4" required />
        </div>
        <div class="form-group">
          <label for="owner-name">Nama Pemilik</label>
          <input id="owner-name" name="owner_name" type="text" class="form-control" placeholder="Contoh: Budi Santoso" required />
        </div>
        <button id="add-card-submit" type="submit" class="btn btn-primary">Simpan Kartu</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-header cards-toolbar">
        <h2 class="panel-title">Daftar Kartu Terdaftar</h2>
        <button id="refresh-cards-btn" type="button" class="btn btn-outline btn-sm">Muat Ulang</button>
      </div>
      ${renderCardsTable(cards, configured, error)}
    </section>
  `;

  const form = container.querySelector('#add-card-form');
  const submitBtn = container.querySelector('#add-card-submit');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const uid = formatUid(form.uid.value);
    const owner_name = form.owner_name.value.trim();

    if (!uid || !owner_name) {
      showToast('UID kartu dan nama pemilik wajib diisi.', 'warning');
      return;
    }

    if (!isValidHexUid(uid, CONFIG.APP.UID_MIN_LENGTH, CONFIG.APP.UID_MAX_LENGTH)) {
      showToast(
        `UID harus berupa hexadecimal genap (${CONFIG.APP.UID_MIN_LENGTH}-${CONFIG.APP.UID_MAX_LENGTH} karakter), contoh: A1B2C3D4.`,
        'warning'
      );
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
      const { error: insertError } = await addCard({ uid, owner_name, is_active: true });
      if (insertError) {
        const isDuplicate =
          insertError.code === '23505' ||
          String(insertError.message || '').toLowerCase().includes('duplicate') ||
          String(insertError.message || '').toLowerCase().includes('unique');
        showToast(
          isDuplicate ? 'UID kartu sudah terdaftar.' : insertError.message,
          'error'
        );
        return;
      }

      showToast('Kartu RFID berhasil ditambahkan.', 'success');
      renderManageCards(container);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Simpan Kartu';
    }
  });

  container.querySelector('#refresh-cards-btn')?.addEventListener('click', () => {
    renderManageCards(container);
  });

  container.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const currentActive = btn.getAttribute('data-active') === 'true';

      btn.disabled = true;
      try {
        const { error: updateError } = await toggleCardStatus(id, !currentActive);
        if (updateError) {
          showToast(updateError.message, 'error');
          return;
        }
        showToast('Status kartu diperbarui.', 'success');
        renderManageCards(container);
      } finally {
        btn.disabled = false;
      }
    });
  });
}
