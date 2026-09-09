# FinanceApp — Arsitektur Sistem & Database Schema

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-23 | **Versi App:** 2.6.0  
> **Tujuan:** Dokumentasi teknis struktur project, data flow, dan database schema untuk developer.

---

## 1. Arsitektur & Struktur Project

### No Router — One Big State Machine

Tidak ada client-side router. `src/app.jsx` (`App` component) owns satu large state tree dan switches views by rendering conditionally:

```
Auth session (via Supabase onAuthStateChange)
    ↓
Device security gate (PIN dan biometric lock, mutually exclusive)
    ↓
Splash screen
    ↓
Onboarding (first login/register only)
    ↓
Product tour
    ↓
Main tabbed content (tab/page switching = local state di app.jsx, bukan routes)
```

### Data Layer: One Hook Per Domain, No Global Store

**Tidak ada** Redux/Zustand/Context store. Setiap domain punya dedicated hook di `src/hooks/`:
- `useTransactions` → Supabase `transactions` table
- `useSavings` → Supabase `savings` table
- `useWallets` → Supabase `wallets` table
- `useBudgets` → Supabase `budgets` table
- `useDebts` → Supabase `debts` + `debt_payments` tables
- `useCustomCategories` → Supabase `custom_categories` table
- `useSubscription` → Supabase `user_subscriptions` table
- `useNotifications` → localStorage
- `useRevenueCat` → RevenueCat SDK
- `useAutoLock` → auto-lock timeout logic
- `useScrollLock` → scroll lock saat modal terbuka

Hook-hook ini dikomposisi di `app.jsx`. Setiap query RLS-scoped by `user_id` client-side **dan** server-side (defense in depth).

**Business logic** yang tidak terikat UI ada di `src/lib/`:
- `planLimits.js` — sumber kebenaran semua limit & feature flags
- `planReconciliation.js` — lock/unlock saat downgrade
- `recurringHelper.js` — scheduler transaksi berulang (localStorage)
- `widgetSync.js` — sinkronisasi ke widget Android
- `strukParser.js` — parser OCR struk belanja → transaksi
- `pin.js` — SHA-256 hash + verifikasi PIN
- `biometric.js` — native biometrik helper
- `sound.js` — play audio notifikasi
- `errorLogger.js` — client helper logging ke `error_logs` via RPC
- `scrollSettle.js` — scroll smoothly ke elemen + settle sebelum lanjut step (dipakai Product Tour)

### Struktur Folder

