# FinanceApp — Arsitektur Sistem & Database Schema

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-18 | **Versi App:** 2.6.0  
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
│   │   └── 20260716000000_add_chat_rate_limits.sql
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
bank            text            Nama bank/institusi
balance         numeric         Saldo — diupdate manual via adjustBalance()
type            text            'bank' | 'ewallet' | 'cash' | 'investment'
is_primary      boolean         Maksimal satu per user
color           text            Kode warna hex
last4           text            4 digit terakhir kartu (default '—')
is_locked       boolean         true saat Basic user melebihi limit
created_at      timestamptz
```

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
created_at      timestamptz
```

**Spent selalu dihitung** dari array transaksi yang sudah di-memori, bukan dari kolom `spent` di DB.

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
