# FinanceApp — Dokumentasi Teknis & Konsep

> **Dibuat:** 2026-06-28 | **Versi App:** 2.5.5  
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

Pembayaran/upgrade dikelola melalui komponen `UpgradeModal` di dalam app. Tidak terlihat integrasi payment gateway langsung dari kode (Payment processing mungkin dilakukan di luar scope kode ini).

### Tech Stack Lengkap (dari `package.json` v2.5.5)

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
│   ├── wallets.jsx                ← WalletsPage + AddAccountModal
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
│   └── custom_categories.sql      ← Tabel custom_categories + RLS
│
├── capacitor.config.json          ← App ID, nama, plugin config
├── vite.config.js                 ← Konfigurasi build (minimal)
└── package.json                   ← Dependencies + scripts
```

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
deadline        date        Tanggal target (nullable)
deadline_label  text        Label tampilan "Jan 2026" atau "Tanpa tenggat"
color           text        Warna tampilan (8 pilihan preset)
icon            text        Ikon (star, emergency, travel, home, vehicle, education, gadget, gift, health, ring)
is_locked       boolean     true saat Basic user melebihi limit
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
user_id       uuid          PRIMARY KEY, FK → auth.users
plan          text          'basic' | 'pro'
billing_cycle text          'monthly' | 'yearly' | null
started_at    timestamptz
expires_at    timestamptz   null = tidak ada kadaluarsa (Pro permanen atau Basic default)
updated_at    timestamptz
```

**Trigger otomatis:** Ada trigger Supabase yang otomatis membuat row `user_subscriptions` dengan `plan='basic'` setiap kali user baru mendaftar.

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

---

### 4.3 Dompet (Wallets)

**Lokasi kode:** `src/wallets.jsx` (UI) + `src/hooks/useWallets.js` (logika)

**Tipe dompet yang tersedia:** Rekening Bank, E-Wallet, Tunai, Investasi

**Cara kerja saldo:**
- Saldo **TIDAK** dihitung dari transaksi — ini bukan rekonsiliasi otomatis
- Saldo diupdate via `adjustBalance(walletId, delta)` setiap kali transaksi dibuat/diedit/dihapus
- `adjustBalance` membaca saldo saat ini dari state React (yang sudah sinkron via realtime), menghitung `newBalance = current + delta`, lalu tulis ke Supabase
- **Kelemahan yang diketahui:** Jika transaksi lama (sebelum fitur `wallet_id` ditambah) tidak punya `wallet_id`, saldo tidak terpengaruh oleh transaksi tersebut

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
- Deadline: teks bebas ("Jan 2026" atau "Tanpa tenggat")
- Animasi perayaan (`GoalCompleteOverlay`) ketika goal mencapai 100% untuk pertama kali (hanya jika Sound/Animasi diaktifkan)

**Batas:** Basic = 2 goals, Pro = tidak terbatas

---

### 4.7 Analitik

**Lokasi kode:** `src/analytics.jsx`

**Komponen yang ada:**
1. **Filter tanggal** — toggle "1 Tahun" (12 bulan terakhir) atau "1 Bulan" (pilih bulan spesifik via bottom sheet)
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

### 6.7 Key prop untuk WeeklySummaryCard di Analitik
**Keputusan:** `<WeeklySummaryCard key={selectedWalletId} />` — key berubah setiap kali filter dompet berubah.

**Alasan:** Dismiss state (`dismissed`) diinisialisasi dari localStorage di `useState` initializer yang hanya berjalan saat mount. Dengan key yang berubah, komponen di-remount → `useState` initializer membaca localStorage dengan key yang benar untuk dompet yang baru dipilih.

---

## 7. Hal yang Diketahui Belum Sempurna / TODO

### 7.1 Kolom `wallet_id` Tidak Ada di Semua Transaksi Lama
Kolom `wallet_id` ditambahkan via `migrations.sql` setelah banyak transaksi sudah dibuat. Transaksi lama (sebelum migrasi) memiliki `wallet_id = null`. Ini berarti:
- Transaksi lama tidak akan muncul dalam filter dompet di halaman Analitik
- Saldo dompet tidak memperhitungkan transaksi lama tersebut

**Status:** Diketahui, belum ada mekanisme backfill.

### 7.2 Kolom `spent` dan `enabled` di Tabel `budgets` Tidak Dipakai
Kolom ini ada di database tapi tidak digunakan oleh kode aplikasi. Potensi kebingungan bagi developer baru.