```
root/
├── src/
│   ├── app.jsx                    ← Shell utama
│   ├── main.jsx                   ← Entry point React
│   ├── supabase.js                ← Supabase client singleton
│   ├── data.jsx                   ← Konstanta kategori, format Rupiah
│   ├── i18n.js                    ← i18next config
│   ├── index.css                  ← Global CSS (tema, layout, sidebar, container queries)
│   ├── pages/
│   │   ├── Login.jsx, Register.jsx, ForgotPassword.jsx
│   │   └── RecurringTransactionPage.jsx
│   ├── hooks/
│   │   ├── useTransactions.js, useWallets.js, useBudgets.js
│   │   ├── useSavings.js, useDebts.js, useCustomCategories.js
│   │   ├── useSubscription.js, useRevenueCat.js, useNotifications.js
│   │   ├── useAutoLock.js, useScrollLock.js
│   │   ├── useContainerWidth.js   ← Hook baru (ResizeObserver for responsive layouts)
│   ├── lib/
│   │   ├── planLimits.js, planReconciliation.js, recurringHelper.js
│   │   ├── widgetSync.js, strukParser.js, pin.js, biometric.js
│   │   ├── sound.js, errorLogger.js, scrollSettle.js
│   ├── components/
│   │   ├── Sidebar.jsx             ← Komponen baru (desktop navigation ≥750px)
│   │   ├── PaywallModal.jsx, PinSetup.jsx, PinLock.jsx, BiometricLock.jsx
│   │   ├── MonthYearPicker.jsx, OnboardingScreen.jsx, ScanStruk.jsx
│   │   ├── BottomNav.jsx, ProductTour.jsx, TransaksiTour.jsx, etc (10 tour components)
│   │   ├── debts/, subscription/
│   ├── locales/
│   │   ├── id/translation.json, en/translation.json
│   ├── transactions.jsx, transactions-page.jsx, analytics.jsx, reports.jsx
│   ├── budgets-page.jsx, savings-page.jsx, settings-page.jsx, debts-page.jsx
│   ├── wallets.jsx, widgets.jsx, charts.jsx, category-field.jsx, topbar.jsx
│
├── supabase/
│   ├── schema.sql                 ← Tabel dasar
│   ├── migrations.sql             ← ALTER TABLE
│   ├── subscriptions.sql          ← user_subscriptions + trigger
│   ├── custom_categories.sql      ← custom_categories + RLS
│   ├── migrations/
│   │   ├── 20260629000000_add_revenuecat_fields.sql
│   │   ├── 20260630000001_secure_user_subscriptions_rls.sql
│   │   ├── 20260630000002_add_set_plan_testing_rpc.sql
│   │   ├── 20260701000000_add_deadline_date_to_savings.sql
│   │   ├── 20260704000000_add_debts.sql
│   │   ├── 20260705000000_add_is_locked_to_debts.sql
│   │   ├── 20260706000000_add_error_logs.sql
│   │   ├── 20260716000000_add_chat_rate_limits.sql
│   │   ├── 20260717000000_add_chat_unanswered_log.sql
│   │   ├── 20260723000000_document_user_summary_view.sql       ← belum di-push
│   │   ├── 20260723010000_harden_functions_search_path_and_grants.sql  ← belum di-push
│   │   └── 20260723020000_revoke_rls_auto_enable_execute.sql   ← belum di-push
│   └── functions/
│       ├── financial-chat/
│       │   ├── index.ts, types.ts, guardrail.ts
│       │   ├── intent-parser.ts, query-builder.ts, groq-client.ts
│       │   └── deno.json
│       └── revenuecat-webhook/index.ts
│
├── docs/, .env.example, capacitor.config.json, vite.config.js, package.json
```

### Data Flow

```
User Action
    │
    ▼
React Component (UI state)
    ├── Lokal: theme, filter, modal open/close
    │   └── useState / useReducer
    │
    └── Data permanen:
        ├── Supabase (main data)
        │   ├── useTransactions → transactions
        │   ├── useWallets → wallets
        │   ├── useBudgets → budgets
        │   ├── useSavings → savings
        │   ├── useCustomCategories → custom_categories
        │   └── useSubscription → user_subscriptions
        │
        └── localStorage (local only)
            ├── useNotifications (notif_data, notif_prefs)
            ├── recurringHelper (recurringTransactions)
            ├── UI prefs (bahasa, theme, tweaks)
            └── PIN/Biometrik (appPIN, appPIN_salt, flags)
```

**Realtime Supabase:**
- `wallets`, `savings`, `user_subscriptions`, `custom_categories` subscribe to event changes untuk multi-device sync

---

## 2. Tanggal Selalu Lokal, Tidak Pernah UTC

**CRITICAL:** Kolom `date` di tabel `transactions` menyimpan tanggal lokal (WIB) dalam format `YYYY-MM-DD`, **bukan UTC timestamp**.

Menggunakan `toISOString()` atau UTC menyebabkan transaksi jam 01:00 WIB (= 18:00 UTC hari sebelumnya) tercatat di hari yang salah (off-by-one bug).

```javascript
// ✅ BENAR (lokal):
const dateToISO = d => 
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// ❌ SALAH (tidak dipakai):
new Date().toISOString().slice(0, 10)  // bisa off-by-one di WIB
```

**Backend (Edge Functions):** Compute date range dengan offset WIB terlebih dahulu sebelum query:
```typescript
const nowW = nowWIB();  // shift UTC ke WIB
const todayStr = ymd(nowW.getUTCFullYear(), ...);  // format lokal
```

---

## 3. Struktur Database (Supabase)

> Semua tabel menggunakan Row Level Security (RLS) — user hanya bisa akses data miliknya sendiri.

