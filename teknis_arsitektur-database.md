# FinanceApp — Arsitektur Sistem & Database Schema

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-09-09 | **Versi App:** 2.6.0  
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
balance         numeric         Saldo — diupdate via RPC atomik adjustBalance()
type            text            'bank' | 'ewallet' | 'cash' | 'investment'
is_primary      boolean         Maksimal satu per user
color           text            Kode warna hex
last4           text            4 digit terakhir kartu (default '—')
is_locked       boolean         true saat Basic user melebihi limit
created_at      timestamptz
```

⚠️ **Kolom `bank` tidak boleh diisi teks yang ikut bahasa UI.** Saat user tidak mengisi nama bank, `wallets.jsx` memakai `typeLabel(type)` — label tipe dompet versi **Bahasa Indonesia mentah** dari `ACCOUNT_TYPES`, BUKAN `typeLabelI18n()`. Kalau ikut bahasa UI, dompet yang dibuat saat UI English tersimpan `"Bank Account"` dan saat UI Indonesia `"Rekening Bank"` → nilai tidak konsisten antar-baris di database. Berlaku umum: **teks apa pun yang ditulis ke DB harus bebas bahasa UI.**

**Saldo bukan dihitung:** Saldo **tidak** otomatis dari transaksi — tidak ada trigger Supabase. Diupdate via `adjustBalance(walletId, delta)` setiap transaksi dibuat/diedit/dihapus, yang sejak 11 Sep 2026 memanggil RPC atomik `adjust_wallet_balance` (satu round-trip terkunci di server) — bukan lagi SELECT+UPDATE manual dua round-trip. Detail RPC & trade-off realtime: lihat bagian "RPC Saldo Atomik" di bawah.

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
icon            text            NOT NULL DEFAULT 'other'   — kind icon dari CatIcon (src/icons.jsx), dipilih saat buat/edit (edit tunduk cooldown 30 hari)
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
cash_disbursed_at_creation boolean NOT NULL DEFAULT true   — hanya bermakna untuk type='receivable'; false = belum dibayar (tagihan), true = uang sudah berpindah
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

### Tabel `chat_unanswered_log` (Analitik Pola Pertanyaan Gagal Money IQ — Sejak 17 Juli 2026)
```sql
id              uuid            PRIMARY KEY
question        text            NOT NULL — teks pertanyaan asli user
reason          text            NOT NULL — 'level1_blocked' | 'level2_blocked' | 'level3_declined' | 'data_kurang'
created_at      timestamptz     NOT NULL
```

**Privasi (final, bukan opsional):** Tabel **TIDAK menyimpan user_id** atau identitas apa pun — hanya teks pertanyaan + alasan gagal + waktu. Jangan pernah menambah `user_id`, email, atau kolom identitas ke tabel ini.

**Penulis:** HANYA Edge Function `financial-chat` via `service_role` (insert langsung, bypass RLS). BUKAN via RPC — karena kita tidak mau `auth.uid()` ikut tercatat.

**Pembaca:** Hanya Boss Ali via SQL Editor (`service_role`). User biasa tidak bisa membaca (RLS aktif, TANPA policy SELECT apa pun).

**Tujuan:** Analitik pola pertanyaan yang diblok keyword filter Level 1 — untuk memperbaiki filter. **INI BUKAN error logging teknis** (itu tabel terpisah `error_logs`).

**Retensi:** MANUAL berkala (tidak ada cron otomatis). Query untuk hapus data >30 hari: 
```sql
DELETE FROM public.chat_unanswered_log WHERE created_at < now() - interval '30 days';
```

**Migration:** `supabase/migrations/20260717000000_add_chat_unanswered_log.sql` (created 17 Juli 2026, executed).

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

### Function Security Hardening (23 Juli 2026 — SUDAH Di-push)

Hasil audit Security Advisor Supabase menghasilkan 2 migration file tambahan. **Keduanya sudah ter-apply di production** — diverifikasi 11 Sep 2026 lewat `list_migrations` (versi `20260723010000` & `20260723020000` tercatat) dan pengecekan langsung `pg_proc`: `set_plan_for_testing` kini hanya bisa dieksekusi `service_role`, sudah tidak lagi oleh `authenticated`. Heading ini sebelumnya menyebut "belum di-push" — itu keliru dan sudah dikoreksi.

**`20260723010000_harden_functions_search_path_and_grants.sql`:**
- **Search path mutable fix:** Semua fungsi di schema `public` yang belum punya `search_path` eksplisit di-set ke `search_path = public, pg_temp` (loop otomatis, bukan hardcode per nama) — mencegah fungsi "ditipu" baca objek dari schema lain kalau `search_path` dimanipulasi pemanggil.
- **`handle_new_user_subscription`** (trigger-only, auto-jalan saat user baru daftar): execute di-revoke total dari `public, anon, authenticated` — trigger tetap jalan normal karena dieksekusi lewat mekanisme trigger Postgres, bukan panggilan API.
- **`check_chat_rate_limit`, `log_error`, `update_category_edit_cooldown`** (RPC yang memang dipanggil app dari user login): execute di-revoke dari `public, anon`, tetap `grant` ke `authenticated` — menutup akses dari user belum login, tanpa mematahkan fungsi untuk user yang sudah login.
- **`set_plan_for_testing`** — **KRITIS**, lihat detail di `teknis_keputusan-infrastruktur-roadmap.md` bagian 1.7 & bagian "CRITICAL SECURITY": execute di-revoke total dari `authenticated, anon, public`.

**`20260723020000_revoke_rls_auto_enable_execute.sql`:**
- `rls_auto_enable` adalah event trigger function (auto-enable RLS pada tabel baru) — Postgres sendiri menolak pemanggilan langsung fungsi `RETURNS event_trigger`, jadi ini murni hygiene fix untuk warning linter, tidak ada risiko fungsional.

---

### RPC Saldo Atomik (11 Sep 2026)

Dua RPC `SECURITY DEFINER` (`search_path = public, pg_temp`, execute di-revoke dari `public, anon`, grant hanya `authenticated`) menggantikan pola SELECT-lalu-UPDATE saldo di klien yang rawan *lost update* antar-device.

**`adjust_wallet_balance(p_wallet_id uuid, p_delta numeric) → numeric`** (`20260911000000`, **sudah live**)
Satu `UPDATE wallets SET balance = balance + p_delta` terkunci; mengembalikan saldo baru. Dipakai `useWallets.adjustBalance()`, yang mempertahankan kontrak return `{ error }` (bukan throw) karena `useDebts` memperlakukan kegagalan saldo sebagai best-effort.

**`record_transaction(p_amount, p_category, p_date, p_wallet_id, p_merchant, p_note, p_time, p_method, p_debt_id) → uuid`** (`20260911010000`, **sudah live**)
INSERT baris `transactions` + UPDATE saldo dompet dalam **satu transaksi Postgres**, jadi tidak ada lagi jendela di mana transaksi tercatat tapi saldo belum berubah. Dipanggil dari `useTransactions.createTransaction()` (dipakai `app.jsx` lewat wrapper `handleCreateTransaction`).

Catatan penting:
- Identitas selalu dari `auth.uid()`, tidak pernah dari argumen (tidak ada `p_user_id` — IDOR).
- **Kuota plan Basic TIDAK dicek di dalam RPC.** Gating tetap di `useTransactions.createTransaction()` dengan `planLimits.js` sebagai sumber tunggal; jangan duplikasi ambangnya ke SQL.
- `amount` sudah bertanda (negatif = pengeluaran), jadi saldo cukup `balance + amount` **tanpa** `CASE WHEN type='income'`. Kolom `type` diturunkan dari tanda `amount` di dalam fungsi, supaya baris tidak bisa menyimpan `type` yang bertentangan dengan `amount`.
- `p_date` bertipe `date` dan **wajib** dikirim klien — sengaja tidak ada fallback `CURRENT_DATE`, karena `CURRENT_DATE` di server adalah UTC dan akan salah satu hari untuk WIB (lihat bagian 2).
- Setelah `record_transaction`, klien **tidak boleh** memanggil `adjustBalance()` lagi (dobel) — RPC sudah mengurus saldo di server.

**`patchLocalBalance()` DIHAPUS.** Sebelumnya dipakai untuk menulis delta saldo langsung ke state React sebagai optimistic update, sejajar dengan realtime subscription yang menulis nilai absolut. Dua penulis saldo itu race — urutan datang tidak terjamin, dan kalau realtime menang duluan lalu delta menyusul, saldo di layar dobel. Bug ini sudah diverifikasi manual (reproducible) dan fix-nya (menghapus patch delta, murni andalkan realtime) sudah divalidasi termasuk skenario 2x cicilan berturut-turut cepat. **Trade-off:** saldo di UI sekarang 100% bergantung koneksi realtime — kalau channel terputus (sinyal jelek, app lama di background), saldo di layar telat update sampai app dibuka ulang; data di DB sendiri tetap benar.

---

### Shared Wallet / Dompet Bersama — Task 2 (12 Sep 2026, sudah live)

Migrasi `20260912000000_add_wallet_members_and_shared_rls.sql`. Satu file untuk seluruh tahap ini — `supabase db push` menjalankan tiap file dalam satu transaksi, jadi tabel + policy + RPC commit bersama atau batal bersama.

#### Tabel `wallet_members`
```sql
id          uuid        PRIMARY KEY
wallet_id   uuid        NOT NULL, FK → wallets      ON DELETE CASCADE
user_id     uuid        NOT NULL, FK → auth.users   ON DELETE CASCADE
role        text        'owner' | 'editor' | 'viewer'   (default 'editor')
status      text        'pending' | 'active' | 'left'   (default 'pending')
invited_by  uuid        FK → auth.users ON DELETE SET NULL
created_at  timestamptz
joined_at   timestamptz
UNIQUE (wallet_id, user_id)
```

**Owner TIDAK punya baris di sini** — `wallets.user_id` tetap satu-satunya sumber kepemilikan, karena dua sumber kebenaran akan drift. Nilai `role = 'owner'` dicadangkan dan belum dipakai. Baris ber-`status='left'` sengaja disimpan (bukan dihapus) supaya riwayat undangan terlacak; konsekuensinya undangan ulang harus UPSERT, bukan INSERT, karena kena `UNIQUE (wallet_id, user_id)`.

Tiga index: `(wallet_id, user_id, status)` (pola query persis `wallet_access_role()`), `(user_id, status)` (arah "dompet apa yang saya ikuti", dipakai klien), dan **`transactions(wallet_id)`** — yang terakhir wajib, bukan optimasi: tabel `transactions` sebelumnya tidak punya index apa pun selain PK dan `idx_transactions_debt_id`, dan policy SELECT yang melebar akan seq-scan penuh tanpanya.

#### Helper `wallet_access_role(p_wallet_id uuid) → text`

`SECURITY DEFINER`, `STABLE`, `search_path = public, pg_temp`, execute di-revoke dari `public, anon`. Mengembalikan `'owner'` (dari `wallets.user_id`), `'editor'`/`'viewer'` (dari `wallet_members` ber-`status='active'`), atau `NULL` bila tidak punya akses.

**Kenapa helper, bukan `EXISTS()` langsung di policy:** policy `wallets` perlu membaca `wallet_members`, dan policy `wallet_members` perlu tahu siapa owner dompetnya. Kalau keduanya ditulis sebagai `EXISTS()` biasa, evaluasi policy saling memanggil dan Postgres melempar `infinite recursion detected in policy for relation "wallets"` — yang mematikan **seluruh** akses dompet, bukan cuma fitur berbagi. `SECURITY DEFINER` melewati RLS di dalam badan fungsi sehingga rantainya putus. **Jangan pernah** mengganti pemanggilan helper ini di policy dengan `EXISTS(SELECT … FROM wallet_members)` "supaya lebih eksplisit".

#### RLS: dari owner-only jadi owner OR anggota aktif

Policy `FOR ALL` lama dipecah per-perintah (pola yang sudah dipakai `debts`/`debt_payments`), karena satu `FOR ALL` memakai `USING` yang sama untuk baca dan tulis — tidak bisa menyatakan "boleh baca semua transaksi dompet, tapi hanya boleh hapus milik sendiri".

| | `wallets` | `transactions` |
|---|---|---|
| SELECT | `wallet_access_role(id) IS NOT NULL` | `user_id = uid` **OR** `wallet_access_role(wallet_id) IS NOT NULL` |
| INSERT | `user_id = uid` | `user_id = uid` AND role ∈ (owner, editor) |
| UPDATE | `user_id = uid` (owner saja) | `user_id = uid` (+ WITH CHECK role ∈ owner/editor) |
| DELETE | `user_id = uid` (owner saja) | `user_id = uid` |

Efek per role atas dompet bersama: **owner** penuh; **editor** baca + catat transaksi (dan ubah/hapus transaksinya sendiri); **viewer** baca saja — ditolak otomatis lewat fail-closed, karena `NULL IN (...)` bernilai `NULL` dan `NULL` di `WITH CHECK` = ditolak.

`wallets` UPDATE/DELETE sengaja owner-only: satu-satunya tulis yang benar-benar dibutuhkan member adalah **saldo**, dan itu lewat RPC `SECURITY DEFINER` yang melewati RLS — jadi policy tidak perlu dilonggarkan untuk itu. Kedua RPC (`adjust_wallet_balance`, `record_transaction`) kini memakai `wallet_access_role(w.id) IN ('owner','editor')` menggantikan `w.user_id = v_user_id`; inilah "titik perluasan Fitur B" yang ditandai di migrasi 11 Sep.

`user_id = uid` di SELECT `transactions` **dipertahankan sebagai cabang pertama**, bukan diganti: (a) setelah member keluar, dia harus tetap melihat transaksi yang dulu dia catat; (b) mayoritas mutlak baris adalah miliknya sendiri dan selesai di perbandingan murah itu tanpa memanggil helper.

#### Keputusan produk final (jangan diubah tanpa diskusi)

1. **Transaksi member atas nama member.** `record_transaction` menulis `user_id = auth.uid()`, bukan owner dompet — riwayat harus jelas siapa yang mencatat.
2. **Hapus/edit transaksi SIMETRIS.** Semua orang hanya boleh menyentuh transaksi ber-`user_id` miliknya sendiri — **termasuk owner, yang TIDAK punya hak override** atas transaksi yang dicatat member. `USING` pada policy UPDATE/DELETE sengaja tanpa cabang owner.
3. **Transaksi member tetap ada setelah dia keluar** dari dompet.
4. **Hutang/piutang TETAP PRIVAT, tidak ikut terbagi.** Cek `p_debt_id` di `record_transaction` sengaja tetap `d.user_id = v_user_id`, bukan cek peran dompet.

#### Sisi klien

`src/lib/walletAccess.js` (`fetchSharedWalletIds`, `sharedOrFilter`) dipakai `useWallets` dan `useTransactions`. Daftar id dompet bersama harus dihitung di klien karena filter realtime Supabase tidak mengerti keanggotaan — dia hanya bisa membandingkan satu kolom. Tanpa dompet bersama, kedua hook jatuh kembali ke `.eq('user_id', userId)` persis seperti sebelum fitur ini ada.

Realtime `useWallets` memakai **dua binding** di satu channel: `user_id=eq.<uid>` untuk dompet sendiri (otomatis mencakup dompet yang dibuat setelah subscribe) dan `id=in.(…)` untuk dompet bersama. Konsekuensinya daftar id itu **snapshot**: dompet yang dibagikan ke user *setelah* hook mount tidak terpantau sampai mount ulang.

⚠️ `useTransactions` **tidak punya realtime sama sekali** (sudah begitu sejak sebelum fitur ini) — transaksi yang dicatat member baru muncul di layar owner setelah refetch.

#### Catatan lain

- `user_summary` (view, `security_invoker=on`) **tidak terpengaruh**: dia tidak menyentuh tabel `wallets` sama sekali (`total_saldo_dompet` ternyata `sum(transactions.amount)`), agregasinya di-key pada `t.user_id` sehingga atribusi tidak bergeser, dan grant-nya hanya `postgres`/`service_role` yang keduanya `rolbypassrls`. Kalau suatu saat view ini di-`GRANT` ke `authenticated`, pelebaran policy `transactions` akan membuat user melihat baris user lain lengkap dengan email-nya — jangan lakukan itu.
- Security advisor memunculkan `wallet_access_role` di daftar "authenticated bisa eksekusi SECURITY DEFINER". Tidak bisa dihindari: policy dievaluasi sebagai role pemanggil, jadi `authenticated` wajib punya EXECUTE. Jinak — dipanggil langsung, fungsi ini hanya mengembalikan peran si pemanggil sendiri, dan UUID acak mengembalikan `NULL` baik dompetnya ada maupun tidak.
- Kuota plan Basic (`accounts.length` di `useWallets`) **belum** mengecualikan dompet bersama — dompet orang lain ikut memakan kuota member. Diketahui, ditunda ke Task 4.

---

### Shared Wallet — Alur Undangan, Task 3 — tested end-to-end (bukan rollback), production-verified 11 Sep 2026

Migrasi `20260913000000_add_wallet_invite_flow.sql` + perbaikan `20260914000000_fix_accept_invite_rate_limit.sql`. Empat RPC: `generate_wallet_invite`, `accept_wallet_invite`, `leave_wallet`, `remove_wallet_member`.

#### Tabel `wallet_invites` (terpisah dari `wallet_members`)

Kode 6 digit **tidak** disimpan di `wallet_members` — siklus hidupnya beda (kode: dibuat → ditebak → dipakai sekali/revoke/expired; keanggotaan: aktif → keluar), dan `wallet_members.user_id` NOT NULL tidak cocok untuk baris "penerima belum diketahui".

```sql
id          uuid        PRIMARY KEY
wallet_id   uuid        NOT NULL, FK → wallets ON DELETE CASCADE
code        text        NOT NULL
role        text        'editor' | 'viewer'          (TIDAK ADA 'owner')
status      text        'active' | 'accepted' | 'revoked'   (default 'active')
created_by  uuid        NOT NULL, FK → auth.users
accepted_by uuid        FK → auth.users ON DELETE SET NULL
expires_at  timestamptz NOT NULL
accepted_at timestamptz
created_at  timestamptz
```

Unique index **parsial**: `UNIQUE (code) WHERE status = 'active'` — kode yang sudah `accepted`/`revoked` boleh muncul lagi di kombinasi acak berikutnya, keunikan hanya berlaku di antara kode yang masih bisa ditebak. RLS: SELECT hanya untuk owner dompetnya (`wallet_access_role(wallet_id) = 'owner'`); tidak ada policy INSERT/UPDATE/DELETE sama sekali — tulis murni lewat RPC.

#### Tabel `wallet_invite_attempts` — rate limit brute force

Pola identik `chat_rate_limits`: satu baris per user, dikunci `FOR UPDATE` di dalam `accept_wallet_invite` untuk cek+increment atomik (default 10 percobaan / 15 menit, dua-duanya parameter RPC). **Kenapa per-user, bukan per-kode:** kode salah tidak match baris manapun di `wallet_invites`, jadi tidak ada baris invite untuk ditempeli penalti — beda dari brute force PIN yang menyerang satu target. Satu-satunya pertahanan RPC yang berfungsi adalah membatasi kecepatan tebak satu akun; melawan banyak akun sybil paralel di luar cakupan lapisan SQL.

#### `generate_wallet_invite(p_wallet_id, p_role DEFAULT 'editor', p_expires_in_hours DEFAULT 24)`

- **Fitur Pro-only, dicek DI DALAM RPC** (join `user_subscriptions`: `plan='pro' AND (expires_at IS NULL OR expires_at > now())`), bukan cuma client-side seperti limit transaksi/dompet Basic — ini gerbang fitur yang kalau dilewati lewat panggilan RPC langsung membuka akses **permanen** ke akun ketiga, beda dari kuota transient yang reset tiap bulan.
- Hanya owner (`wallet_access_role(p_wallet_id) = 'owner'`) yang boleh memanggil.
- **Satu kode aktif per dompet** — memanggil ulang otomatis me-revoke kode `active` lama milik dompet yang sama. Ini sekaligus jawaban "owner generate ulang karena kode hilang": tidak ada RPC `regenerate` terpisah, panggil `generate_wallet_invite` lagi sudah cukup, dan kode lama langsung mati sehingga tidak ada dua kode valid bersamaan.
- Expiry default **24 jam** (keputusan produk, param bisa di-override).

#### `accept_wallet_invite(p_code, p_max_attempts DEFAULT 10, p_window_seconds DEFAULT 900)`

> ⚠️ **KONTRAK BERBEDA DARI RPC LAIN DI REPO INI — WAJIB DIBACA SEBELUM MENULIS KLIEN (Task 4).**
> `accept_wallet_invite` **mengembalikan `jsonb`, bukan melempar exception**, untuk semua kegagalan yang diantisipasi. Jangan asumsikan dia `throw` seperti `adjust_wallet_balance`/`record_transaction`/`generate_wallet_invite`. Pemanggil **wajib memeriksa field `ok`** — `error` dari supabase-js akan `null` pada penolakan yang sah.
> ```jsonc
> { "ok": true,  "wallet_id": "…", "role": "editor" }
> { "ok": false, "reason": "invalid_code" }                       // tidak ada / kedaluwarsa / sudah dipakai
> { "ok": false, "reason": "already_member" }
> { "ok": false, "reason": "rate_limited", "reset_at": "…" }
> ```
> Satu-satunya yang masih `RAISE`: **tidak ada sesi login**. Lihat "Kenapa `RETURN`, bukan `RAISE`" di bawah — bentuk ini bukan preferensi gaya, ini syarat supaya rate limiter-nya berfungsi.

- Rate limit dicek **sebelum** menyentuh `wallet_invites` sama sekali; percobaan gagal tetap menghabiskan jatah (esensi anti-brute-force). `already_member` **juga** menghabiskan jatah — disengaja, supaya jalur rate-limit hanya punya satu bentuk tanpa cabang "refund" yang rawan salah-urut di kemudian hari.
- Kode dicari dengan `status='active' AND expires_at > now()`; `reason` **sama persis** (`invalid_code`) untuk "tidak ada", "sudah dipakai", dan "expired" — tidak membocorkan mana yang benar ke penebak (pola sama seperti `adjust_wallet_balance`).
- **MENOLAK bila pemanggil sudah anggota aktif** dompet itu — lihat "Keamanan: kenapa bukan UPSERT" di bawah.
- Kode **sekali pakai**: begitu diterima, `status` → `'accepted'`, tidak bisa dipakai orang lain.
- Member yang dulu `status='left'` dan menerima kode baru → rejoin dengan role dari kode yang baru dipakai (bisa beda dari role sebelumnya).

**Kenapa `RETURN`, bukan `RAISE` — bug yang sudah terjadi dan terverifikasi.** Versi pertama RPC ini (migrasi `20260913000000`) menaikkan `attempt_count` lalu `RAISE EXCEPTION` beberapa baris kemudian saat kode salah. PostgREST membungkus tiap panggilan RPC dalam **satu transaksi**, jadi `RAISE` membatalkan seluruh transaksi — **termasuk increment counter yang baru saja ditulis**. Akibatnya setiap tebakan salah menghapus hitungannya sendiri, dan lockout **tidak akan pernah menyala di produksi**. Terbukti di server: 12 percobaan kode salah berturut-turut → `attempt_count` tetap `1`. Saat counter di-set manual ke 10, pesan lockout muncul normal — jadi logika ambangnya benar sejak awal, yang rusak murni persistensinya. `check_chat_rate_limit` tidak kena bug ini karena dia memang `RETURN jsonb {allowed:false}` dan tidak pernah `RAISE` di jalur penolakan; migrasi `20260914000000` menyelaraskan RPC ini ke pola yang sama.

> **Aturan umum yang lahir dari sini:** di fungsi mana pun yang **menulis penghitung / jejak audit lalu menolak request** — jangan `RAISE` setelah menulis. `RAISE` = rollback = tulisan itu hilang. Pakai `RETURN` dengan nilai status. `RAISE` hanya boleh untuk kondisi yang memang tidak menyisakan apa pun untuk disimpan (mis. tidak ada sesi login), **atau** ketika rollback justru yang diinginkan — contohnya `generate_wallet_invite`, yang me-revoke kode lama lalu `RAISE` kalau gagal membuat kode unik: di situ rollback benar, karena kode lama memang harus tetap hidup kalau penggantinya gagal dibuat. `leave_wallet`/`remove_wallet_member` juga `UPDATE`-lalu-`RAISE`, tapi aman karena `RAISE`-nya hanya menyala saat `NOT FOUND`, yaitu ketika `UPDATE` menyentuh 0 baris — tidak ada tulisan yang hilang.

**Keamanan: kenapa bukan `ON CONFLICT DO UPDATE`.** Draft awal RPC ini pakai UPSERT buta (`INSERT ... ON CONFLICT (wallet_id,user_id) DO UPDATE SET role=...`). Itu berbahaya: karena hanya ada satu kode aktif per dompet, seorang **viewer yang sudah jadi anggota** bisa menaikkan perannya sendiri ke editor hanya dengan submit ulang kode yang beredar untuk orang lain — privilege escalation. Fix: `SELECT ... FOR UPDATE` eksplisit dulu, lalu bercabang tiga arah (belum pernah jadi anggota → INSERT; `status='left'` → UPDATE jadi active; **`status='active'` → tolak** dengan `reason: 'already_member'`). Hasil `FOUND` disimpan ke variabel sendiri (`v_has_member_row`) karena nilainya berubah setiap ada SELECT/UPDATE berikutnya. Perubahan role anggota aktif (kalau dibutuhkan nanti) harus lewat RPC terpisah yang jelas niatnya, bukan ditumpangkan ke jalur invite.

#### `leave_wallet(p_wallet_id)` & `remove_wallet_member(p_wallet_id, p_user_id)`

`leave_wallet`: anggota aktif keluar atas inisiatif sendiri. Owner tidak bisa memanggilnya untuk dompetnya sendiri — dia tidak punya baris di `wallet_members` (keputusan Task 2 #1), jadi selalu jatuh ke `NOT FOUND`. `remove_wallet_member`: owner-only, mengeluarkan anggota tertentu. Keduanya set `status='left'` (bukan DELETE) — transaksi yang sudah dicatat anggota **tidak ikut terhapus**, konsisten dengan keputusan produk Task 2 #3.

#### Diverifikasi di server — 11 Sep 2026, **committed sungguhan** (bukan rollback)

Dijalankan terhadap dua akun test (`demofimance` = owner Pro, `reviewfinance32` = basic) di dompet "Mes Lampung CAA":

| Uji | Hasil |
|---|---|
| Owner Pro generate kode | `513112`, `status=active`, expire tepat +24 jam |
| Member accept | `wallet_members` baru `editor/active`, `invited_by` terisi; invite → `accepted` + `accepted_by`/`accepted_at`; counter naik ke 1 |
| Reuse kode yang sama | ditolak `invalid_code` |
| Generate ulang 2× | kode ke-2 → `revoked`, kode ke-3 → `active`; tepat satu `active` per dompet. Kode yang sudah `accepted` **tidak** ikut jadi `revoked` (klausa revoke hanya menyasar `status='active'`) |
| Akun basic generate (di dompetnya sendiri) | ditolak "berbagi dompet khusus pengguna Pro" — lolos cek owner dulu, lalu kena gate Pro |
| **11 kode salah berturut-turut, panggilan asli** | percobaan 1-10 → `invalid_code`, counter naik sendiri 0→10; **percobaan ke-11 → `rate_limited`** dengan `reset_at` tepat +900 detik |
| Kode **benar** saat terkunci | tetap ditolak `rate_limited` — lockout benar-benar memproteksi, bukan sekadar pesan |
| Counter saat terkunci | berhenti di 10, tidak naik ke 11 (jalur terkunci sengaja tidak increment) |
| `already_member` | ditolak benar, **memakan jatah** (counter 0→1), kode tetap `active`, role tetap `editor` — tidak berubah diam-diam |

Uji `leave_wallet` (berhasil sekali, ditolak kalau dipanggil dua kali) dan `remove_wallet_member` (ditolak atas anggota yang sudah `left`) diverifikasi lewat simulasi rollback sebelumnya.

#### Untuk Task 4 (UI, belum dikerjakan)

- **Wajib:** periksa field `ok` dari `accept_wallet_invite`, **jangan** andalkan `error` dari supabase-js — lihat kotak peringatan kontrak di atas. Petakan tiap `reason` ke pesan UI: `invalid_code` → "Kode salah atau sudah kedaluwarsa", `already_member` → "Kamu sudah jadi anggota dompet ini", `rate_limited` → tampilkan waktu dari `reset_at`.
- **Wajib:** tampilkan status kode undangan (aktif / dipakai / kedaluwarsa) — data ada di `wallet_invites` (`status`, `expires_at`), owner bisa `SELECT` barisnya sendiri.
- Belum ada RPC untuk mengubah role anggota aktif tanpa lewat leave+invite-ulang — kalau dibutuhkan, harus RPC baru (`set_wallet_member_role`, owner-only), bukan menumpang `accept_wallet_invite`.
- `ON DELETE CASCADE` dari `wallets` ke `transactions` masih terbuka (lihat backlog roadmap) — belum ada guard di alur hapus dompet.

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