### 7.3 Saldo Dompet Bisa Tidak Konsisten (Multi-Device Race Condition)
Lihat 6.5 di atas. Bukan bug kritis untuk single-device, tapi potensi issue untuk pengguna dengan beberapa device.

### 7.4 Recurring Transactions Tersimpan di localStorage (Tidak Sinkron Antar Device)
Jika user mengatur transaksi berulang di HP, data tersebut tidak tersedia di device lain. Tidak ada migrasi ke Supabase yang terlihat dari kode.

### 7.5 Auto-lock Timeout Tidak Terbaca Nilainya
Durasi timeout auto-lock di `useAutoLock.js` tidak terbaca saat audit — perlu verifikasi manual berapa menit timeout default-nya.

### 7.6 Playwright Ada tapi Tidak Jelas Dipakai
`playwright` ada di `devDependencies` tapi tidak ada konfigurasi test atau file test yang ditemukan. Kemungkinan dipakai untuk testing manual atau belum diimplementasikan sepenuhnya.

### 7.7 Label "Dompet" di Filter Analitik Memakai i18n tapi Key Baru
Key `analitik.semuaDompet`, `analitik.belumAdaTransaksiDompet`, dan `analitik.dataTerlaluSedikit` baru ditambahkan. Perlu dipastikan tidak ada halaman lain yang butuh key serupa.

### 7.8 Deadline Goal Tersimpan Sebagai Teks Bebas
Field `deadline_label` di tabel `savings` menyimpan teks seperti "Jan 2026" atau "Tanpa tenggat" — bukan kolom `date`. Ini mempersulit sorting dan filtering berdasarkan deadline secara otomatis.

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
- ⚠️ **Mekanisme payment/upgrade** — dipilih **RevenueCat** (`@revenuecat/purchases-capacitor@13.2.0`) sebagai SDK untuk Google Play Billing. Plugin sudah terinstall (28 Juni 2026), tapi integrasi kode di `UpgradeModal` dan `RestorePurchaseButton` belum diimplementasikan
- ⚠️ **Plugin `MlkitOcr`** — plugin native custom untuk OCR, implementasi Android-nya tidak ada di repository ini (harus ada di folder `android/`)
- ⚠️ **Plugin `WidgetBridge`** — custom plugin native untuk widget Android, sama seperti MlkitOcr
- ⚠️ **Kapan `OnboardingScreen` ditampilkan ulang** — terlihat ditampilkan saat login/register, tapi apakah ada kondisi lain?
- ⚠️ **Rules spesifik `buildInsights`** — fungsi ada di `widgets.jsx` tapi isi rule-rule spesifik Money IQ tidak diaudit secara mendetail dalam sesi ini
- ⚠️ **Konfigurasi RLS (Row Level Security)** — ada referensi di SQL files tapi detail policy-nya tidak diaudit

---

*Dokumen ini dibuat berdasarkan audit kode pada 2026-06-28 untuk FinanceApp v2.5.4.*  
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

### Akun Google Play Console
- **Package name:** `com.Financeapp.app`
- **Catatan penting:** Akun developer ini dibuat SETELAH November 2023, sehingga terkena kebijakan baru Google: WAJIB Closed Testing minimal 12 tester aktif selama 14 hari berturut-turut sebelum bisa mengajukan akses Production
- **Verifikasi developer Android:** Sudah diselesaikan — nama paket terdaftar dan terverifikasi dengan SHA-256 certificate fingerprint

---

## 10. Status & Posisi Project Saat Ini (per 28 Juni 2026)

> Bagian ini berisi fakta status dari developer langsung — bukan dari audit kode.

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

### Yang SEDANG/BELUM Selesai ⏳

**Launch Blocker — WAJIB selesai sebelum Production:**

1. **Google Play Billing API — plugin sudah terinstall, implementasi kode BELUM** — `@revenuecat/purchases-capacitor@13.2.0` sudah diinstall (28 Juni 2026), permission `com.android.vending.BILLING` sudah ditambahkan ke AndroidManifest.xml, Capacitor sync sudah berjalan. Namun kode pemanggilan API belum diimplementasikan: `handleSelectPlan` di `settings-page.jsx` masih hanya menutup modal + `console.log`. Proses upgrade ke Pro di production saat ini MASIH TIDAK BERFUNGSI sampai implementasi kode selesai.

2. **RestorePurchaseButton menampilkan UI menyesatkan** — klaim "Berhasil dipulihkan" padahal cuma simulasi delay 1,2 detik tanpa logic asli. Harus diperbaiki BERSAMAAN dengan implementasi Billing API.