### Tabel `transactions`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL, FK → auth.users (RLS)
type            text            'expense' | 'income'
amount          numeric         Positif untuk income, negatif untuk expense
category        text            ID kategori bawaan ATAU UUID kategori kustom
merchant        text            Nama toko/pembayar
note            text            Catatan bebas
date            date            Tanggal lokal (YYYY-MM-DD), BUKAN UTC
time            text            Jam transaksi (HH:MM)
method          text            'Tunai' | 'Transfer' | user-defined
wallet_id       uuid            FK → wallets.id (nullable, added via migrations)
debt_id         uuid            FK → debts.id ON DELETE CASCADE (nullable, untuk transaksi hutang/piutang)
created_at      timestamptz     Auto-set
```

**Penting:** Transaksi dengan `debt_id` terisi **dikecualikan** dari kuota 75 transaksi/bulan Basic (filter `debt_id IS NULL` di `useTransactions.js`).

### Tabel `wallets`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL, FK → auth.users
name            text            Nama dompet (tampil di UI)
bank            text            Nama bank/institusi (field klien: `institution`)
balance         numeric         Saldo — diupdate manual via adjustBalance()
type            text            'bank' | 'ewallet' | 'cash' | 'investment'
is_primary      boolean         Maksimal satu per user
color           text            Kode warna hex
last4           text            4 digit terakhir kartu (default '—')
is_locked       boolean         true saat Basic user melebihi limit
created_at      timestamptz
```

⚠️ **Kolom `bank` tidak boleh diisi teks yang ikut bahasa UI.** Saat user tidak mengisi nama bank, `wallets.jsx` memakai `typeLabel(type)` — label tipe dompet versi **Bahasa Indonesia mentah** dari `ACCOUNT_TYPES`, BUKAN `typeLabelI18n()`. Kalau ikut bahasa UI, dompet yang dibuat saat UI English tersimpan `"Bank Account"` dan saat UI Indonesia `"Rekening Bank"` → nilai tidak konsisten antar-baris di database. Berlaku umum: **teks apa pun yang ditulis ke DB harus bebas bahasa UI.**

**Saldo bukan dihitung:** Saldo **tidak** otomatis dari transaksi — tidak ada trigger Supabase. Diupdate client-side via `adjustBalance(walletId, delta)` setiap transaksi dibuat/diedit/dihapus. Atomik-safe: baca saldo dari state React (sudah realtime sync), hitung di client, tulis ke Supabase sekaligus.

### Tabel `budgets`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL
category        text            ID kategori (nullable)
label           text            Nama budget
limit           numeric         Batas pengeluaran (Rupiah)
spent           numeric         ⚠️ Ada di DB tapi TIDAK DIPAKAI — spent selalu dihitung dari tx
color           text            Warna tampilan
enabled         boolean         ⚠️ Ada di DB tapi TIDAK DIPAKAI — semua budget tetap ditampilkan
wallet_id       uuid            FK wallets(id) ON DELETE SET NULL, nullable — added migration 20260909000000
created_at      timestamptz
```

**Spent selalu dihitung** dari array transaksi yang sudah di-memori, bukan dari kolom `spent` di DB. Satu-satunya perhitungan resmi ada di `src/lib/budgetSpent.js` (`getBudgetSpent`) — dipakai halaman Anggaran, `BudgetsCard`, dan `useNotifications`.

`wallet_id` NULL = anggaran umum (semua dompet), nilai untuk semua baris sebelum migrasi. Kalau diisi, `getBudgetSpent()` hanya menjumlahkan transaksi dompet itu (tx tanpa `wallet_id` dihitung milik dompet utama). Satu kategori boleh punya beberapa anggaran asal beda dompet; anggaran umum & anggaran per-dompet untuk kategori yang sama saling mengunci (`isCategoryBlocked` di `budgets-page.jsx`). `ON DELETE SET NULL`: dompet dihapus → anggarannya jadi anggaran umum, tidak ikut terhapus.

### Tabel `savings`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL
name            text            Nama goal
target          numeric         Target nominal
current         numeric         Saldo terkumpul (via depositToGoal)
deadline        date            Target date (lama, untuk kompatibilitas)
deadline_label  text            Label tampilan ("Jan 2026" atau "Tanpa tenggat")
deadline_date   date            ISO format (YYYY-MM-DD), nullable — added migration 20260701000000
color           text            Warna preset (8 pilihan)
icon            text            Ikon (star, emergency, travel, home, vehicle, education, gadget, gift, health, ring)
is_locked       boolean         true saat Basic melebihi limit
created_at      timestamptz
```

