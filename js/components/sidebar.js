const NAV_ITEMS = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'manage-cards', label: 'Kelola Kartu' },
  { route: 'access-logs', label: 'Riwayat Akses' },
];

export function renderSidebar(container, activeRoute, onNavigate, onLogout) {
  if (!container) return;

  const navLinks = NAV_ITEMS.map(
    (item) => `
      <a
        href="#${item.route}"
        class="sidebar-link ${activeRoute === item.route ? 'active' : ''}"
        data-route="${item.route}"
      >
        <span>${item.label}</span>
      </a>
    `
  ).join('');

  container.innerHTML = `
    <div>
      <div class="sidebar-brand">
        <span class="brand-mark">SDL</span>
        <div>
          <div class="sidebar-brand-title">Smart Door Lock RFID</div>
          <div class="sidebar-brand-subtitle">ESP32 • EMQX • Supabase</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navLinks}</nav>
    </div>

    <div class="sidebar-footer">
      <button id="logout-btn" type="button" class="btn btn-outline btn-block btn-sidebar-logout">
        Keluar
      </button>
    </div>
  `;

  container.querySelectorAll('[data-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const route = link.getAttribute('data-route');
      if (typeof onNavigate === 'function') onNavigate(route);
    });
  });

  const logoutBtn = container.querySelector('#logout-btn');
  if (logoutBtn && typeof onLogout === 'function') {
    logoutBtn.addEventListener('click', onLogout);
  }
}
