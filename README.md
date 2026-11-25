# Smart Door Lock — Frontend Dashboard

Frontend statis (HTML, CSS, Vanilla JS ES Modules) untuk sistem **Smart Door Lock** berbasis ESP32, MQTT (WebSocket Secure / WSS via EMQX), dan Supabase, siap di-deploy ke **GitHub Pages** tanpa proses build.

## Struktur Proyek

```text
smart-door-lock/
├── index.html
├── README.md
├── .gitignore
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── css/
│   ├── style.css
│   ├── variables.css
│   ├── layout.css
│   ├── components.css
│   ├── dashboard.css
│   ├── cards.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── config/
│   │   └── config.js
│   ├── services/
│   │   ├── supabase.js
│   │   ├── mqtt.js
│   │   └── database.js
│   ├── auth/
│   │   └── auth.js
│   ├── components/
│   │   ├── sidebar.js
│   │   ├── navbar.js
│   │   ├── status-card.js
│   │   └── access-table.js
│   ├── pages/
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   ├── manage-cards.js
│   │   └── access-logs.js
│   └── utils/
│       ├── formatter.js
│       └── notifications.js
└── pages/
    └── login.html
```

## Konfigurasi

Buka `js/config/config.js` dan sesuaikan dengan kredensial deployment Anda:

1. **Supabase**
   - `SUPABASE_URL`: URL project Supabase Anda.
   - `SUPABASE_ANON_KEY`: Public `anon` / publishable key Supabase. **Jangan pernah memasukkan `service_role` key atau `DEVICE_API_KEY` ke repository frontend.**
   - Tabel yang digunakan:
     - `TABLES.CARDS`: `authorized_cards` (`id`, `uid`, `owner_name`, `is_active`, `created_at`)
     - `TABLES.LOGS`: `access_logs` (`id`, `card_id`, `uid`, `device_id`, `method`, `result`, `reason`, `created_at`)
     - `TABLES.APP_CONFIG`: `app_config` (`key`, `value`)
   - Pastikan **Row Level Security (RLS)** aktif pada ketiga tabel dan policy hanya mengizinkan operasi yang sah bagi akun admin yang terautentikasi.
   - Nonaktifkan public sign-up pada Supabase Auth jika hanya admin yang dibuat secara manual yang boleh login.

2. **MQTT (WebSocket Secure / WSS — EMQX)**
   - Isi `MQTT.BROKER_URL` dengan endpoint **WebSocket Secure (`wss://`)** dari deployment EMQX Anda (beserta port dan path WSS yang benar), atau simpan di tabel `app_config` (`mqtt_wss_url`, `mqtt_username`, `mqtt_password`) agar dimuat setelah admin login.
   - Gunakan **akun MQTT khusus website** dengan ACL minimum:
     - Publish: `smartdoor/door01/command`
     - Subscribe: `smartdoor/door01/status`
     - Subscribe: `smartdoor/door01/event`
   - **Jangan** gunakan kredensial MQTT milik ESP32 di frontend.
   - Format payload JSON:
     - Command: `{"command":"UNLOCK"}`
     - Status (retained): `{"status":"LOCKED"}` atau `{"status":"UNLOCKED"}`
     - Event: `{"event":"RFID_ACCESS_GRANTED","card_uid":"..."}` / `{"event":"RFID_ACCESS_DENIED","card_uid":"..."}`

3. **Autentikasi**
   - `APP.REQUIRE_AUTH` bernilai `true` secara default agar dashboard dan route internal hanya dapat diakses setelah login melalui `pages/login.html`.

## Menjalankan Secara Lokal

Karena proyek ini menggunakan ES Modules (`type="module"`), jalankan melalui local HTTP server:

```bash
# Menggunakan Python
python -m http.server 8000

# Atau menggunakan Node.js
npx serve .
```

Lalu buka `http://localhost:8000`.

## Deploy ke GitHub Pages

1. Push seluruh isi repository ke GitHub (`main` atau `master`). Jangan sertakan folder `.env` atau kredensial rahasia.
2. Buka **Settings → Pages** di repository GitHub Anda.
3. Pada **Source**, pilih **Deploy from a branch**, lalu pilih branch utama dan folder `/ (root)`.
4. Simpan dan tunggu hingga URL GitHub Pages aktif. Seluruh path aset, CSS, dan JS menggunakan path relatif (`./` dan `../`) sehingga aman di subpath `/<nama-repo>/`.