**Deposit manual:** `current` hanya berubah saat user eksplisit deposit via tombol. **Tidak ada** koneksi otomatis ke transaksi kategori "tabungan".

### Tabel `custom_categories`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL
name            text            Nama kategori (case-insensitive unique per user)
color           text            Warna hex
type            text            'income' | 'expense' (default 'expense')
is_deleted      boolean         Soft delete — tidak pernah hard delete
is_locked       boolean         true saat Basic melebihi limit
created_at      timestamptz
-- UNIQUE CONSTRAINT: (user_id, lower(name))
```

**Soft delete:** Kategori dihapus hanya di-flag `is_deleted = true` agar transaksi lama tetap bisa diresolvasi nama & warna.

### Tabel `debts` & `debt_payments`
```sql
-- debts
id              uuid            PRIMARY KEY
user_id         uuid            NOT NULL
type            text            'receivable' | 'payable'
person_name     text            NOT NULL
note            text            Keterangan opsional
amount          numeric         NOT NULL, > 0 (arah via type, bukan tanda minus)
paid            numeric         Akumulasi terbayar, default 0
wallet_id       uuid            FK → wallets.id ON DELETE SET NULL
date            date            Tanggal lokal
due_date        date            Jatuh tempo, opsional
status          text            'active' | 'paid'
is_deleted      boolean         Soft delete (created_at tetap terhitung untuk cooldown 50 hari)
is_locked       boolean         true saat Basic melebihi limit 5 aktif
created_at      timestamptz
updated_at      timestamptz

