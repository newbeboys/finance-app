# FinanceApp — Dokumentasi Teknis & Konsep

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-01 (sesi 3 — deadline_date migration ✅, deadline date picker form ✅, goal sorting ✅) | **Versi App:** 2.5.6  
> **Tujuan:** Referensi AI assistant lintas platform. Semua informasi diambil langsung dari kode — bukan asumsi atau template.

---

## Daftar Isi

1. [Overview Aplikasi](#1-overview-aplikasi)
2. [Arsitektur & Struktur Project](#2-arsitektur--struktur-project)
3. [Struktur Database (Supabase)](#3-struktur-database-supabase)
4. [Fitur-Fitur Aplikasi](#4-fitur-fitur-aplikasi)
5. [Sistem Tier (Basic vs Pro)](#5-sistem-tier-basic-vs-pro)
6. [Keputusan Arsitektur Penting](#6-keputusan-arsitektur-penting)
7. [Hal yang Diketahui Belum Sempurna / TODO](#7-hal-yang-diketahui-belum-sempurna--todo)
8. [Konfidensialitas Informasi](#8-konfidensialitas-informasi)
9. [Infrastruktur & Layanan Eksternal](#9-infrastruktur--layanan-eksternal)
10. [Status & Posisi Project Saat Ini (per 28 Juni 2026)](#10-status--posisi-project-saat-ini-per-28-juni-2026)
11. [Roadmap Selanjutnya](#11-roadmap-selanjutnya)

---

## 1. Overview Aplikasi

### Apa itu FinanceApp?
Aplikasi keuangan personal yang berjalan sebagai **aplikasi Android native** (via Capacitor) dan **web app**. Target user adalah individu yang ingin mencatat pengeluaran/pemasukan sehari-hari, memantau saldo beberapa dompet/rekening, mengelola anggaran, dan mencapai tujuan tabungan.

### Model Bisnis
**Freemium** dengan dua tier:
- **Basic** — gratis, dengan batasan jumlah data dan fitur
- **Pro** — berbayar (bulanan atau tahunan), tanpa batasan, fitur penuh

Pembayaran/upgrade dikelola melalui komponen `UpgradeModal` + `SettingsPage` via **Google Play Billing** yang dikelola oleh SDK **RevenueCat** (`@revenuecat/purchases-capacitor@13.2.0`). Flow pembayaran: user pilih plan → SDK RC memanggil Google Play Billing → event webhook dari RC diterima oleh Supabase Edge Function `revenuecat-webhook` → field `plan` di tabel `user_subscriptions` diupdate → realtime subscription di `useSubscription.js` mendeteksi perubahan → UI langsung berubah ke Pro.

### Tech Stack Lengkap (dari `package.json` v2.5.6)

| Teknologi | Versi | Fungsi |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 6.0.0 | Build tool & dev server |
| @capacitor/core | 8.4.0 | Native Android bridge |
| @capacitor/android | 8.4.0 | Android platform layer |
| @capacitor/camera | 8.2.0 | Kamera untuk scan struk |
| @capacitor/filesystem | 8.1.2 | Simpan file PDF ke storage Android |
| @capacitor/share | 8.0.1 | Share dialog native Android |
| @capacitor/status-bar | 8.0.2 | Warna status bar Android |
| @aparajita/capacitor-biometric-auth | 10.0.0 | Autentikasi sidik jari/wajah |
| @revenuecat/purchases-capacitor | 13.2.0 | In-App Purchase & subscription management (Google Play Billing) |
| @supabase/supabase-js | 2.107.0 | Backend-as-a-Service (DB + Auth) |
| i18next | 26.3.1 | Internasionalisasi |
| react-i18next | 17.0.8 | React binding i18next |
| jspdf | 4.2.1 | Generate PDF di sisi client |
| jspdf-autotable | 5.0.8 | Tabel otomatis di PDF |
| exceljs | 4.4.0 | Generate file Excel (.xlsx) |
| html2canvas | 1.4.1 | Screenshot komponen HTML → jsPDF |
| lottie-react | 2.4.1 | Animasi Lottie |

**Dev dependencies:**
- `playwright` 1.60.0 (testing browser — ada tapi jarang dipakai dari kode)
- `md-to-pdf` 5.2.5 (konversi Markdown ke PDF — ada di devDeps)
- `cross-env` 10.1.0 (environment variable lintas OS saat build)

### Bahasa yang Didukung
- **Bahasa Indonesia** (`id`) — default
- **English** (`en`)

Preferensi bahasa disimpan di `localStorage` key `bahasa`. Managed oleh `i18next` + `react-i18next`.

### URL Supabase
- **Project URL:** `https://ykyzgaztfbvwsjdcdpwk.supabase.co`
- URL ini hardcoded sebagai fallback di `src/supabase.js` selain dari env variable `VITE_SUPABASE_URL`.

---

## 2. Arsitektur & Struktur Project

### Struktur Folder

```
root/
├── src/
│   ├── app.jsx                    ← Shell utama; orchestrate semua state & routing
│   ├── main.jsx                   ← Entry point React
│   ├── supabase.js                ← Supabase client singleton
│   ├── data.jsx                   ← Konstanta kategori bawaan, fungsi format Rupiah
│   ├── i18n.js                    ← Konfigurasi i18next
│   ├── index.css                  ← Global CSS (variabel tema, layout)
│   │
│   ├── pages/
│   │   ├── Login.jsx              ← Halaman login
│   │   ├── Register.jsx           ← Halaman daftar akun
│   │   ├── ForgotPassword.jsx     ← Lupa password (4-step: email→OTP→password baru→sukses)
│   │   └── RecurringTransactionPage.jsx ← Halaman kelola transaksi berulang
│   │
│   ├── hooks/
│   │   ├── useSubscription.js     ← STATUS PLAN aktif + semua limit fitur (sumber kebenaran)
│   │   ├── useRevenueCat.js       ← Lifecycle SDK RevenueCat (configure, logIn, purchase, restore)
│   │   ├── useTransactions.js     ← CRUD transaksi ke Supabase
│   │   ├── useWallets.js          ← CRUD dompet + adjustBalance
│   │   ├── useBudgets.js          ← CRUD anggaran (spent SELALU dihitung dari tx)
│   │   ├── useSavings.js          ← CRUD tabungan/goals + deposit
│   │   ├── useCustomCategories.js ← CRUD kategori kustom
│   │   ├── useNotifications.js    ← Notifikasi lokal (localStorage, tidak Supabase)
│   │   ├── useAutoLock.js         ← Auto-lock setelah idle di background
│   │   └── useScrollLock.js       ← Kunci scroll body saat modal terbuka
│   │
│   ├── lib/
│   │   ├── planLimits.js          ← SUMBER KEBENARAN limit Basic vs Pro
│   │   ├── planReconciliation.js  ← Lock/unlock data saat downgrade/upgrade
│   │   ├── pin.js                 ← Hash PIN (SHA-256 + salt), verifikasi
│   │   ├── biometric.js           ← Helper biometrik native
│   │   ├── recurringHelper.js     ← Scheduler transaksi berulang (localStorage)
│   │   ├── widgetSync.js          ← Sinkronisasi data ke widget home screen Android
│   │   ├── strukParser.js         ← Parser teks OCR struk belanja → data transaksi
│   │   └── sound.js               ← Play audio notifikasi
│   │
│   ├── components/
│   │   ├── PaywallModal.jsx       ← Modal upsell saat Basic hit limit
│   │   ├── PinSetup.jsx           ← UI setup/ganti PIN
│   │   ├── PinLock.jsx            ← Layar input PIN saat app terkunci
│   │   ├── BiometricLock.jsx      ← Layar autentikasi biometrik
│   │   ├── OnboardingScreen.jsx   ← Onboarding setelah register/login pertama
│   │   ├── ScanStruk.jsx          ← Kamera + OCR struk belanja
│   │   ├── BottomNav.jsx          ← Navigasi bawah (mobile)
│   │   ├── MonthYearPicker.jsx    ← Picker bulan/tahun modern (modal centered, grid 3×4, year nav)
│   │   ├── RecurringTransactionForm.jsx ← Form tambah/edit transaksi berulang
│   │   ├── DeleteCategoryModal.jsx
│   │   ├── EditCategoryModal.jsx
│   │   ├── GoalCompleteOverlay.jsx ← Animasi selebrasi saat goal 100%
│   │   └── subscription/
│   │       ├── UpgradeModal.jsx
│   │       ├── SubscriptionStatus.jsx
│   │       ├── FeatureComparison.jsx
│   │       └── RestorePurchaseButton.jsx
│   │
│   ├── locales/
│   │   ├── id/translation.json    ← String bahasa Indonesia
│   │   └── en/translation.json    ← String bahasa Inggris
│   │
│   ├── transactions.jsx           ← TransactionsCard (dashboard) + AddTransactionModal
│   ├── transactions-page.jsx      ← Halaman riwayat transaksi penuh
│   ├── analytics.jsx              ← Halaman analitik (grafik, Money IQ, WeeklySummary)
│   ├── reports.jsx                ← Halaman laporan + export PDF/Excel
│   ├── budgets-page.jsx           ← Halaman anggaran
│   ├── savings-page.jsx           ← Halaman tabungan/goals
│   ├── settings-page.jsx          ← Halaman pengaturan
│   ├── wallets.jsx                ← WalletsPage + AccountSwitcher + AccountTxSheet + WalletDeleteConfirmation + AddAccountModal
│   ├── widgets.jsx                ← KpiCards, CashflowCard, InsightsCard, WeeklySummaryCard, dll
│   ├── charts.jsx                 ← SpendingDonut component
│   ├── category-field.jsx         ← CategoryField (pilih kategori di form transaksi)
│   ├── topbar.jsx                 ← Top bar (notifikasi, pilih dompet, toggle tema)
│   └── tweaks-panel.jsx           ← Panel debug tersembunyi (dev only)
│
├── supabase/
│   ├── schema.sql                 ← Tabel dasar
│   ├── migrations.sql             ← ALTER TABLE (color, last4, wallet_id, dll)
│   ├── subscriptions.sql          ← Tabel user_subscriptions + trigger auto-Basic
│   ├── custom_categories.sql      ← Tabel custom_categories + RLS
│   ├── migrations/
│   │   ├── 20260629000000_add_revenuecat_fields.sql        ← Tambah kolom RC ke user_subscriptions
│   │   ├── 20260630000001_secure_user_subscriptions_rls.sql ← Hapus policy UPDATE generik, tambah RPC cooldown
│   │   └── 20260630000002_add_set_plan_testing_rpc.sql     ← RPC set_plan_for_testing (dev only)
│   └── functions/
│       └── revenuecat-webhook/
│           └── index.ts           ← Edge Function: terima event webhook dari RevenueCat
│
├── docs/
│   └── SETUP.md                   ← Panduan setup environment developer
├── .env.example                   ← Template environment variable
├── capacitor.config.json          ← App ID, nama, plugin config
├── vite.config.js                 ← Konfigurasi build (minimal)
└── package.json                   ← Dependencies + scripts
```

#### MonthYearPicker — Reusable Component Filter Bulan/Tahun Modern

- **File:** `src/components/MonthYearPicker.jsx`
- **Deskripsi:** Modal centered dengan grid 3×4 bulan, year navigation (`‹ tahun ›`), dan tombol confirm "Pilih [Bulan] [Tahun]". Styling konsisten dengan design system FinanceApp (border-radius, padding, CSS variables).
- **Props:**
  - `isOpen` — apakah modal terbuka
  - `onClose()` — callback saat modal ditutup (klik backdrop atau Escape)
  - `onConfirm(month, year)` — callback saat user tekan tombol confirm; `month` = 0-indexed (Jan=0)
  - `locale` — locale string untuk format nama bulan, default `'id-ID'`
  - `initialMonth` / `initialYear` — opsional; bulan/tahun yang di-highlight saat pertama buka
  - `availableMonthsByYear` — opsional; `{ [year]: [0,1,...] }` untuk disable bulan yang tidak punya data
- **Internal scroll lock:** `useScrollLock(isOpen)` sudah ada di dalam component — pemanggil **tidak perlu** tambah `useScrollLock` sendiri
- **Used in:** `CashflowCard` (beranda), `SpendingCard` (beranda), `TransactionsPage`, `AnalyticsPage`
- **Status:** ✅ Selesai & tested di semua halaman

---

### Data Flow

```
User Action
    │
    ▼
React Component (UI state)
    │
    ├── Operasi lokal (theme, filter, modal open/close)
    │       └── React useState / useReducer
    │
    └── Operasi data permanen
            │
            ├── Supabase (data utama)
            │       ├── useTransactions  → tabel transactions
            │       ├── useWallets       → tabel wallets
            │       ├── useBudgets       → tabel budgets
            │       ├── useSavings       → tabel savings
            │       ├── useCustomCategories → tabel custom_categories
            │       └── useSubscription  → tabel user_subscriptions
            │
            └── localStorage (data lokal)
                    ├── useNotifications → key: notif_data, notif_prefs
                    ├── recurringHelper  → key: recurringTransactions
                    ├── WeeklySummaryCard → key: weeklyKpiDismissed_{date}_{walletId}
                    ├── Tweaks/Preferensi → key: finance_tweaks
                    └── PIN/Biometrik    → key: appPIN, appPIN_salt, pinAktif, biometrikAktif
```

**State Management:** Tidak ada library Redux/Zustand. Semua state dikelola via React `useState` + custom hooks. State global "dielevate" ke `app.jsx` dan diteruskan sebagai props ke komponen anak. Tidak ada React Context kecuali `PaywallModal` (via `usePaywall()` hook).

**Realtime Supabase:** Beberapa tabel berlangganan event realtime untuk sinkronisasi multi-device:
- `wallets` — event UPDATE (deteksi perubahan `is_locked` dari rekonsiliasi plan)
- `savings` — event UPDATE (sama)
- `user_subscriptions` — event UPDATE (deteksi perubahan plan)
- `custom_categories` — event INSERT/UPDATE/DELETE

---

## 3. Struktur Database (Supabase)

> Semua tabel menggunakan Row Level Security (RLS) — user hanya bisa mengakses data miliknya sendiri.

### Tabel `transactions`
```sql
id          uuid            PRIMARY KEY (auto)
user_id     uuid            NOT NULL, FK → auth.users
type        text            'expense' | 'income'
amount      numeric         Positif untuk income, negatif untuk expense
category    text            ID kategori bawaan ATAU UUID kategori kustom
merchant    text            Nama merchant/toko
note        text            Catatan bebas
date        date            Tanggal transaksi (lokal, BUKAN UTC) — format YYYY-MM-DD
time        text            Jam transaksi — format HH:MM
method      text            'Tunai' | 'Transfer' (atau nilai lain user input)
wallet_id   uuid            FK → wallets.id (nullable; ditambah via migrations.sql)
created_at  timestamptz     Auto-set oleh Supabase
```

**Catatan penting:** Kolom `wallet_id` ditambahkan via `migrations.sql`, bukan di `schema.sql` awal. Artinya transaksi lama mungkin tidak punya `wallet_id`.

### Tabel `wallets`
```sql
id          uuid            PRIMARY KEY (auto)
user_id     uuid            NOT NULL, FK → auth.users
name        text            Nama dompet (tampil di UI)
bank        text            Nama bank/institusi
balance     numeric         Saldo — diupdate manual oleh app via adjustBalance()
type        text            'bank' | 'ewallet' | 'cash' | 'investment'
is_primary  boolean         Dompet utama; maksimal satu per user (diatur via updateall)
color       text            Kode warna hex (ditambah via migrations.sql)
last4       text            4 digit terakhir kartu/nomor rekening (default '—')
is_locked   boolean         true saat Basic user melebihi limit (dikunci saat downgrade)
created_at  timestamptz
```

**Cara kerja saldo:** Saldo **tidak** dihitung otomatis dari transaksi. Saldo diupdate secara atomic di sisi client saat transaksi dibuat/diedit/dihapus via fungsi `adjustBalance()`. Saldo awal diinput manual saat membuat dompet.

### Tabel `budgets`
```sql
id          uuid            PRIMARY KEY (auto)
user_id     uuid            NOT NULL, FK → auth.users
category    text            ID kategori (bisa null untuk budget tanpa kategori spesifik)
label       text            Nama budget
limit       numeric         Batas pengeluaran (dalam Rupiah)
spent       numeric         ADA di DB tapi TIDAK DIPAKAI — spent selalu dihitung dari tx
color       text            Warna tampilan
enabled     boolean         ADA di DB tapi semua budget tetap ditampilkan di UI
created_at  timestamptz
```

**Cara kerja spent:** Saat UI menampilkan progress budget, `spent` dihitung langsung dari array `transactions` yang sudah di-load di memori — bukan dari kolom `spent` di database. Ini memastikan angka selalu sinkron dengan transaksi aktual.

### Tabel `savings`
```sql
id              uuid        PRIMARY KEY (auto)
user_id         uuid        NOT NULL, FK → auth.users
name            text        Nama goal (tampil di UI)
target          numeric     Target nominal tabungan
current         numeric     Saldo terkumpul saat ini (diupdate via depositToGoal)
deadline        date        Tanggal target (nullable, kolom lama — dipertahankan untuk kompatibilitas)
deadline_label  text        Label tampilan "Jan 2026" atau "Tanpa tenggat"
color           text        Warna tampilan (8 pilihan preset)
icon            text        Ikon (star, emergency, travel, home, vehicle, education, gadget, gift, health, ring)
is_locked       boolean     true saat Basic user melebihi limit
deadline_date   date        Tanggal deadline dalam format ISO (YYYY-MM-DD); nullable — ditambah migration `20260701000000`, dipakai untuk sorting goals by deadline terdekat. Bekerja bersamaan dengan `deadline_label` (teks) untuk keperluan display & sorting; NULL untuk goal lama sampai diedit ulang
created_at      timestamptz
```

**Cara kerja deposit:** Deposit ke goal adalah operasi manual — user pilih nominal, `current` di-increment di Supabase. **TIDAK ADA** koneksi otomatis antara transaksi kategori "tabungan" dengan goal tabungan.

### Tabel `custom_categories`
```sql
id          uuid            PRIMARY KEY (auto)
user_id     uuid            NOT NULL, FK → auth.users
name        text            Nama kategori (case-insensitive unique per user)
color       text            Warna hex
type        text            'income' | 'expense' (default 'expense')
is_deleted  boolean         Soft delete — tidak pernah hard delete
is_locked   boolean         true saat Basic user melebihi limit
created_at  timestamptz
-- UNIQUE CONSTRAINT: (user_id, lower(name))
```

**Soft delete:** Kategori yang dihapus user hanya di-flag `is_deleted = true`. Ini penting agar transaksi lama yang pakai kategori tersebut masih bisa diresolvesi nama & warnanya.

### Tabel `user_subscriptions`
```sql
user_id                    uuid         PRIMARY KEY, FK → auth.users
plan                       text         'basic' | 'pro'
billing_cycle              text         'monthly' | 'yearly' | null
started_at                 timestamptz
expires_at                 timestamptz  null = tidak ada kadaluarsa (Pro permanen atau Basic default)
updated_at                 timestamptz  auto-update via trigger
last_custom_category_edit_at timestamptz  Terakhir user mengedit nama/warna kategori kustom (cooldown 30 hari)
-- Kolom baru (migration 20260629000000) — diisi oleh revenuecat-webhook Edge Function:
revenuecat_app_user_id     text         RC App User ID (= Supabase user_id)
product_id                 text         ID produk yang dibeli (mis. pro_monthly)
original_purchase_at       timestamptz  Timestamp pembelian pertama
latest_event_type          text         Tipe event RC terakhir (INITIAL_PURCHASE, RENEWAL, dll)
latest_event_at            timestamptz  Timestamp event RC terakhir
raw_event                  jsonb        Payload mentah dari webhook RC (untuk audit/debug)
```

**Trigger otomatis:** Ada trigger Supabase yang otomatis membuat row `user_subscriptions` dengan `plan='basic'` setiap kali user baru mendaftar.

**Trigger `updated_at`:** Migration `20260629000000` menambah trigger `trigger_user_subscriptions_updated_at` yang otomatis mengisi `updated_at = now()` setiap kali baris diupdate.

**Keamanan RLS (diperbarui 30 Juni 2026):** Policy `"Users can update own subscription"` dihapus. Kolom sensitif (`plan`, `expires_at`, `revenuecat_app_user_id`, dll.) kini **tidak bisa diupdate langsung dari client**. Update hanya bisa dilakukan oleh:
- Edge Function `revenuecat-webhook` (menggunakan `service_role`, bypass RLS)
- RPC function SECURITY DEFINER (lihat bagian 6.8)

**Logika isPro:**
```javascript
// User dianggap Pro HANYA jika:
isPro = plan === 'pro' && (expires_at === null || new Date(expires_at) > new Date())
```

---

## 4. Fitur-Fitur Aplikasi

### 4.1 Authentication

**Login** (`src/pages/Login.jsx`)
- Email + password via `supabase.auth.signInWithPassword()`
- Setelah login sukses: `validateUserStillExists()` memvalidasi user belum dihapus dari backend
- Jika user tidak valid: `logoutDeletedUser()` dipanggil → session dibersihkan

**Register** (`src/pages/Register.jsx`)
- Input: Nama, Email, Password (min 6 karakter)
- `supabase.auth.signUp()` dengan `options.data.full_name`
- Email verifikasi dikirim; redirect URL: `https://newbeboys.github.io/financeapp-email-verification/email-confirmed.html`
- Setelah register: `showOnboarding = true` → tampilkan `OnboardingScreen`

**Lupa Password** (`src/pages/ForgotPassword.jsx`)
- **4 langkah:**
  1. Input email → `supabase.auth.resetPasswordForEmail()`
  2. Input OTP 6 digit → `supabase.auth.verifyOtp()`
  3. Input password baru (min 6 char, konfirmasi harus sama) → `supabase.auth.updateUser()`
  4. Sukses → redirect ke login (otomatis 3 detik)
- Tombol "Kirim Ulang OTP" dengan cooldown 60 detik

**Gerbang Keamanan Saat Buka App**
Urutan yang diterapkan saat app pertama dibuka:
```
PIN aktif?    → Tampilkan PinLock terlebih dahulu
  │ ya → Verifikasi berhasil → Splash 3 detik → Konten
  │ tidak →
Biometrik aktif? → Tampilkan BiometricLock
  │ ya → Verifikasi berhasil → Splash 3 detik → Konten
  │ tidak →
Langsung → Splash 3 detik → Konten
```

---

### 4.2 Catat Transaksi

**Lokasi kode:** `src/transactions.jsx` (modal) + `src/hooks/useTransactions.js` (operasi Supabase)

**Field yang tersedia di form:**
| Field | Wajib | Keterangan |
|---|---|---|
| Tipe | Ya | Toggle Pengeluaran / Pemasukan |
| Jumlah | Ya | Input numerik format Rupiah |
| Merchant | Tidak | Nama toko/pembayar |
| Kategori | Ya | Dropdown kategori bawaan + kustom |
| Dompet | Ya* | Dropdown dompet (*wajib jika user punya dompet) |
| Metode | Ya | Toggle Tunai / Transfer |
| Catatan | Tidak | Teks bebas |
| Tanggal | Ya | Date picker (lokal, bukan UTC) |
| Berulang | Tidak | Checkbox (menandai, bukan menjadwalkan) |

**Cara kerja saat simpan transaksi:**
1. Data dikirim ke Supabase (`useTransactions.createTransaction`)
2. Jika berhasil dan ada `wallet_id` → `adjustBalance(wallet_id, amount)` dipanggil
3. Untuk edit: saldo dompet lama di-reverse, saldo dompet baru diupdate
4. Untuk hapus: saldo dompet di-reverse

**Scan Struk** (Pro only):
- Kamera Android via Capacitor Camera plugin
- OCR offline via `MlkitOcr` (plugin native custom, tidak open source)
- Hasil OCR diparse oleh `src/lib/strukParser.js` → prefill form transaksi
- Di web: fitur tidak tersedia (dijaga `Capacitor.isNativePlatform()`)

**Batas transaksi bulanan (Basic):** 75 transaksi per bulan kalender berdasarkan tanggal transaksi (bukan `created_at`).

#### Halaman Transaksi Lengkap (TransactionsPage)

- **Lokasi kode:** `src/transactions-page.jsx`
- **Akses:** Menu "Transaksi" di BottomNav → halaman full dengan seluruh history transaksi
- **Filter Bulan:** Tombol "Pilih Bulan" di area filter (sejajar dengan search, type filter, kategori filter, metode filter) → buka `MonthYearPicker`; default: bulan sekarang
- **KPI Dinamis:** 3 kartu stat (Pemasukan | Pengeluaran | Selisih) yang otomatis update saat bulan berubah
- **List Transaksi:** Hanya menampilkan transaksi bulan yang dipilih; dikelompokkan per tanggal lokal (YYYY-MM-DD)
- **Empty State:** Jika bulan dipilih tapi kosong → "Belum ada transaksi di bulan ini"
- **Filter lain tetap aktif:** Search, type filter, kategori, metode — semua AND logic bersama filter bulan
- **Benefit performa:** Halaman tidak scroll panjang (max ~5–30 tx/bulan vs seluruh data historis sebelumnya)

---

### 4.3 Dompet (Wallets)

**Lokasi kode:** `src/wallets.jsx` (UI) + `src/hooks/useWallets.js` (logika)

**Tipe dompet yang tersedia:** Rekening Bank, E-Wallet, Tunai, Investasi

**Cara kerja saldo:**
- Saldo **TIDAK** dihitung dari transaksi — ini bukan rekonsiliasi otomatis
- Saldo diupdate via `adjustBalance(walletId, delta)` setiap kali transaksi dibuat/diedit/dihapus
- `adjustBalance` membaca saldo saat ini dari state React (yang sudah sinkron via realtime), menghitung `newBalance = current + delta`, lalu tulis ke Supabase
- **Kelemahan yang diketahui:** Jika transaksi lama (sebelum fitur `wallet_id` ditambah) tidak punya `wallet_id`, saldo tidak terpengaruh oleh transaksi tersebut

**Fungsi `txForAccount`:**
```javascript
t.wallet_id === account.id ||
(t.wallet_id == null && account.primary === true)
// Transaksi tanpa wallet_id (transaksi lama) dianggap milik dompet utama
```

#### Halaman Dompet — Fitur Hapus dengan Warning Cascade Delete

- **Tombol Hapus:** Button "🗑️ Hapus Dompet" (warna terra/merah) di area heading halaman, bukan di setiap card
- **Status Button:** Disabled (opacity 0.5, `cursor: not-allowed`) jika hanya ada 1 dompet — tidak boleh hapus dompet terakhir
- **Dropdown:** Klik tombol → dropdown modal muncul dengan list semua dompet (icon, nama, saldo); klik backdrop → tutup
- **Modal Konfirmasi (`WalletDeleteConfirmation`):** Saat user pilih dompet dari dropdown → bottom sheet terbuka dengan peringatan: `⚠️ [X transaksi] terhubung ke dompet ini akan hilang selamanya`
- **Cascade Delete:** Tombol "Hapus Selamanya" → `onDelete(id)` dipanggil → database cascade delete transaksi via FK `wallet_id ON DELETE CASCADE`
- **Safety:** Guard satu-satunya = `accounts.length > 1`; semua dompet (termasuk primary) bisa dihapus selama bukan satu-satunya
- **State yang digunakan:** `deletingWallet` (object dompet yang sedang dikonfirmasi) + `deleteDropdownOpen` (boolean visibility dropdown)

#### Fix: Kategori Custom di Detail Dompet (AccountTxSheet)

- **Sebelumnya:** Daftar transaksi di bottom sheet detail dompet selalu lookup dari `ALL_CATEGORIES` saja → UUID kategori kustom tidak dikenali, tampil sebagai ID mentah
- **Sekarang:** Prop `customCategories` diteruskan `app.jsx` → `WalletsPage` → `AccountTxSheet`
- **Resolve:** Kategori di-resolve via `resolveCategory(t.category, customCategories)` dari `category-field.jsx`
- **Label:** Ditampilkan via `categoryLabel(cat, tr)` — `tr` adalah alias rename dari `const { t: tr } = useTranslation()` agar tidak di-shadow oleh variable `t` (transaction object) di dalam `transactions.map()`
- **Result:** Kategori custom sekarang tampil nama & warna yang benar, bukan UUID

**Batas:** Basic = 1 dompet, Pro = tidak terbatas

**Saat downgrade Pro → Basic:**
- Dompet ke-2 dan seterusnya (diurutkan berdasarkan `created_at` ASC, yang paling lama tetap aktif) mendapat `is_locked = true`
- Dompet terkunci masih terlihat di UI tapi tidak bisa diubah saldo-nya dari transaksi baru

---

### 4.4 Kategori Kustom

**Lokasi kode:** `src/hooks/useCustomCategories.js` + `src/category-field.jsx`

**Cara kerja:**
- Tersedia untuk tipe Pengeluaran atau Pemasukan (terpisah)
- Warna dipilih dari 8 preset warna saat pembuatan
- Nama unik per user (case-insensitive); jika duplikat → dikembalikan kategori yang sudah ada
- Soft delete: flag `is_deleted = true`, tidak pernah dihapus dari database (agar transaksi lama tetap bisa diresolvesi)

**Cooldown edit (Basic only):** 30 hari setelah mengedit nama/warna kategori kustom. Pro tidak ada cooldown.

**Batas:** Basic = 3 aktif, Pro = tidak terbatas

---

### 4.5 Anggaran (Budget)

**Lokasi kode:** `src/budgets-page.jsx` + `src/hooks/useBudgets.js`

**Cara kerja (PENTING — berdasarkan kode aktual):**

Budget **TERHUBUNG OTOMATIS** ke transaksi, tapi secara **read-only dan satu arah**:
- Kolom `spent` di database **tidak dipakai**
- Saat UI menampilkan progress bar budget, `spent` dihitung secara real-time dari array transaksi yang sudah di-load di memori React
- Formula: `spent = sum(|amount|)` untuk semua transaksi dengan `category === budget.categoryId` dalam periode aktif
- Mencatat transaksi pengeluaran dalam kategori tertentu **secara otomatis menambah progress** budget kategori tersebut
- **Tidak ada** mekanisme untuk "menarik" uang dari budget — budget hanya pelacak, bukan rekening

**Periode:** UI menampilkan toggle Bulanan/Mingguan, tapi di database **tidak ada kolom periode** — semua budget disimpan tanpa info periode. Periode hanya mempengaruhi cara menghitung `spent` di client.

**Notifikasi budget:**
- 80% terpakai → notifikasi peringatan
- 100%+ → notifikasi over-budget

**Batas:** Basic = 7 budget, Pro = tidak terbatas

---

### 4.6 Tabungan / Goals

**Lokasi kode:** `src/savings-page.jsx` + `src/hooks/useSavings.js`

**Cara kerja (PENTING — berdasarkan kode aktual):**

Goals bersifat **MANUAL** — tidak ada koneksi otomatis ke transaksi:
- `current` (saldo terkumpul) hanya berubah saat user secara eksplisit melakukan deposit via tombol "Tambah Dana"
- Tidak ada cara untuk otomatis "menyisihkan" transaksi ke goal
- Deposit bisa dilakukan dengan quick buttons (+100K, +500K, +1M, +2.5M) atau input manual

**Fitur:**
- 10 pilihan ikon (star, emergency, travel, home, vehicle, education, gadget, gift, health, ring)
- 8 pilihan warna preset
- Deadline: dipilih via date picker (`DatePickerPopup`, reuse dari `transactions.jsx`) — bukan lagi input teks bebas. Hasil pilihan disimpan sebagai label ringkas ("Jan 2026") di `deadline_label` ATAU ISO date di `deadline_date`. Tombol "Bersihkan" mengembalikan ke "Tanpa tenggat"
- Sorting otomatis: goal dengan `deadlineDate` terdekat tampil paling atas, goal tanpa deadline (NULL) selalu di bawah. Sorting berjalan di client (`sortGoalsByDeadline` di `savings-page.jsx`), dihitung ulang tiap render, bukan query Supabase
- Animasi perayaan (`GoalCompleteOverlay`) ketika goal mencapai 100% untuk pertama kali (hanya jika Sound/Animasi diaktifkan)

**Batas:** Basic = 2 goals, Pro = tidak terbatas

**Catatan:** Belum ada form Edit Goal (hanya Add/Delete/Deposit) — jadi goal lama yang dibuat sebelum migration `20260701000000` akan punya `deadline_date = NULL` selamanya sampai fitur edit goal dibuat.

---

### 4.6a Beranda (Dashboard) — CashflowCard & SpendingCard

**Lokasi kode:** `src/widgets.jsx` (card components) + `src/app.jsx` (render di tab Beranda)

#### CashflowCard — Arus Kas Pemasukan vs Pengeluaran

- **Filter scope:** Toggle "1M / 6M / 1Y" → tampilkan 1 bulan terakhir / 6 bulan terakhir / 1 tahun terakhir
- **Filter bulan spesifik:** Tombol "Pilih Bulan" → `MonthYearPicker` modal terbuka; setelah pilih, scope otomatis berubah ke "1 Bulan" dengan bulan terpilih
- **Sebelumnya:** Bottom sheet custom dengan grid bulan & grouping by-year (scroll manual)
- **Sekarang:** `MonthYearPicker` — konsisten dengan design halaman lain
- **Grafik:** Bar chart pemasukan vs pengeluaran; daily mode (mode 1M, tiap hari) atau monthly mode (mode 6M/1Y, tiap bulan)

#### SpendingCard — Rincian Pengeluaran Per Kategori

- **Filter bulan:** Tombol "Pilih Bulan" → `MonthYearPicker` modal; default: bulan sekarang
- **Sebelumnya:** Bottom sheet custom dengan list 24 bulan terakhir (scroll, grouped by-year)
- **Sekarang:** `MonthYearPicker` — sama design dengan CashflowCard
- **Donut Chart:** Komposisi pengeluaran per kategori untuk bulan terpilih
- **Tabel:** Top-N kategori dengan nominal + persen + progress bar mini
- **Data:** Di-filter berdasarkan `dateRaw` yang starts with prefix `YYYY-MM` bulan terpilih

---

### 4.7 Analitik

**Lokasi kode:** `src/analytics.jsx`

**Komponen yang ada:**
1. **Filter tanggal** — toggle "1 Tahun" (12 bulan terakhir) atau "1 Bulan" (pilih bulan spesifik via `MonthYearPicker` — modal centered dengan grid 3×4 bulan dan navigasi tahun ‹/›)
2. **Filter dompet** — dropdown "Semua Dompet" + dompet individual; **HANYA tampil jika user punya > 1 dompet**
3. **Stat strip** — 4 kartu: total pemasukan, total pengeluaran, selisih bersih, rata-rata/bulan atau /hari
4. **Bar chart** — pemasukan vs pengeluaran per hari (mode bulan) atau per bulan (mode tahun)
5. **Donut chart + tabel** — komposisi pemasukan per kategori
6. **Donut chart + tabel** — komposisi pengeluaran per kategori
7. **Money IQ** — insight rule-based (dengan threshold data sparse)
8. **WeeklySummaryCard** — ringkasan minggu lalu

**Filter dompet dan tanggal bekerja dengan AND logic:**
- Semua kalkulasi (bar chart, donut, Money IQ) dijalankan pada `filteredByWallet` yang sudah difilter dompet
- `txInScope` = subset yang juga difilter tanggal → dipakai untuk threshold Money IQ

**Money IQ threshold:**
- Jika `txInScope.length < 5` → tampilkan pesan "Data terlalu sedikit..." (bukan insight)
- Threshold berlaku untuk semua kondisi, termasuk filter "Semua Dompet"

**Empty state khusus dompet:**
- Jika dompet dipilih DAN `txInScope.length === 0` → tampilkan kartu empty state khusus, sembunyikan semua grafik dan Money IQ
- WeeklySummaryCard tetap ditampilkan (karena hitung dari periode berbeda — minggu lalu)

**Edge case dompet dihapus:**
- `useEffect` memantau `accounts` — jika dompet yang dipilih tidak ada lagi di daftar, filter otomatis fallback ke "Semua Dompet"

#### Filter Bulan di Analitik

- **Sebelumnya:** Bottom sheet custom (grid 4 kolom, by-year grouping, scroll manual) — berbeda design dengan halaman lain
- **Sekarang:** `MonthYearPicker` modal modern — konsisten dengan CashflowCard, SpendingCard, TransactionsPage
- **UI Button:** "1 Bulan ▾" di area filter scope (sejajar "1 Tahun" dan wallet filter dropdown)
- **Behavior:** Klik → `MonthYearPicker` terbuka (`setSheetOpen(true)`); pilih → `setPickedMonth({ year, month })` + modal tutup; grafik/tabel update otomatis
- **`useScrollLock`:** Dihapus dari `AnalyticsPage` — sudah dihandle di dalam `MonthYearPicker`
- **`locale` variable:** `i18n.language === 'en' ? 'en-US' : 'id-ID'` — diteruskan ke MonthYearPicker untuk format nama bulan

---

### 4.8 Laporan PDF & Excel

**Lokasi kode:** `src/reports.jsx` (1192 baris)

**Cara kerja:**
- **PDF:** Dirender via `html2canvas` (screenshot DOM) → dikompilasi dengan `jsPDF`. Mendukung multi-halaman, header tabel berulang di tiap halaman, dan page-break optimization (tidak memotong elemen di tengah).
- **Excel:** Dibangun via `ExcelJS` — sheet terpisah untuk detail transaksi per baris.

**Export di Android:**
- File disimpan ke filesystem Android via `@capacitor/filesystem`
- Dialog share native Android via `@capacitor/share`

**Fitur laporan:**
- Filter per dompet (all vs spesifik)
- Laporan Bulanan vs Tahunan
- Resolusi label kategori kustom (nama + warna dari `custom_categories`)
- Pie chart + bar chart terintegrasi dalam PDF

**Basic vs Pro:** Export laporan adalah fitur **Pro only** (`reportsExportEnabled`).

---

### 4.9 Notifikasi

**Lokasi kode:** `src/hooks/useNotifications.js`

**Penyimpanan:** `localStorage` — BUKAN push notification OS. Notifikasi hanya tampil saat app terbuka.

**Tipe notifikasi dan trigger:**

| Tipe | Trigger | Preferensi |
|---|---|---|
| **Budget** | Pengeluaran mencapai 80% atau 100%+ limit budget | `notif.budget` |
| **Income** | Setiap transaksi pemasukan dicatat | `notif.income` |
| **Weekly** | Setiap hari Senin — ringkasan minggu lalu | `notif.weekly` |
| **Bills** | Bulan lalu ada transaksi "tagihan" tapi bulan ini belum | `notif.bills` |

**Retensi:**
- Maksimal 50 notifikasi tersimpan
- Notifikasi sudah-dibaca yang usianya > 5 hari di-purge otomatis
- Notifikasi belum-dibaca TIDAK pernah dipurge otomatis

**Audio:** Suara notifikasi diputar pada volume 0.5 (hanya saat dokumen visible)

---

### 4.10 Money IQ (InsightsCard)

**Lokasi kode:** `src/widgets.jsx` (fungsi `buildInsights`)

**Jenis insight (rule-based, bukan LLM/AI):**
Insight dibuat dari pola data transaksi — bukan machine learning. Contoh rule yang diketahui dari nama fungsi:
- Perbandingan pengeluaran kategori tertentu dibanding bulan lalu
- Deteksi kategori pengeluaran terbesar
- Saran berhemat berdasarkan tren

**Di halaman Analitik:** Insight dihitung dari `txInScope` (transaksi yang sudah difilter dompet + tanggal). Threshold 5 transaksi berlaku.

**Pro only:** `aiInsightsEnabled` harus `true`. Basic user melihat placeholder terkunci dengan tombol upgrade.

---

### 4.11 Dark/Light Mode & Tema Font

**Tema gelap/terang:**
- Toggle di `TopBar` dan `SettingsPage`
- Diterapkan via CSS class `dark` pada `document.documentElement`
- Semua warna menggunakan CSS variables (`--ink`, `--cream`, `--paper`, dll)
- Disimpan di `localStorage` key `finance_tweaks`

**Palette warna latar (light mode only):**
| Nama | CSS `--cream` |
|---|---|
| Cream (default) | `#EAE5D5` |
| Sand | `#E6DECB` |
| Mist | `#E4E7E0` |
| Bone | `#EFEBDF` |

**Tema font (5 pilihan):**
| ID | Nama | Font Utama | Tier |
|---|---|---|---|
| `modern-tech` | Modern Tech | Geist | Basic + Pro |
| `soft-friendly` | Soft & Friendly | DM Sans | Basic + Pro |
| `pro-finance` | Professional Finance | Plus Jakarta Sans | Pro only |
| `elegant` | Elegant Classic | Raleway | Pro only |
| `luxury` | Luxury Fintech | Manrope | Pro only |

**Auto-reset saat downgrade:** Jika user Pro yang memakai tema Pro lalu downgrade ke Basic, tema font otomatis direset ke `modern-tech`.

---

### 4.12 PIN & Biometrik

**Lokasi kode:** `src/lib/pin.js` + `src/components/PinLock.jsx` + `src/components/BiometricLock.jsx`

**PIN:**
- Hash: SHA-256 dengan random salt (bukan btoa — ada migrasi otomatis dari format lama btoa ke SHA-256)
- Disimpan: `appPIN` (hash), `appPIN_salt` (base64 salt), `pinAktif` (boolean) — semua di localStorage
- PIN dan biometrik **saling eksklusif** — mengaktifkan satu menonaktifkan yang lain

**Biometrik:**
- Plugin: `@aparajita/capacitor-biometric-auth` v10.0.0
- Flag: `biometrikAktif` di localStorage
- **Hanya tersedia di Android native** — di web, fallback ke PIN atau tanpa keamanan
- Saat gagal total / tidak tersedia: `handleBiometricEscape()` → reset keamanan → paksa login ulang

**Auto-lock:**
- Dikelola oleh `useAutoLock` hook
- Saat app masuk background terlalu lama → saat kembali ke foreground, tampilkan gerbang keamanan kembali
- Durasi timeout: **TIDAK JELAS dari kode yang dibaca** — perlu konfirmasi manual di `useAutoLock.js`

---

### 4.13 Transaksi Berulang

**Lokasi kode:** `src/lib/recurringHelper.js` + `src/components/RecurringTransactionForm.jsx` + `src/pages/RecurringTransactionPage.jsx`

**Penyimpanan:** localStorage key `recurringTransactions` (array JSON) — **BUKAN Supabase**

**Frekuensi yang didukung:**
- `mingguan` — hari tertentu dalam seminggu (Sen/Sel/Rab/Kam/Jum/Sab)
- `bulanan` — tanggal tertentu (1-28; diklem 28 untuk hindari masalah akhir bulan)
- `tahunan` — bulan + tanggal tertentu

**Cara kerja auto-eksekusi:**
1. Saat app dibuka, `checkRecurringTransactions(createTransaction)` dipanggil sekali per sesi
2. Fungsi mengecek semua schedule yang jatuh tempo sejak terakhir dieksekusi
3. Transaksi dibuat otomatis dengan prefix catatan `[Otomatis] `
4. Maksimal 60 eksekusi per schedule (catch-up protection)
5. Berhenti jika `createTransaction` gagal (offline) atau `limitReached` (kuota bulanan Basic penuh)

**Pro only:** `recurringTransactionsEnabled` harus `true`.

---

### 4.14 Widget Android Home Screen

**Lokasi kode:** `src/lib/widgetSync.js`

**Data yang disinkronkan ke widget:**
- Total pemasukan & pengeluaran bulan ini (short format)
- Saldo bersih
- Persentase penggunaan anggaran
- 3 transaksi terakhir
- Karakter animasi berdasarkan kondisi keuangan:
  - `char_celebrate` — ada pemasukan hari ini
  - `char_panic` — pengeluaran > 90% dari total budget
  - `char_worried` — pengeluaran > 70% dari total budget
  - `char_happy` — kondisi normal

**Implementasi:** Via Capacitor plugin custom `WidgetBridge` (native Android). No-op di web.

**Launch dari widget:** Tap tombol "Catat Transaksi" di widget → `consumeWidgetLaunchAction()` mendeteksi action `add_tx` → modal tambah transaksi otomatis terbuka.

---

## 5. Sistem Tier (Basic vs Pro)

### Sumber Kebenaran
File `src/lib/planLimits.js` adalah satu-satunya sumber kebenaran untuk semua limit. Tidak ada pengecekan tier yang di-hardcode di komponen UI.

### Perbandingan Lengkap

| Fitur | Basic | Pro |
|---|---|---|
| **Transaksi per bulan** | 75 | Tidak terbatas |
| **Dompet** | 1 | Tidak terbatas |
| **Goals tabungan** | 2 | Tidak terbatas |
| **Budget** | 7 | Tidak terbatas |
| **Kategori kustom** | 3 | Tidak terbatas |
| **Export laporan** (PDF/Excel) | ❌ | ✅ |
| **Scan struk** (OCR) | ❌ | ✅ |
| **Money IQ** (insights) | ❌ | ✅ |
| **Transaksi berulang** | ❌ | ✅ |
| **Tema font** | 2 dari 5 | Semua 5 |
| **Cooldown edit kategori kustom** | 30 hari | Tidak ada |

### Mekanisme Gating
Setiap fitur berbayar dijaga di minimal dua tempat:
1. **Hook** — fungsi CRUD mengembalikan `{ limitReached: true }` jika melebihi limit
2. **UI** — tombol pemicu menampilkan `LockBadge` (gembok kecil) atau memicu `PaywallModal`

### Saat Downgrade Pro → Basic
Fungsi `lockExcessOnDowngrade()` (`src/lib/planReconciliation.js`) dipanggil:
- Dompet, goals, dan kategori kustom yang melebihi limit Basic diset `is_locked = true`
- Urutan dikunci: yang paling baru dibuat (by `created_at` DESC) dikunci lebih dulu; yang paling lama tetap aktif
- Data **tidak dihapus** — hanya dikunci. Saat upgrade kembali ke Pro, semua otomatis di-unlock

### Filter Dompet di Analitik
Filter dompet di halaman Analitik **tidak memerlukan pengecekan tier terpisah** — karena memiliki >1 dompet sudah memerlukan Pro. Logic gating: dropdown hanya muncul jika `accounts.length > 1`.

---

## 6. Keputusan Arsitektur Penting

### 6.1 Tanggal Selalu Lokal, Tidak Pernah UTC
**Keputusan:** Kolom `date` di tabel `transactions` menyimpan tanggal lokal (WIB) dalam format `YYYY-MM-DD`, bukan UTC timestamp.

**Alasan (dari komentar kode):** Menggunakan `toISOString()` atau UTC menyebabkan transaksi jam 01:00 WIB (= 18:00 UTC hari sebelumnya) tercatat di hari yang salah (off-by-one timezone WIB).

**Implementasi:**
```javascript
// BENAR (lokal):
const dateToISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// SALAH (tidak dipakai):
new Date().toISOString().slice(0, 10)  // bisa off-by-one di WIB
```

### 6.2 Budget Spent Selalu Dihitung, Tidak Disimpan
**Keputusan:** Kolom `spent` di tabel `budgets` tidak dipakai. Progress budget dihitung ulang dari array transaksi setiap render.

**Alasan:** Menghindari sinkronisasi dua sumber data yang bisa tidak konsisten. Dengan menghitung dari transaksi aktual, angka selalu akurat.

### 6.3 Soft Delete untuk Kategori Kustom
**Keputusan:** Kategori kustom tidak pernah di-hard delete dari database.

**Alasan:** Transaksi lama yang menggunakan UUID kategori tersebut masih perlu bisa ditampilkan nama dan warnanya. Hard delete akan membuat transaksi lama tidak bisa diresolvesi.

### 6.4 Fail-Closed untuk Loading Plan
**Keputusan:** Selama data subscription belum di-load, aplikasi menerapkan limit `basic`.

**Alasan:** Lebih aman menampilkan "fitur terkunci sementara" daripada memberikan akses Pro secara tidak sengaja kepada Basic user saat data belum tersedia.

### 6.5 Saldo Dompet di Sisi Client (Bukan Trigger DB)
**Keputusan:** Saldo dompet diupdate dari sisi client React, bukan via trigger database.

**Alasan (dari komentar kode):** "Atomic-safe balance adjustment: baca saldo saat ini dari state (sudah di-sync via realtime), hitung nilai baru di client, lalu tulis sekaligus. Aman untuk single-user."

**Keterbatasan:** Jika user membuka app di dua device secara bersamaan dan melakukan transaksi bersamaan, bisa terjadi race condition (salah satu update saldo tertimpa). Untuk single-user normal, ini aman.

### 6.6 localStorage untuk Notifikasi dan Recurring
**Keputusan:** Notifikasi dan jadwal transaksi berulang disimpan di `localStorage`, bukan Supabase.

**Akibat:** Data ini **tidak sinkron antar device**. Notifikasi yang dibaca di HP tidak otomatis "dibaca" di tablet. Jadwal recurring yang ada di satu device tidak otomatis ada di device lain.

### 6.8 Keamanan Tabel `user_subscriptions` via RPC SECURITY DEFINER
**Keputusan:** Setelah ditemukan celah bahwa user bisa upgrade diri sendiri ke Pro via browser console (`supabase.from('user_subscriptions').update({ plan: 'pro' })...`), policy `UPDATE` generik dihapus sepenuhnya.

**Pengganti:** Semua operasi yang butuh menulis ke `user_subscriptions` dari client kini menggunakan RPC function dengan `SECURITY DEFINER` yang memvalidasi `auth.uid()` sebelum eksekusi:

| RPC Function | Tujuan | Dipanggil dari |
|---|---|---|
| `update_category_edit_cooldown(p_user_id)` | Update `last_custom_category_edit_at` | `EditCategoryModal.jsx` |
| `set_plan_for_testing(p_user_id, p_plan, ...)` | Ubah plan untuk testing (DEV only) | `useSubscription.js → setPlanForTesting` |

Kolom sensitif seperti `plan`, `expires_at`, `revenuecat_app_user_id` **hanya bisa diupdate** oleh Edge Function `revenuecat-webhook` yang menggunakan `service_role` (bypass RLS sepenuhnya dari sisi server).

**Lapisan keamanan ganda untuk `setPlanForTesting`:**
1. Guard `import.meta.env.DEV` di level fungsi JS — fungsi ini tidak jalan di production build
2. Cek `auth.uid() === p_user_id` di level RPC function — tidak bisa dipalsukan dari client

### 6.9 Key prop untuk WeeklySummaryCard di Analitik
**Keputusan (6.9):** `<WeeklySummaryCard key={selectedWalletId} />` — key berubah setiap kali filter dompet berubah.

**Alasan:** Dismiss state (`dismissed`) diinisialisasi dari localStorage di `useState` initializer yang hanya berjalan saat mount. Dengan key yang berubah, komponen di-remount → `useState` initializer membaca localStorage dengan key yang benar untuk dompet yang baru dipilih.

---

## 7. Hal yang Diketahui Belum Sempurna / TODO

### 7.2 Kolom `spent` dan `enabled` di Tabel `budgets` Tidak Dipakai
Kolom ini ada di database tapi tidak digunakan oleh kode aplikasi. Potensi kebingungan bagi developer baru.

### 7.3 Saldo Dompet Bisa Tidak Konsisten (Multi-Device Race Condition)
Lihat 6.5 di atas. Bukan bug kritis untuk single-device, tapi potensi issue untuk pengguna dengan beberapa device.

### 7.4 Recurring Transactions Tersimpan di localStorage (Tidak Sinkron Antar Device)
Jika user mengatur transaksi berulang di HP, data tersebut tidak tersedia di device lain. Tidak ada migrasi ke Supabase yang terlihat dari kode.

### 7.5 Auto-lock Timeout Tidak Terbaca Nilainya
Durasi timeout auto-lock di `useAutoLock.js` tidak terbaca saat audit — perlu verifikasi manual berapa menit timeout default-nya.

### 7.6 ~~Fungsi `txForAccount` di `wallets.jsx` Belum Di-commit~~
✅ Sudah di-commit pada 1 Juli 2026 (commit `daf4baf`).

### 7.10 Perubahan Sesi 2 (1 Juli 2026) Belum Di-commit
File yang diubah tapi belum di-commit ke git: `src/wallets.jsx`, `src/analytics.jsx`, `src/transactions-page.jsx`, `src/widgets.jsx`, `src/components/MonthYearPicker.jsx`, `src/app.jsx`. Perlu satu commit bersama sebelum build berikutnya.

### 7.11 ~~Perubahan Sesi 3 (1 Juli 2026) Belum Di-commit~~
✅ Migration `20260701000000_add_deadline_date_to_savings.sql` sudah di-commit, di-push (commit `c43c177`), dan dikonfirmasi sudah dieksekusi di Supabase SQL Editor. `src/savings-page.jsx` dan `src/hooks/useSavings.js` di-commit & di-push menyusul setelah pembaruan dokumentasi ini.

### 7.7 Playwright Ada tapi Tidak Jelas Dipakai
`playwright` ada di `devDependencies` tapi tidak ada konfigurasi test atau file test yang ditemukan. Kemungkinan dipakai untuk testing manual atau belum diimplementasikan sepenuhnya.

### 7.8 Label "Dompet" di Filter Analitik Memakai i18n tapi Key Baru
Key `analitik.semuaDompet`, `analitik.belumAdaTransaksiDompet`, dan `analitik.dataTerlaluSedikit` baru ditambahkan. Perlu dipastikan tidak ada halaman lain yang butuh key serupa.

### 7.9 ~~Deadline Goal Tersimpan Sebagai Teks Bebas~~
✅ **SELESAI SEBAGIAN (1 Juli 2026)** — Kolom `deadline_date` (DATE, nullable) ditambah via migration `20260701000000_add_deadline_date_to_savings.sql`, sudah dieksekusi di Supabase (dikonfirmasi developer). Form Add Goal sekarang pakai date picker (bukan teks bebas), dan `SavingsPage` sort otomatis berdasarkan `deadlineDate` terdekat. **Sisa pekerjaan:** goal yang dibuat sebelum migration ini tetap `deadline_date = NULL` (turun ke bawah list) sampai ada fitur Edit Goal untuk mengisi ulang — fitur edit belum ada di codebase.

---

## 8. Konfidensialitas Informasi

### Bagian yang Akurat Langsung dari Kode
- ✅ Semua versi dependency (dari `package.json`)
- ✅ Semua limit Basic vs Pro (dari `src/lib/planLimits.js`)
- ✅ Struktur database (dari kode hook + file SQL)
- ✅ Cara kerja budget (spent dihitung, bukan disimpan)
- ✅ Cara kerja goals (manual deposit, tidak otomatis dari transaksi)
- ✅ Format localStorage key WeeklySummaryCard
- ✅ Logika auto-lock gerbang keamanan (urutan PIN → Biometrik → Splash)
- ✅ Cara kerja recurring transactions (localStorage, bukan Supabase)
- ✅ Kapan filter dompet di Analitik muncul (`accounts.length > 1`)
- ✅ URL Supabase dan App ID Capacitor
- ✅ Soft delete kategori kustom dan alasannya

### Bagian yang Perlu Konfirmasi Manual
- ⚠️ **Durasi auto-lock timeout** — nilai spesifik menit/detik di `useAutoLock.js` tidak terbaca
- ⚠️ **Plugin `MlkitOcr`** — plugin native custom untuk OCR, implementasi Android-nya tidak ada di repository ini (harus ada di folder `android/`)
- ⚠️ **Plugin `WidgetBridge`** — custom plugin native untuk widget Android, sama seperti MlkitOcr
- ⚠️ **Kapan `OnboardingScreen` ditampilkan ulang** — terlihat ditampilkan saat login/register, tapi apakah ada kondisi lain?
- ⚠️ **Rules spesifik `buildInsights`** — fungsi ada di `widgets.jsx` tapi isi rule-rule spesifik Money IQ tidak diaudit secara mendetail
- ⚠️ **RC_PACKAGE_MAP di `settings-page.jsx`** — mapping dari UI plan ID ke RC package identifier: `monthly → $rc_weekly`, `6months → $rc_monthly`, `annual → $rc_annual`. Nama sengaja tidak mencerminkan periode (konfirmasi langsung dengan developer).
- ⚠️ **Products di Play Console** — produk `pro_subscription` belum dibuat per 1 Juli 2026; perlu dibuat setelah Production Access terbuka sebelum RevenueCat `getOfferings` bisa return data nyata

---

*Dokumen ini dibuat 2026-06-28 dan terakhir diperbarui 2026-07-01 untuk FinanceApp v2.5.6.*  
*Perbarui dokumen ini setiap ada perubahan arsitektur signifikan.*

---

## 9. Infrastruktur & Layanan Eksternal

> Bagian ini berisi fakta dari developer langsung — bukan dari audit kode.

### Email Infrastructure
- **Provider:** Resend (region Tokyo)
- **Domain:** `finance-app.pro` (terdaftar via Hostinger)
- **Status:** ✅ SELESAI dan terverifikasi berfungsi (sejak 25 Juni 2026)
- Email konfirmasi registrasi terkirim dari `team@finance-app.pro` dengan branding yang benar (logo terbaru)
- Redirect setelah verifikasi mengarah ke `newbeboys.github.io` (GitHub Pages, halaman `email-confirmed.html`)
- Email reset password menggunakan kode OTP 6 digit (bukan magic link), dikirim via template Supabase yang sudah dikustomisasi dengan branding
- **Sebelumnya** memakai email default Supabase (`noreply@mail.app.supabase.io`) yang sejak Sept 2024 dibatasi Supabase hanya bisa kirim ke alamat anggota organisasi sendiri — ini SEMPAT jadi launch blocker kritis sebelum Custom SMTP diimplementasikan

### Domain & DNS
- **Domain utama:** `finance-app.pro` — dikelola via Hostinger
- **Digunakan untuk:** Email infrastruktur (Resend), rencana masa depan untuk custom URL scheme/App Links

### Hosting Halaman Statis
- **GitHub Pages:** `newbeboys.github.io` — hosting untuk halaman pendukung:
  - Halaman konfirmasi email (`email-confirmed.html`)
  - Legal documents: Privacy Policy & Terms of Service di `newbeboys.github.io/financeapp-legal`

### Akun-Akun Penting (referensi identitas, bukan kredensial)
| Akun Email | Fungsi |
|---|---|
| `jangkahadevv@gmail.com` | Akun developer Play Console (publik) |
| `reviewfinance32@gmail.com` | Demo account untuk tim review Google — di-set permanen ke Pro via SQL langsung (`expires_at` +10 tahun, bukan NULL, untuk hindari ambiguitas logic) |
| `demofimance@gmail.com` | Akun testing pribadi milik developer (penulisan "fimance" sengaja, bukan typo) |
| `support@finance-app.pro` | Email support user-facing (sebelumnya `financeappsupport@gmail.com`, sudah dimigrasikan penuh ke semua touchpoint: Privacy Policy, ToS, email template, Play Console listing) |

### CI/CD & Build
- **Platform:** GitHub Actions, workflow file `.github/workflows/build-apk.yml`
- **Build command:** `bundleRelease` (menghasilkan AAB untuk Play Store, bukan APK biasa)
- **Keystore signing:**
  - File: `financeapp-release.keystore`, alias `financeapp-key`
  - Disimpan sebagai 4 GitHub Repository Secrets: `KEYALIAS`, `KEYPASSWORD`, `KEYSTOREBASE64`, `KEYSTOREPASSWORD`
  - Di-generate via `keytool` dari Android Studio JBR (path lengkap: `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe` — keytool tidak ada di Windows PATH secara default)
  - Workflow men-decode base64 keystore, lalu menjalankan `bundleRelease`, lalu cleanup file keystore yang sudah di-decode
- **SHA-256 certificate fingerprint:** sudah diekstrak dan disubmit ke Play Console untuk keperluan verifikasi nama paket developer

### Supabase Project
- **Project URL:** `https://ykyzgaztfbvwsjdcdpwk.supabase.co`
- **Region:** `ap-south-1` — South Asia (Mumbai, India)
  *(dikonfirmasi dari Project Settings → General di Supabase Dashboard pada 30 Juni 2026 — bukan Indonesia region seperti yang sempat tercantum di Privacy Policy versi lama)*

### Akun Google Play Console
- **Package name:** `com.Financeapp.app`
- **Catatan penting:** Akun developer ini dibuat SETELAH November 2023, sehingga terkena kebijakan baru Google: WAJIB Closed Testing minimal 12 tester aktif selama 14 hari berturut-turut sebelum bisa mengajukan akses Production
- **Verifikasi developer Android:** Sudah diselesaikan — nama paket terdaftar dan terverifikasi dengan SHA-256 certificate fingerprint

---

## 10. Status & Posisi Project Saat Ini (per 1 Juli 2026)

> Bagian ini berisi fakta status dari developer langsung + audit kode terbaru.

### Yang SUDAH Selesai ✅

**Infrastruktur & Build:**
- Keystore signing release sudah dibuat dan tersimpan aman (GitHub Secrets)
- Workflow GitHub Actions untuk build AAB (`bundleRelease`) sudah berfungsi
- AAB pertama sudah berhasil di-build dan diupload ke Internal Testing track
- Tester list "intern testing" sudah dibuat di Play Console
- Custom SMTP (Resend + domain finance-app.pro) — selesai dan terverifikasi
- Verifikasi developer Android (nama paket + SHA-256) — selesai

**Fitur Aplikasi:**
- Seluruh fitur inti (lihat Bagian 4) — authentication, catat transaksi dengan field dompet & metode, dompet, kategori kustom, budget, goals tabungan, analitik dengan filter dompet, laporan PDF/Excel dengan filter dompet, notifikasi, Money IQ, dark/light mode, tema font, PIN/biometrik, transaksi berulang, widget Android, scan struk OCR
- Filter dompet di halaman Analitik DAN di preview/download laporan PDF/Excel — sudah diimplementasikan dan ditest berhasil
- Logo aplikasi baru (geometric "FA") sudah diterapkan ke seluruh aset (icon Android semua ukuran, splash screen, laporan PDF/Excel, email template)
- Penggantian label UI "Akun" → "Dompet" di seluruh aplikasi (hanya teks UI, identifier kode tidak diubah) — selesai
- Fitur lupa password dengan OTP 6 digit — selesai dan ditest
- Migrasi support email ke `support@finance-app.pro` di semua touchpoint — selesai
- Data Safety form di Play Console — sudah diisi (mendeklarasikan Supabase sebagai third-party data recipient untuk data nama, email, info keuangan)
- Store Listing Play Console — sudah diisi (deskripsi, screenshot, icon)
- Dua akun demo (`reviewfinance32@gmail.com`, `demofimance@gmail.com`) — sudah di-set permanen Pro tier via SQL langsung di Supabase

**Pembaruan terbaru (29–30 Juni 2026 → v2.5.6):**
- ✅ **Google Play Billing + RevenueCat — implementasi kode SELESAI** — Hook `useRevenueCat.js` dibuat, `handleSelectPlan` di `settings-page.jsx` kini memanggil API RevenueCat nyata (`getOfferings` → `purchasePackage`), `RestorePurchaseButton` kini memanggil `rc.restorePurchases()` nyata (bukan simulasi delay)
- ✅ **Supabase Edge Function `revenuecat-webhook`** — menerima dan memproses event RC (`INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION` → plan=pro; `EXPIRATION` → plan=basic), update tabel `user_subscriptions` via service_role
- ✅ **Kolom RevenueCat di `user_subscriptions`** — migration `20260629000000` menambah 6 kolom baru (revenuecat_app_user_id, product_id, dll.) + trigger auto-updated_at
- ✅ **Celah keamanan RLS ditutup** — policy UPDATE generik dihapus (migration `20260630000001`); kolom sensitif tidak bisa diupdate dari browser console lagi
- ✅ **`EditCategoryModal.jsx` dimigrasi ke RPC** — kini menggunakan `supabase.rpc('update_category_edit_cooldown', ...)` bukan direct UPDATE
- ✅ **`setPlanForTesting` dimigrasi ke RPC** — kini menggunakan `supabase.rpc('set_plan_for_testing', ...)` via migration `20260630000002`; guard DEV tetap dipertahankan sebagai lapis pertama

**Pembaruan 1 Juli 2026 (sesi 1 — commit `daf4baf`):**
- ✅ **Bug `txForAccount` di `wallets.jsx` diperbaiki** — fungsi ini sebelumnya menggunakan pencocokan teks heuristik (membandingkan `t.method`, `t.merchant`, `t.last4` dengan `account.name`/`account.institution`) untuk memfilter transaksi per-wallet. Logic ini adalah warisan dari sebelum kolom `wallet_id` ditambahkan. Akibatnya: saldo wallet terhitung benar (karena menggunakan `wallet_id`), tapi daftar transaksi di halaman detail Dompet selalu kosong. Diperbaiki: filter sekarang pakai `t.wallet_id === account.id` langsung — konsisten dengan cara saldo dihitung.
- ✅ **`setPlanForTesting` kembali berfungsi di mode developer** — setelah policy UPDATE generik dihapus (migration `20260630000001`), toggle Basic/Pro di Settings tidak bisa berfungsi lagi karena masih pakai `.update()` langsung. Diperbaiki via RPC `set_plan_for_testing` (migration `20260630000002`) — double-guard tetap aktif: `import.meta.env.DEV` di level kode + `auth.uid()` check di level RPC.
- ✅ **Privacy Policy direvisi** — tiga perubahan: (1) tambah RevenueCat sebagai third-party service yang memproses data subscription, (2) koreksi klaim lokasi server dari 'Indonesia region' menjadi 'South Asia (Mumbai, India)' sesuai Supabase project region `ap-south-1` yang terverifikasi, (3) update tanggal ke 30 Juni 2026.
- ✅ **Terms of Service direvisi** — empat perubahan: (1) tambah RevenueCat di bagian data collection & sharing, (2) perbaiki klaim billing cycle dari 'billed monthly' menjadi sesuai periode yang dipilih user (monthly/6-month/annual), (3) perbaiki klaim hapus akun dari 'through App settings' (fitur belum ada) menjadi 'via email request ke support@finance-app.pro', (4) update tanggal ke 30 Juni 2026.
- ✅ **Developer-mode toggle terkonfirmasi sudah dilindungi DEV guard** — audit kode `settings-page.jsx` membuktikan blok JSX "Mode developer" sudah dibungkus `{import.meta.env.DEV && (...)}` sejak sebelumnya; tidak ada perubahan diperlukan.
- ✅ **Semua perubahan di-commit dan di-push ke GitHub** — commit `daf4baf` mencakup: `src/wallets.jsx`, `src/hooks/useSubscription.js`, `supabase/migrations/20260630000002_add_set_plan_testing_rpc.sql`, `FINANCEAPP_DOKUMENTASI_TEKNIS.md`. Branch `main` sudah sinkron dengan `origin/main`.

**Pembaruan 1 Juli 2026 (sesi 2 — uncommitted):**
- ✅ **`MonthYearPicker` — reusable component baru** — modal centered dengan grid 3×4 bulan, year navigation (‹/›), tombol confirm. Props: `isOpen`, `onClose`, `onConfirm(month, year)`, `locale`, `initialMonth/Year`, `availableMonthsByYear`. Internal `useScrollLock` — pemanggil tidak perlu tambah sendiri. Digunakan di 4 tempat: CashflowCard, SpendingCard, TransactionsPage, AnalyticsPage.
- ✅ **CashflowCard & SpendingCard (beranda) — upgrade filter bulan** — bottom sheet custom lama diganti `MonthYearPicker`. Design & UX sekarang konsisten di semua halaman.
- ✅ **TransactionsPage — filter bulan + KPI dinamis** — halaman Transaksi sekarang punya filter bulan via `MonthYearPicker`, 3 kartu KPI (Pemasukan/Pengeluaran/Selisih) yang update otomatis saat bulan berubah, dan list yang hanya menampilkan transaksi bulan terpilih (default: bulan sekarang). Performa lebih baik — tidak render seluruh histori.
- ✅ **Fix kategori custom di `AccountTxSheet` (`wallets.jsx`)** — kategori di detail dompet sekarang di-resolve via `resolveCategory()` + `categoryLabel()` dari `category-field.jsx`. Prop `customCategories` diteruskan dari `app.jsx` → `WalletsPage` → `AccountTxSheet`. Fix juga variable shadowing: `const { t: tr } = useTranslation()` agar tidak di-shadow oleh `t` (transaction object) di dalam `transactions.map()`.
- ✅ **Modal konfirmasi hapus dompet (`WalletDeleteConfirmation`)** — component baru (bottom sheet) dengan peringatan cascade delete; menampilkan nama dompet + jumlah transaksi yang akan hilang. Dipicu dari state `deletingWallet` di `WalletsPage`.
- ✅ **UX hapus dompet diubah ke tombol + dropdown di heading** — tombol "🗑️ Hapus Dompet" (terra/merah) di heading halaman; klik → dropdown list semua dompet; pilih → `WalletDeleteConfirmation` terbuka. Button X per-card dihapus. Guard: `accounts.length > 1` (semua dompet bisa dihapus, termasuk primary).
- ✅ **Filter bulan Analitik diganti `MonthYearPicker`** — bottom sheet custom dihapus dari `analytics.jsx`, diganti `MonthYearPicker`. `useScrollLock(sheetOpen)` dihapus dari `AnalyticsPage`. `locale` variable ditambah.

**Pembaruan 1 Juli 2026 (sesi 3 — deadline date picker & sorting goal):**
- ✅ **Migration `deadline_date` di tabel `savings`** — `supabase/migrations/20260701000000_add_deadline_date_to_savings.sql` menambah kolom `deadline_date DATE NULL`. Di-commit & di-push (commit `c43c177`), dan **sudah dieksekusi di Supabase SQL Editor** (dikonfirmasi oleh developer) — kolom live di database.
- ✅ **`AddGoalModal` — deadline diganti date picker** — input teks bebas untuk deadline diganti `DatePickerPopup` (reuse dari `transactions.jsx`) + tombol "Bersihkan". Pilihan tanggal dikonversi ke label ringkas ("Jan 2026") via helper `isoToDeadlineLabel` (parsing tanggal lokal, bukan `toISOString`, supaya tidak ada pergeseran WIB).
- ✅ **`useSavings.js` — `createGoal` & `toAppGoal` bawa `deadline_date`** — `createGoal` sekarang menulis kolom `deadline_date` (selain `deadline_label` yang sudah ada); `toAppGoal` mengekspos `deadlineDate` dari row Supabase.
- ✅ **`SavingsPage` — sorting goal berdasarkan deadline terdekat** — helper `sortGoalsByDeadline` di `savings-page.jsx`: goal dengan `deadlineDate` terdekat di atas, goal tanpa deadline (NULL) di bawah, dibandingkan sebagai string ISO (bukan `Date` subtraction) untuk hindari isu timezone.
- ✅ **Verifikasi:** `vite build` lulus tanpa error. Pengujian interaktif manual di browser (klik date picker, konfirmasi sorting real-time) belum eksplisit dikonfirmasi dalam sesi ini — disarankan smoke test cepat sebelum dianggap production-ready.
- ⏳ **Belum ada form Edit Goal** — jadi goal yang sudah ada sebelum migration ini tetap `deadline_date = NULL` sampai fitur edit goal dibuat; scope sesi ini hanya Add Goal.
- ✅ **Commit & push:** `src/savings-page.jsx` dan `src/hooks/useSavings.js` di-commit & di-push menyusul setelah pembaruan dokumentasi ini.

### Yang SEDANG/BELUM Selesai ⏳

**Launch Blocker — WAJIB selesai sebelum Production:**

1. **In-app account deletion belum ada client-side trigger** — Data Safety form sudah mendeklarasikan "in-app delete" tapi belum ada Supabase Edge Function untuk eksekusinya (regular user tidak bisa hapus langsung dari `auth.users`). Cascade delete sudah benar di level database. Ini WAJIB ada sejak Google mewajibkan in-app account deletion Des 2023.

2. ~~**Perubahan `wallets.jsx` (`txForAccount`) belum di-commit**~~ — ✅ **SELESAI (1 Juli 2026)** — Di-commit bersama `useSubscription.js`, migration `20260630000002`, dan `FINANCEAPP_DOKUMENTASI_TEKNIS.md` dalam commit `daf4baf`, sudah di-push ke `origin/main`.

3. ~~**Migration SQL `20260630000002` belum dijalankan di Supabase**~~ — ✅ **SELESAI (1 Juli 2026)** — Migration sudah dieksekusi via Supabase SQL Editor. RPC `set_plan_for_testing` sudah aktif di database dan terbukti berfungsi: toggle Basic/Pro di mode developer bisa dipakai kembali setelah policy UPDATE generik dihapus.

**Closed Testing & Production Access:**

4. **Closed Testing 14 hari dengan minimal 12 tester aktif BELUM DIMULAI** — ini WAJIB karena akun developer dibuat setelah Nov 2023. Jam mulai countdown 14 hari baru berjalan setelah Closed Testing track aktif dengan jumlah tester terpenuhi secara berkelanjutan.

5. **Menu "Monetisasi dengan Google Play" di Play Console belum dikonfirmasi terbuka** — perlu dicek ulang apakah sudah unlock setelah ada AAB di Internal Testing.

6. **Production Access belum bisa diajukan** — bergantung pada selesainya Closed Testing 14 hari di atas.

**Pre-Production Checklist (warning, bukan error — aman untuk testing track):**

7. **`minifyEnabled` masih `false`** — sebelum production pertimbangkan diaktifkan + setup ProGuard rules dengan testing menyeluruh, lalu upload mapping/deobfuscation file ke Play Console.

8. **Native debug symbols belum diupload** — diperlukan sebelum Production track untuk debugging native crash report.

**Setup Monetisasi (bergantung pada Production Access):**

9. ~~**Subscription products belum dibuat di Play Console**~~ — ✅ **SELESAI (29–30 Juni 2026)** — Produk `pro_subscription` sudah dibuat di Play Console dengan 3 base plan aktif:
    - `monthly` — Rp 30.000/bulan (perpanjangan otomatis)
    - `semi-annual` — Rp 140.000/6 bulan (perpanjangan otomatis)
    - `annual` — Rp 270.000/tahun (perpanjangan otomatis)

    RevenueCat sudah dikonfigurasi penuh:
    - Entitlement identifier: `pro`
    - Offering identifier: `default`
    - 3 package mapping: `$rc_weekly` → `pro_subscription:monthly` | `$rc_monthly` → `pro_subscription:semi-annual` | `$rc_annual` → `pro_subscription:annual`
    - Ketiga produk sudah di-import dari Play Console ke RevenueCat; entitlement `pro` sudah terhubung ke ketiga produk Android

    *Catatan: ada base plan `semiannual` (tanpa tanda hubung) yang dibuat tidak sengaja saat setup, sudah dinonaktifkan permanen — tidak mempengaruhi fungsi billing.*

10. **Sample data untuk akun reviewer `reviewfinance32@gmail.com` belum diisi** — perlu diisi 10-15 transaksi, 4+ kategori custom, 2+ dompet, 3 savings goals, beberapa budget, 1 recurring transaction, supaya app tidak tampak kosong saat di-review tim Google.

---

## 11. Roadmap Selanjutnya

> Bagian ini berisi rencana dari developer langsung — bukan dari audit kode.

### Urutan Prioritas Immediate (sebelum bisa submit Production)

1. **Selesaikan sisa item pra-production:**
   - ✅ Install `@revenuecat/purchases-capacitor@13.2.0` + permission BILLING — SELESAI
   - ✅ Implementasi `handleSelectPlan` via RevenueCat API — SELESAI (30 Juni 2026)
   - ✅ `RestorePurchaseButton` memanggil restore API nyata — SELESAI (30 Juni 2026)
   - ✅ Celah `setPlanForTesting` ditutup via RPC SECURITY DEFINER — SELESAI (1 Juli 2026)
   - ✅ **Jalankan migration `20260630000002` di Supabase** — SELESAI (1 Juli 2026)
   - ✅ **Commit perubahan `wallets.jsx` (`txForAccount`)** — SELESAI (1 Juli 2026)
   - ⏳ Hapus developer-mode toggle "Set ke Basic/Pro (testing)" dari `settings-page.jsx`

2. **Bangun Supabase Edge Function untuk in-app account deletion** — memenuhi kewajiban Google Play sejak Des 2023, sesuai yang sudah dideklarasikan di Data Safety form

3. **Mulai Closed Testing 14 hari** — rekrut/konfirmasi minimal 12 tester aktif berkelanjutan, mulai countdown clock secepatnya karena ini blocker dengan durasi tetap (tidak bisa dipercepat)

4. **Setelah Closed Testing selesai:** Apply Production Access (estimasi review Google ~7 hari)

5. **Setelah Production Access terbuka:**
   - ✅ Setup 3 subscription products + konfigurasi RevenueCat — SELESAI (29–30 Juni 2026)
   - Isi sample data ke akun reviewer
   - Build final dengan `minifyEnabled: true` + ProGuard + native debug symbols sudah diupload
   - Submit untuk review production

### Backlog Post-Launch (dikerjakan SETELAH app live di Play Store)

**Kategori: Perbaikan & Polish**
- Rename label "Money IQ"/"AI Insight" → pertimbangkan "Wawasan Pintar" untuk hilangkan kata "AI" secara eksplisit (mitigasi risiko kebijakan Play Store soal klaim AI)
- Tambahkan tombol/link "Buka Aplikasi FinanceApp" di halaman `email-confirmed.html` (GitHub Pages) yang mengarah balik ke app via custom URL scheme (`financeapp://login`) atau Android App Links — keystore production sudah ada sehingga App Links (opsi penuh) sudah memungkinkan

**Kategori: Fitur Baru**
- **OS push notification** (Capacitor local-notifications + background scheduling) — saat ini SEMUA notifikasi (recurring transaction, pengingat tagihan, ringkasan mingguan) cuma in-app, tidak muncul saat app tertutup
- **Pengingat Tagihan yang lebih akurat** — saat ini heuristik kategori 'bills' bulan lalu vs bulan ini; backlog: derive due date dari data recurring transaction + reminder H-N hari sebelum jatuh tempo
- **Fitur Hutang/Piutang tracking** (Pro-tier) — keputusan arsitektur sudah final:
  - Terpisah dari dompet, saldo dompet tidak terpengaruh
  - Pro tier only
  - Partial payment/cicilan didukung
  - OS push notification dibangun BARENG fitur ini
  - Rencana 5 fase sudah dirancang (DB schema lengkap dengan tabel `debts` + `debt_payments` + RLS + trigger)
  - **SENGAJA DITUNDA** — tunggu 1-2 bulan data usage user real setelah launch untuk hindari membangun berdasarkan tebakan kompetitor

**Kategori: Pertimbangan Belum Final**
- Apakah Budget (yang sudah otomatis terhubung ke transaksi via kategori) perlu mendapat filter dompet juga seperti di Analitik — secara teknis lebih mudah dibanding Goals (karena sudah punya hook natural ke `wallet_id` lewat transaksi terkait), tapi use case belum jelas. **Belum diputuskan, masih dipertimbangkan.**
- Goals/Tabungan TIDAK akan di-wallet-link kecuali nanti diputuskan ubah dulu jadi otomatis terhubung ke transaksi (saat ini manual/virtual penuh)