3. **Celah keamanan: fungsi `setPlanForTesting` di `useSubscription.js` tidak di-guard `import.meta.env.DEV` di level fungsi itu sendiri** — secara teknis bisa dipanggil manual via browser console/DevTools di build production untuk upgrade ke Pro gratis tanpa bayar. WAJIB ditambahkan guard di level fungsi sebelum production build.

4. **Developer-mode toggle "Set ke Basic/Pro (testing)" di Settings masih ada** — harus dihapus total sebelum build production manapun.

5. **In-app account deletion belum ada client-side trigger** — Data Safety form sudah mendeklarasikan "in-app delete" tapi belum ada Supabase Edge Function untuk eksekusinya (regular user tidak bisa hapus langsung dari `auth.users`). Cascade delete sudah benar di level database. Ini WAJIB ada sejak Google mewajibkan in-app account deletion Des 2023.

**Closed Testing & Production Access:**

6. **Closed Testing 14 hari dengan minimal 12 tester aktif BELUM DIMULAI** — ini WAJIB karena akun developer dibuat setelah Nov 2023. Jam mulai countdown 14 hari baru berjalan setelah Closed Testing track aktif dengan jumlah tester terpenuhi secara berkelanjutan.

7. **Menu "Monetisasi dengan Google Play" di Play Console belum dikonfirmasi terbuka** — perlu dicek ulang apakah sudah unlock setelah ada AAB di Internal Testing (riset sebelumnya menunjukkan kemungkinan unlock cukup dengan 1 build di track manapun, tapi belum terverifikasi langsung).

8. **Production Access belum bisa diajukan** — bergantung pada selesainya Closed Testing 14 hari di atas.

**Pre-Production Checklist (warning, bukan error — aman untuk testing track):**

9. **`minifyEnabled` masih `false`** — sebelum production pertimbangkan diaktifkan + setup ProGuard rules dengan testing menyeluruh, lalu upload mapping/deobfuscation file ke Play Console.

10. **Native debug symbols belum diupload** — diperlukan sebelum Production track untuk debugging native crash report.

**Setup Monetisasi (bergantung pada Production Access):**

11. **Subscription products belum dibuat di Play Console** — produk yang sudah DIRENCANAKAN (belum dieksekusi): product ID `pro_subscription`, base plans `monthly`/`semiannual`/`annual`, pricing: Bulanan Rp 30.000 / 6-Bulan Rp 140.000 / Tahunan Rp 270.000.

12. **Sample data untuk akun reviewer `reviewfinance32@gmail.com` belum diisi** — perlu diisi 10-15 transaksi, 4+ kategori custom, 2+ dompet, 3 savings goals, beberapa budget, 1 recurring transaction, supaya app tidak tampak kosong saat di-review tim Google.

---

## 11. Roadmap Selanjutnya

> Bagian ini berisi rencana dari developer langsung — bukan dari audit kode.

### Urutan Prioritas Immediate (sebelum bisa submit Production)

1. **Implementasi Google Play Billing API secara lengkap:**
   - ✅ Install `@revenuecat/purchases-capacitor@13.2.0` — SELESAI (28 Juni 2026)
   - ✅ Tambah permission `com.android.vending.BILLING` ke AndroidManifest.xml — SELESAI (28 Juni 2026)
   - ⏳ Implementasi pemanggilan API asli di `handleSelectPlan` (`settings-page.jsx`) — BELUM
   - Perbaiki `RestorePurchaseButton.jsx` agar benar-benar memanggil restore API, bukan simulasi delay
   - Tambahkan guard `import.meta.env.DEV` di level fungsi `setPlanForTesting` (`useSubscription.js`) — bukan hanya di level UI caller
   - Hapus developer-mode toggle "Set ke Basic/Pro (testing)" dari `settings-page.jsx` sepenuhnya sebelum build production

2. **Bangun Supabase Edge Function untuk in-app account deletion** — memenuhi kewajiban Google Play sejak Des 2023, sesuai yang sudah dideklarasikan di Data Safety form

3. **Mulai Closed Testing 14 hari** — rekrut/konfirmasi minimal 12 tester aktif berkelanjutan, mulai countdown clock secepatnya karena ini blocker dengan durasi tetap (tidak bisa dipercepat)

4. **Setelah Closed Testing selesai:** Apply Production Access (estimasi review Google ~7 hari)

5. **Setelah Production Access terbuka:**
   - Setup 3 subscription products sesuai rencana pricing di atas
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