-- debt_payments
id              uuid            PRIMARY KEY
debt_id         uuid            NOT NULL, FK → debts.id ON DELETE CASCADE
user_id         uuid            NOT NULL
amount          numeric         NOT NULL, > 0
date            date            Tanggal cicilan
note            text            Opsional
transaction_id  uuid            FK → transactions.id ON DELETE CASCADE
created_at      timestamptz
```

### Tabel `user_subscriptions`
```sql
user_id                         uuid         PRIMARY KEY
plan                            text         'basic' | 'pro'
billing_cycle                   text         'monthly' | 'yearly' | null
started_at                      timestamptz
expires_at                      timestamptz  null = tidak ada kadaluarsa
updated_at                      timestamptz
last_custom_category_edit_at    timestamptz  Cooldown 30 hari edit kategori kustom (Basic only)
-- RevenueCat fields (migration 20260629000000):
revenuecat_app_user_id          text         RC App User ID
product_id                      text         Produk yang dibeli
original_purchase_at            timestamptz
latest_event_type               text         Event RC terakhir
latest_event_at                 timestamptz
raw_event                       jsonb        Payload webhook mentah
```

**Trigger otomatis:** Setiap user baru auto-dapat row dengan `plan='basic'`. `updated_at` auto-set via trigger.

**Keamanan (migration 20260630000001):** Policy UPDATE generik dihapus. Sensitif fields (`plan`, `expires_at`, RC fields) **hanya bisa diupdate** oleh:
- Edge Function `revenuecat-webhook` (service_role)
- RPC `SECURITY DEFINER` (lihat bagian 2 di `teknis_keputusan-infrastruktur-roadmap.md`)

**isPro logic:**
```javascript
isPro = plan === 'pro' && (expires_at === null || new Date(expires_at) > new Date())
```

### Tabel `error_logs`
```sql
id              uuid            PRIMARY KEY
user_id         uuid            FK → auth.users ON DELETE SET NULL, NULLABLE
source          text            NOT NULL — nama fungsi/modul asal (adjustBalance, debts, recurringHelper, etc)
message         text            NOT NULL — pesan error asli
metadata        jsonb           Nullable — konteks tambahan (wallet_id, debt_id, email, etc)
severity        text            'high' | 'medium' (CHECK constraint, default 'medium')
created_at      timestamptz     Auto-set
```

**Migration:** `supabase/migrations/20260706000000_add_error_logs.sql` (created 6 Juli 2026).

**Penulisan:** 
- Client → RPC `log_error()` SECURITY DEFINER (user_id otomatis dari JWT)
- Server (Edge Function) → langsung via `service_role`

**RLS:** SELECT hanya baris milik sendiri; tidak ada policy INSERT/UPDATE/DELETE untuk `authenticated`.

### Tabel `chat_rate_limits` (untuk Rate Limiter Money IQ)
```sql
user_id                 uuid            PRIMARY KEY
request_count           integer         Jumlah request dalam window
window_start            timestamptz     Awal jendela 60 detik
```

**Fungsi RPC:** `check_chat_rate_limit(p_max_requests=8, p_window_seconds=60) SECURITY DEFINER`
- Returns jsonb: `{allowed: boolean, remaining: int, reset_at: timestamptz}`
- Atomic UPDATE via SELECT FOR UPDATE untuk serialize per-user

---

### View `public.user_summary` (Referensi Manual Admin — Baru Didokumentasikan 23 Juli 2026)

**Status migration:** File `20260723000000_document_user_summary_view.sql` sudah dibuat lokal, **BELUM di-push/dieksekusi** ke Supabase.

**Riwayat:** View ini sudah ada di production sejak ~pertengahan Juni 2026, dibuat langsung via SQL Editor tanpa pernah tercatat sebagai migration file — baru diformalkan lewat migration di atas.

**Konfirmasi via grep codebase (22 Juli 2026):** **TIDAK** dipanggil oleh kode aplikasi manapun (tidak ada `supabase.from('user_summary')`, `.rpc()`, atau string literal `"user_summary"` di `src/` maupun `supabase/functions/`) — murni referensi manual admin lewat SQL Editor.

**Kolom (hasil join `auth.users` + `transactions`, grouped per user):**
```sql
user_id                            uuid      dari auth.users.id
email                               text      dari auth.users.email
total_saldo_dompet                 numeric   sum(transactions.amount) semua waktu
total_pemasukan_bulan_ini          numeric   sum amount tipe income, bulan berjalan
total_pengeluaran_bulan_ini        numeric   abs(sum amount tipe expense), bulan berjalan
```

**Temuan Security Advisor (22 Juli 2026) — 2 isu kritis, sudah diperbaiki manual di SQL Editor sebelum migration dibuat:**
1. **"Security Definer View"** — view berjalan dengan hak akses pembuat (admin), melompati RLS tabel `transactions` di baliknya. **Fix:** `with (security_invoker = on)`.
2. **"Exposed Auth Users"** — bisa diakses `anon`/`authenticated` lewat Data API publik, menyentuh `auth.users.email`. **Fix:** `revoke all on public.user_summary from anon, authenticated`.

Definisi di migration adalah salinan persis dari yang live di production per 23 Juli 2026 (sudah termasuk kedua fix di atas).

**Catatan akurasi (non-security, tidak diperbaiki):** Filter "bulan ini" pakai `created_at` (UTC), bukan kolom `date` (lokal WIB) sesuai konvensi project (lihat bagian 2 di atas). Bisa meleset di sekitar pergantian bulan. Diputuskan aman diabaikan karena view ini referensi internal admin saja, bukan data yang tampil ke user.

---

### Function Security Hardening (23 Juli 2026 — Belum Di-push)

Hasil audit Security Advisor Supabase menghasilkan 2 migration file tambahan (dibuat lokal, **belum dieksekusi/push**):

**`20260723010000_harden_functions_search_path_and_grants.sql`:**
- **Search path mutable fix:** Semua fungsi di schema `public` yang belum punya `search_path` eksplisit di-set ke `search_path = public, pg_temp` (loop otomatis, bukan hardcode per nama) — mencegah fungsi "ditipu" baca objek dari schema lain kalau `search_path` dimanipulasi pemanggil.
- **`handle_new_user_subscription`** (trigger-only, auto-jalan saat user baru daftar): execute di-revoke total dari `public, anon, authenticated` — trigger tetap jalan normal karena dieksekusi lewat mekanisme trigger Postgres, bukan panggilan API.
- **`check_chat_rate_limit`, `log_error`, `update_category_edit_cooldown`** (RPC yang memang dipanggil app dari user login): execute di-revoke dari `public, anon`, tetap `grant` ke `authenticated` — menutup akses dari user belum login, tanpa mematahkan fungsi untuk user yang sudah login.
- **`set_plan_for_testing`** — **KRITIS**, lihat detail di `teknis_keputusan-infrastruktur-roadmap.md` bagian 1.7 & bagian "CRITICAL SECURITY": execute di-revoke total dari `authenticated, anon, public`.

**`20260723020000_revoke_rls_auto_enable_execute.sql`:**
- `rls_auto_enable` adalah event trigger function (auto-enable RLS pada tabel baru) — Postgres sendiri menolak pemanggilan langsung fungsi `RETURNS event_trigger`, jadi ini murni hygiene fix untuk warning linter, tidak ada risiko fungsional.

---

### MonthYearPicker — Reusable Component Filter Bulan/Tahun Modern

- **File:** `src/components/MonthYearPicker.jsx`
- **Props:**
  - `isOpen` — visibility
  - `onClose()` — saat backdrop atau Escape
  - `onConfirm(month, year)` — callback pilihan; month = 0-indexed (Jan=0)
  - `locale` — format bulan (default 'id-ID')
  - `initialMonth` / `initialYear` — highlight awal
  - `availableMonthsByYear` — disable bulan tanpa data (opsional)
- **Internal:** `useScrollLock(isOpen)` sudah ada di component — pemanggil tidak perlu tambah sendiri
- **Used in:** CashflowCard, SpendingCard, TransactionsPage, AnalyticsPage
- **Status:** ✅ Selesai & tested

---

### Sidebar & Responsive Design (Added 18 Juli 2026)

#### Sidebar Komponen (`src/components/Sidebar.jsx`)
- **Breakpoint:** Hanya muncul di ≥750px (desktop/tablet)
- **Layout:** Fixed 240px width sidebar di sebelah kiri, 9 nav item (Beranda, Transaksi, Tabungan, Anggaran, Analitik, Laporan, Dompet, Hutang/Piutang, Pengaturan)
- **Mobile:** <750px — sidebar hidden via CSS `display: none`, BottomNav tetap aktif
- **Controlled via app.jsx:** `<Sidebar active={active} onNav={setActive} />`
- **CSS:** Dikontrol di `.sidebar { display: none }` + `@media (min-width: 750px)` rule di `index.css`

#### useContainerWidth Hook (`src/hooks/useContainerWidth.js`)
- **Tujuan:** Measure actual width `.main-content` container (excluding padding) untuk responsive component layout
- **Implementasi:** `ResizeObserver` + `useLayoutEffect` (synchronous measurement sebelum paint)
- **Constants:**
  - `CONTENT_COMPACT_MAX = 760` — threshold untuk TopBar/Transaksi/Budgets/Analytics compact layout
  - `TOPBAR_COMPACT_MAX = 900` — threshold lebih tinggi untuk TopBar (butuh space lebih)
- **Export:** `useIsCompact(containerSelector = '.main-content', breakpoint = CONTENT_COMPACT_MAX)` — return boolean
- **Used in:** TopBar, TransactionsPage, BudgetsPage, Transactions, Wallets, SavingsPage, AddDebtModal

#### Container Queries (@container)
- **CSS variable:** `container-type: inline-size` di `.main-content` — enable container-based queries (bukan viewport-based)
- **Benefit:** Komponen responsive berdasarkan actual container width, tidak viewport width. Tetap rapi saat 750-767px (sidebar transition zone)
- **Mobile queries:** `@container main-content (max-width: 759px)` — desktop-style layouts di tablet dipaksa compact (mirror mobile breakpoint behavior)

#### Modal Fixes (Web ≥750px)
- **CSS media block:** `@media (min-width: 768px)`
  - `.modal-sheet { max-height: 88vh; overflow-y: auto }` — modal tidak melebihi viewport
  - `.modal-actions { position: sticky; bottom: 0; padding-bottom: ... }` — tombol action tetap visible saat scroll
  - `.modal-sheet:has(.modal-actions) { padding-bottom: 0 }` — remove modal padding untuk flush footer
- **Sidebar overlap fix:** `.modal-backdrop` dengan `position: fixed; inset: 0` + `display: grid; placeItems: center` — modal sheet tertarik ke **center area konten visible** (viewport width dikurangi 240px Sidebar di sebelah kiri ≥750px), bukan center viewport penuh. Akibat: modal tidak covered by Sidebar dan tampil centered relative ke user's visible content area
- **Mobile (<750px):** Tidak diubah — modal UX di mobile tetap sama

---

*Dokumen ini adalah bagian 2 dari 4 — lihat `teknis_fitur-dan-tier.md` untuk dokumentasi fitur-fitur aplikasi.*
