# FinanceApp — Keputusan Arsitektur, Infrastruktur, & Roadmap

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-09-15 | **Versi App:** 2.8.0  
> **Tujuan:** Dokumentasi keputusan teknis, infrastruktur, status project, dan roadmap pengembangan.

---

## 1. Keputusan Arsitektur Penting

### 1.1 Tanggal Selalu Lokal, Tidak Pernah UTC

**Keputusan:** Kolom `date` di tabel `transactions` menyimpan tanggal lokal (WIB) dalam format `YYYY-MM-DD`, bukan UTC timestamp.

**Alasan:** Menggunakan `toISOString()` atau UTC menyebabkan transaksi jam 01:00 WIB (= 18:00 UTC hari sebelumnya) tercatat di hari yang salah (off-by-one timezone WIB).

**Implementasi:**
```javascript
const dateToISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

---

### 1.2 Budget Spent Selalu Dihitung, Tidak Disimpan

**Keputusan:** Kolom `spent` di tabel `budgets` tidak dipakai. Progress budget dihitung ulang dari array transaksi setiap render.

**Alasan:** Menghindari sinkronisasi dua sumber data yang bisa tidak konsisten. Dengan menghitung dari transaksi aktual, angka selalu akurat.

---

### 1.3 Soft Delete untuk Kategori Kustom

**Keputusan:** Kategori kustom tidak pernah di-hard delete dari database.

**Alasan:** Transaksi lama yang menggunakan UUID kategori tersebut masih perlu bisa ditampilkan nama dan warnanya. Hard delete akan membuat transaksi lama tidak bisa diresolvasi.

---

### 1.4 Fail-Closed untuk Loading Plan

**Keputusan:** Selama data subscription belum di-load, aplikasi menerapkan limit `basic`.

**Alasan:** Lebih aman menampilkan "fitur terkunci sementara" daripada memberikan akses Pro secara tidak sengaja kepada Basic user saat data belum tersedia.

---

### 1.5 Saldo Dompet di Sisi Client (Bukan Trigger DB)

**Keputusan:** Saldo dompet diupdate dari sisi client React, bukan via trigger database.

**Alasan:** "Atomic-safe balance adjustment: baca saldo saat ini dari state (sudah di-sync via realtime), hitung nilai baru di client, lalu tulis sekaligus. Aman untuk single-user."

**Keterbatasan:** Jika user membuka app di dua device bersamaan dan melakukan transaksi bersamaan, bisa terjadi race condition (salah satu update saldo tertimpa). Untuk single-user normal, ini aman.

---

### 1.6 localStorage untuk Notifikasi dan Recurring

**Keputusan:** Notifikasi dan jadwal transaksi berulang disimpan di `localStorage`, bukan Supabase.

**Akibat:** Data ini **tidak sinkron antar device**. Notifikasi yang dibaca di HP tidak otomatis "dibaca" di tablet. Jadwal recurring yang ada di satu device tidak otomatis ada di device lain.

---

### 1.7 Keamanan Tabel `user_subscriptions` via RPC SECURITY DEFINER

**Keputusan:** Setelah ditemukan celah bahwa user bisa upgrade diri sendiri ke Pro via browser console (`supabase.from('user_subscriptions').update({ plan: 'pro' })...`), policy `UPDATE` generik dihapus sepenuhnya.

**Pengganti:** Semua operasi tulis dari client ke `user_subscriptions` menggunakan RPC function dengan `SECURITY DEFINER` yang memvalidasi `auth.uid()`:

| RPC Function | Tujuan | Dipanggil dari | Execute grant (per migration `20260723010000`, executed — diverifikasi 11 Sep 2026) |
|---|---|---|---|
| `update_category_edit_cooldown(p_user_id)` | Update `last_custom_category_edit_at` | `EditCategoryModal.jsx` | `authenticated` saja (revoke dari `public, anon`) |
| `set_plan_for_testing(p_user_id, p_plan, ...)` | Ubah plan untuk testing (DEV only) | `useSubscription.js → setPlanForTesting` | **Revoke TOTAL** dari `authenticated, anon, public` — lihat bagian "CRITICAL SECURITY" di bawah |
| `check_chat_rate_limit(p_max_requests, p_window_seconds)` | Cek & update rate limit chatbot | `index.ts (financial-chat)` | `authenticated` saja (revoke dari `public, anon`) |
| `log_error(p_source, p_message, p_metadata, p_severity)` | Catat error ke error_logs | `errorLogger.js` (client-side logging) | `authenticated` saja (revoke dari `public, anon`) |

Kolom sensitif (`plan`, `expires_at`, RC fields) **hanya bisa diupdate** oleh Edge Function `revenuecat-webhook` via `service_role` (bypass RLS).

**✅ Catatan status:** Migration `20260723010000_harden_functions_search_path_and_grants.sql` sudah dieksekusi/push — kolom grant di atas aktif di production, diverifikasi 11 Sep 2026 (lihat bagian 1.12 dan "CRITICAL SECURITY" di bawah). Bagian ini sebelumnya menyebut "belum di-push"; itu keliru dan sudah dikoreksi.

**Lapisan keamanan ganda untuk `setPlanForTesting`:**
1. Guard `import.meta.env.DEV` di level fungsi JS — tidak jalan di production build
2. Cek `auth.uid() === p_user_id` di level RPC — tidak bisa dipalsukan dari client

---

### 1.8 Key Prop untuk WeeklySummaryCard di Analitik

**Keputusan:** `<WeeklySummaryCard key={selectedWalletId} />` — key berubah setiap kali filter dompet berubah.

**Alasan:** Dismiss state (`dismissed`) diinisialisasi dari localStorage di `useState` initializer yang hanya berjalan saat mount. Dengan key yang berubah, komponen di-remount → `useState` initializer membaca localStorage dengan key yang benar untuk dompet yang baru dipilih.

---

### 1.9 Error Logging Hanya untuk Uang/Data Permanen, Bukan Semua Error

**Keputusan:** `logError()` sengaja **tidak** dipasang di semua catch block aplikasi — hanya di titik yang melibatkan saldo dompet, orkestrasi hutang/piutang, transaksi berulang otomatis, webhook langganan, dan auth (signup/reset password/verify OTP).

**Alasan:** Mencegah tabel `error_logs` banjir noise dari error UI yang tidak penting (modal gagal buka, toggle tema, dll.), yang akan membuat error yang benar-benar kritis (uang/data) tenggelam di antara ribuan baris tidak relevan.

**Pola keamanan reuse dari 1.7:** Penulisan ke `error_logs` dari client memakai RPC `log_error()` SECURITY DEFINER — persis pola yang sama dengan `update_category_edit_cooldown`. Tidak ada policy INSERT untuk `authenticated`. Edge Function menulis langsung via `service_role`.

**`logError()` tidak boleh mengganggu alur utama:** Fungsi dibungkus `try-catch` penuh di dalam dirinya sendiri — kegagalan menulis log (mis. user offline) jatuh ke `console.error`, tidak pernah melempar exception ke pemanggil.

---

### 1.10 Rate Limiting Per-User Sebelum L1 Guardrail

**Keputusan:** Money IQ chatbot cek rate limit (8 req/min per user) **sebelum** L1 keyword filter, untuk mencegah abusu request yang banyak membakar Groq quota.

**Implementasi:** 
- Tabel `chat_rate_limits` (user_id, request_count, window_start)
- RPC `check_chat_rate_limit()` SECURITY DEFINER dengan atomic SELECT FOR UPDATE (serialize per-user request)
- Fail-open pattern: jika RPC error, log dan lanjut (don't block user sah karena bug rate-limiter)
- Response status 200 (bukan 429) dengan `source:"rate_limit"` supaya pesan friendly ditampilkan

---

### 1.11 Dokumentasi Resmi View `user_summary` + Perbaikan Security Advisor (22-23 Juli 2026)

**Konteks:** View `public.user_summary` (referensi manual admin — daftar user + ringkasan saldo/pemasukan/pengeluaran bulan berjalan) sudah ada di production sejak pertengahan Juni 2026, dibuat langsung via SQL Editor, tanpa pernah tercatat sebagai migration file.

**Investigasi (22 Juli 2026):** Grep menyeluruh atas codebase (`src/`, `supabase/functions/`) untuk pola `supabase.from('user_summary')`, pemanggilan `.rpc()`, dan string literal `"user_summary"` — **tidak ditemukan satu pun kecocokan**. Kesimpulan: view ini murni referensi manual admin, tidak pernah dipanggil oleh kode aplikasi mana pun.

**Temuan Security Advisor Supabase (22 Juli 2026) atas view ini — 2 isu kritis:**
1. **Security Definer View** — view berjalan dengan hak akses pembuat (admin), melompati RLS tabel `transactions` di baliknya.
2. **Exposed Auth Users** — bisa diakses `anon`/`authenticated` lewat Data API publik, dan menyentuh data `auth.users.email`.

**Keputusan:** Kedua isu diperbaiki manual di SQL Editor (`security_invoker = on` + `revoke all ... from anon, authenticated`), lalu diformalkan sebagai migration `20260723000000_document_user_summary_view.sql` — dibuat lokal sebagai dokumentasi resmi, **sudah di-push** (diverifikasi via `supabase migration list`, 15/20 Sep 2026 — `local` = `remote`).

**Detail lengkap:** Lihat `teknis_arsitektur-database.md` bagian "View `public.user_summary`".

---

### 1.12 Function Search Path & Execute Grants Hardening (23 Juli 2026)

**Konteks:** Lanjutan audit Security Advisor Supabase (22-23 Juli 2026) menemukan 3 kategori warning tambahan di luar view `user_summary`:
1. **Function Search Path Mutable** (3 warning) — sejumlah fungsi di schema `public` tidak punya `search_path` eksplisit, berisiko fungsi "ditipu" membaca objek dari schema lain kalau `search_path` dimanipulasi pemanggil.
2. **Execute grant terlalu longgar** pada fungsi trigger-only dan RPC yang seharusnya hanya untuk `authenticated`.
3. **`set_plan_for_testing` masih bisa dipanggil `authenticated`** — ini adalah blocker kritis yang sudah lama ditandai di bagian "CRITICAL SECURITY" di bawah.

**Keputusan:** Dibuat 2 migration file baru untuk mengatasi seluruhnya sekaligus:
- `20260723010000_harden_functions_search_path_and_grants.sql` — set `search_path = public, pg_temp` untuk semua fungsi `public` yang belum di-set (loop otomatis via `pg_proc`/`pg_get_function_identity_arguments`, bukan hardcode nama fungsi satu-satu); revoke total execute `handle_new_user_subscription` (trigger-only); revoke `public, anon` (tetap grant `authenticated`) untuk `check_chat_rate_limit`, `log_error`, `update_category_edit_cooldown`; **revoke total** `set_plan_for_testing` dari `authenticated, anon, public`.
- `20260723020000_revoke_rls_auto_enable_execute.sql` — revoke execute `rls_auto_enable` (event trigger function auto-enable RLS pada tabel baru); murni hygiene, Postgres sudah menolak pemanggilan langsung fungsi `RETURNS event_trigger` jadi tidak ada risiko fungsional yang berubah.

**Status: ✅ KEDUA FILE SUDAH DIEKSEKUSI/PUSH** — diverifikasi 11 Sep 2026 lewat `list_migrations` dan pengecekan langsung `pg_proc`. Blocker kritis `set_plan_for_testing` (lihat "CRITICAL SECURITY" di bawah) tertutup sejak saat itu.

**Detail lengkap:** Lihat `teknis_arsitektur-database.md` bagian "Function Security Hardening".

---

### 1.13 Single-Currency — Nominal Tidak Pernah Ikut Bahasa UI (9 September 2026)

**Keputusan:** Aplikasi ini **sengaja single-currency**. Nominal uang selalu Rupiah dengan pemisah `id-ID` (`Rp 1.234.567`) di **semua** bahasa, termasuk saat UI di-set English. Ini keputusan final, bukan pekerjaan i18n yang belum selesai.

**Alasan:** Empat helper format uang di `data.jsx` (`fmt`, `fmtSigned`, `formatNominal`, `fmtShort`) sudah terkunci `id-ID` dan dipakai di 22+ file. Kalau hanya sebagian (mis. laporan) yang diubah ikut bahasa, satu layar yang sama akan menampilkan dua gaya mata uang sekaligus — lebih buruk daripada inkonsistensi yang mau diperbaiki. Mengubah semuanya berarti mengubah makna angka (Rp → USD?) yang bukan cakupan aplikasi ini.

**Yang terkunci dan TIDAK boleh dimigrasi:**
- `fmt`, `fmtSigned`, `formatNominal`, `fmtShort` di `data.jsx`
- `rupiah()` lokal di `reports.jsx` (`buildReportDoc`, `downloadPdf`, `ExcelPreviewRenderer`) dan `report-excel.js`
- `rupiahShort()` beserta sufiks `rb`/`jt`/`M`
- Format angka Excel `RP_FMT`/`PCT_FMT` (termasuk literal `"Rp"` di dalamnya)

**Yang TETAP ikut bahasa UI (beda urusan dengan currency):** semua teks label, dan **tanggal + nama bulan** via `toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'id-ID', …)` — lihat `SubscriptionStatus.jsx` dan `dateLocale()`/`longDate()` di `reports.jsx`.

---

### 1.14 Label Kategori: `id` Kanonik di DB, Terjemahan Hanya di Lapisan Tampilan (9 September 2026)

**Keputusan:** Kolom `category` di `transactions`/`budgets` menyimpan **kode** (`food`, `salary`, …) atau UUID kategori kustom — tidak pernah teks label. Terjemahan terjadi murni saat render lewat resolver `categoryLabel(cat, t)` (`src/category-field.jsx`) yang membaca key `kategori.<id>`.

**Alasan:** Label jadi murni presentasi, sehingga ganti bahasa tidak butuh migrasi data sama sekali. Array di `data.jsx` sengaja **tidak diubah** — label Indonesia di sana sekarang berfungsi sebagai `defaultValue` fallback, jadi titik render yang belum disambungkan tetap menampilkan teks lama (aman), bukan kosong/error.

**Aturan turunan:**
- **Kategori kustom milik user tidak pernah diterjemahkan** — id-nya UUID, tidak punya key `kategori.<uuid>`, jadi `defaultValue` mengembalikan nama simpanan apa adanya.
- **Teks apa pun yang ditulis ke DB harus bebas bahasa UI.** Contoh nyata: `wallets.jsx` mengisi kolom `bank` dengan `typeLabel(type)` (Indonesia mentah), BUKAN `typeLabelI18n()` — lihat `teknis_arsitektur-database.md` tabel `wallets`.
- Di `reports.jsx`, helper `catLabelOf()` di `aggregate()`/`withLabels()` adalah **satu-satunya** sumber label kategori untuk PDF, file .xlsx, dan pratinjau Excel — supaya ketiganya identik. Ini wajib karena label kategori dipakai sebagai kriteria SUMIFS lintas-sheet di `report-excel.js`.

---

### 1.15 Hotfix: Identitas Basi di 8 Titik Tulis (12 September 2026)

**Bug:** Tiap hook penulis (`useWallets.createAccount`, `useBudgets.createBudget`/`migrateFromLocalStorage`, `useSavings.createGoal`, `useDebts.createDebt`/`addPayment`, `useCustomCategories.addCustomCategory`, `useTransactions.createTransaction` sebelum pindah ke RPC) menerima `userId` sebagai **prop React** (`session.user.id` dari `app.jsx`), lalu menaruhnya langsung di payload INSERT. Prop itu state React — umurnya bisa berbeda dari token yang benar-benar dilampirkan Supabase SDK ke request (ganti akun di tab lain, sesi di-refresh). Kalau melenceng, RLS menolak dengan `42501` — pesan yang tidak menyebut identitas sama sekali, sehingga nyaris mustahil didiagnosis dari gejalanya saja (persis mirip bug P0 `wallets` SELECT-policy yang lain di hari yang sama — lihat `teknis_arsitektur-database.md` § "Jebakan STABLE + RETURNING").

**Fix:** `src/lib/authIdentity.js` — `requireUserId()` mengambil identitas dari `supabase.auth.getSession()` (bukan `getUser()`, yang selalu roundtrip jaringan) di **baris pertama** tiap fungsi tulis, sebelum panggilan jaringan pertama apa pun. Sesi kosong → error `umum.sesiBerakhir` langsung, tidak pernah diteruskan sebagai `user_id` kosong. `useCustomCategories` pakai varian `requireUserIdAsText()` karena kontrak error-nya string, bukan objek `Error`.

**Aturan turunan (berlaku untuk tulisan baru mana pun):**
- Gerbang identitas harus mendahului **panggilan jaringan pertama** di fungsi itu — termasuk query kuota/cooldown yang hanya baca, karena sesi mati + request sia-sia tetap request yang terkirim. Ditemukan sebagai bug susulan sendiri (`createTransaction`/`createDebt` mengecek kuota Basic dulu, baru identitas) dan diperbaiki di commit `f003214`.
- Tapi jangan naikkan gerbang lebih awal dari perlu: `addCustomCategory` sengaja tidak digerbangi di titik paling atas — deteksi duplikat di atasnya murni state lokal dan sah berhasil tanpa jaringan.
- Untuk jalur ber-paywall, cek identitas diletakkan **setelah** cek kuota, supaya paywall tetap muncul duluan saat Basic mentok — bukan pesan "sesi berakhir" yang salah konteks.
- `p_user_id` di RPC `SECURITY DEFINER` (mis. `EditCategoryModal`, `useSubscription`) **tidak termasuk** kelas bug ini — RPC itu memakai `auth.uid()` di dalam body, argumennya cuma dekorasi.
- **Khusus `feature/shared-wallet-ui`:** jangan terapkan fix ini ke `useTransactions` — di branch itu transaksi sudah lewat RPC `record_transaction` yang menurunkan `user_id = auth.uid()` di server; payload klien tidak pernah membawa identitas sama sekali, jadi `requireUserId()` di sana cuma duplikasi percuma.

**Verifikasi:** 8 titik ditelusuri mekanis (posisi `requireUserId()` vs kemunculan pertama `supabase.from`/`.rpc`), lolos user test Bagian A (7 jalur sesi normal, non-regresi) dan Bagian B (sesi habis → nol request `/rest/v1/*` yang benar-benar terkirim). Ikut tertutup di batch yang sama: `AddAccountModal`/`AddGoalModal` memanggil `onCreate()` tanpa `await` sehingga kegagalan apa pun (termasuk bug ini) berakhir senyap tanpa pesan — sekarang keduanya menunggu hasil dan menampilkan pesan merah bila gagal.

---

### 1.16 Hotfix: Tabrakan Nama Variabel `t` Mematikan Paywall (12 September 2026)

**Bug:** Tiga gate plan Basic di `AuthenticatedApp` (`app.jsx`) — tambah dompet ke-2, goal ke-3, Scan Nota — memanggil `t('...')` sebagai fungsi terjemahan i18next. Tapi di komponen `AuthenticatedApp`, nama `t` sudah dipegang objek `TWEAKS` (`const [t, setTweakRaw] = useTweaks(defaults)`); `useTranslation()` memang ada di file yang sama tapi di komponen `App` yang berbeda. Memanggil objek sebagai fungsi melempar `t is not a function` dan mematikan layar **tepat** saat user Basic menyentuh batas plannya — `PaywallModal` tidak pernah sempat muncul, jadi bug ini juga menyembunyikan gejalanya sendiri (upgrade yang seharusnya ditawarkan malah jadi layar rusak).

**Kenapa lolos lama:** masuk saat migrasi i18n klaster 2 (`2ea2615`) mengganti argumen `openPaywall(...)` dari string hardcode ke panggilan `t()`. Hanya terpicu oleh akun Basic yang sudah mentok limit, sedangkan pengembangan sehari-hari memakai akun Pro — jadi tidak pernah tersentuh manual testing.

**Fix:** ganti ke `i18n.t()` — pola yang sama dengan `useDebts.js` dan `reports.jsx` untuk memanggil terjemahan di luar scope yang punya `t` dari `useTranslation()`. Nilai terjemahannya identik dengan string hardcode sebelumnya, jadi teks paywall tidak berubah.

**Pelajaran umum:** nama variabel generik (`t`, `data`, `error`) yang punya makna berbeda di dua komponen dalam satu file adalah kelas bug yang gagal senyap — tidak ada type error karena JS tidak mengecek "apakah `t` ini fungsi", cuma crash saat dipanggil. Saat menambah kode baru di file dengan banyak komponen (`app.jsx` khususnya), cek dulu `t` di scope itu maksudnya apa sebelum memakainya sebagai fungsi terjemahan.

---

### 1.17 Status Terkunci Selalu Dihitung, Tidak Disimpan (15 September 2026)

**Keputusan:** Kolom `is_locked` di `wallets`/`savings`/`custom_categories`/`debts` **tidak lagi dibaca siapa pun**. Status terkunci (soft lock sisa downgrade Pro→Basic) dihitung di klien oleh `src/lib/lockStatus.js`: N item paling lama (`created_at` ASC, `id` sebagai pemecah seri) tetap aktif, sisanya terkunci, dengan N dari `PLAN_LIMITS`. Pola yang sama dengan §1.2 (`budgets.spent` sengaja tidak dipakai, progress dihitung ulang dari transaksi).

**Alasan:** Kolom itu hanya pernah ditulis `planReconciliation.js`, dan itu pun hanya kalau ada tab terbuka yang kebetulan menyaksikan transisi plan Pro→Basic (`useSubscription.js:79-83`; cold start dilewati karena `prevIsProRef` masih `null`). Downgrade yang terjadi saat app tertutup tidak pernah memperbarui kolomnya — UI lalu memakai status basi tanpa jejak apa pun. Hasil hitungan tidak bisa basi: dia fungsi murni dari (isi array, limit saat ini), dan tidak bergantung pada tulisan async mana pun sukses duluan.

**Kolom TIDAK dihapus dari DB dan `planReconciliation.js` TIDAK dicabut** — dia boleh terus menulis kolom yatim itu (harmless: tidak ada policy/trigger/RPC yang membacanya di server, diverifikasi 15 Sep 2026). Yang berubah cuma sumber kebenaran di klien.

**Aturan turunan:**
- Hitungannya ditempel di **satu memo turunan per hook** (`debtsWithLock`, `goalsWithLock`, `categoriesWithLock`, dan di dalam `visibleAccounts` untuk wallets), bukan di dalam `toAppX()` per baris — status ini fungsi dari SELURUH array, dan menghitungnya per baris berarti mengulang logika yang sama di tiap penulis state (fetch, realtime, create, delete) dengan risiko satu di antaranya kelupaan. Gerbang tulis di dalam hook (`addPayment`/`markPaid`/`deleteDebt`/`depositToGoal`) ikut membaca array turunan itu, bukan state mentah.
- **Dompet bersama selalu tampil TIDAK terkunci.** Status terkunci dompet orang lain mencerminkan kuota pemiliknya, dan klien ini tidak punya (serta menurut RLS tidak boleh punya) visibilitas ke daftar dompet lain milik orang itu maupun ke plan-nya. Regresi visual ini diterima sadar karena `is_locked` pada `wallets` murni kosmetik — nol gerbang tulis fungsional yang bergantung padanya (diverifikasi, `docs/investigasi-bug-4-5-6-2026-09-15.md` Bagian E3).
- Tiebreaker `id` saat `created_at` kembar itu **wajib, bukan kosmetik**: tanpa itu dua baris berwaktu identik bisa bertukar posisi antar-render dan yang tampil terkunci berganti sendiri tanpa ada data yang berubah.
- `checkCreateAllowed()` tidak lagi memfilter `!is_locked` untuk menghitung kuota aktif — memakai `Math.min(jumlah aktif, maxActiveDebts)`. Formula lama diam-diam bergantung pada kolom `is_locked` sudah benar di DB, artinya bergantung pada rekonsiliasi async pernah sukses duluan.

---

### 1.18 Gerbang Tier Dua Lapis: Klien untuk UX, Server untuk Penegakan (16 September 2026)

**Keputusan ini MENUTUP "SATU KELUARGA" bug #4/#5/#6 sebagai satu keputusan arsitektur, bukan tiga perbaikan terpisah.** Ketiganya ditemukan dalam satu investigasi (`docs/investigasi-bug-4-5-6-2026-09-15.md`) dan punya akar yang sama: **status tier disimpan/dievaluasi di tempat yang tidak otoritatif.**

| Bug | Gejalanya | Akar yang sama |
|---|---|---|
| #5 | `checkCreateAllowed()` fail-open saat query cooldown gagal | keputusan tier diambil dari data yang mungkin **tidak pernah sampai** |
| #4 | `is_locked` basi karena hanya terisi kalau ada tab yang menyaksikan transisi plan | keputusan tier dibaca dari kolom yang **mungkin tidak pernah ditulis** |
| #6 | Limit Basic hanya hidup di klien — PostgREST langsung melewatinya | keputusan tier diambil di tempat yang **bisa dilewati pemanggil** |

**Aturan yang dihasilkan, berlaku untuk limit tier apa pun ke depan:**

> Sebuah limit tier harus dievaluasi di tempat yang **tidak bisa dilewati** (server) dan dari data yang **tidak bisa basi** (dihitung saat itu juga, bukan kolom status). Klien tetap mengevaluasinya juga — tapi perannya UX, bukan penegakan.

Konkretnya sekarang: **lapis 1 UI** (LockBadge/paywall), **lapis 2 hook klien** (precheck, `{limitReached:true}`), **lapis 3 RPC `SECURITY DEFINER`** (`create_wallet`, `create_savings_goal`, `create_custom_category`, `create_debt` — migrasi `20260921000000`). Lapis 2 **tidak boleh dihapus** karena lapis 3 ada: round-trip untuk memberi tahu "kuota habis" adalah UX yang lebih buruk, dan untuk hutang lapis 2 juga satu-satunya sumber `cooldownUntilDate` di jalur normal. Penolakan lapis 3 dipetakan ke pesan UI yang sama persis dengan lapis 2.

**Konsekuensi yang diterima sadar:**
- **Ambang limit sekarang ada di dua tempat** (`planLimits.js` dan konstanta di migrasi), disinkronkan manual. Alternatifnya — tabel limit di server yang dibaca klien — menukar duplikasi dengan satu query lagi di jalur start-up dan satu sumber kegagalan baru; ditolak untuk sekarang. Tiap konstanta di SQL diberi komentar pengingat, dan kalau limit berubah, **ubah di dua tempat**.
- **Ambang TIDAK BOLEH jadi parameter RPC.** `check_chat_rate_limit` menerima ambangnya sebagai argumen dan itu aman di sana (dipanggil edge function); keempat RPC ini dipanggil klien langsung, jadi ambang yang bisa dikirim pemanggil sama saja dengan tidak ada gerbang.
- **Limit transaksi/bulan sengaja TIDAK ikut** ke lapis 3 — sifatnya per-bulan-kalender dan butuh aritmetika tanggal WIB, bukan hitungan kardinalitas. Tetap klien-saja untuk sekarang; ini TODO terbuka, bukan keputusan bahwa itu tidak perlu.
- **Policy INSERT keempat tabel tidak dipersempit.** Build klien lama masih `.insert()` langsung (alasan varian B `20260917000000`), jadi lapis 3 baru menggerbangi jalur resmi. Menutup jalur langsung adalah migrasi terpisah setelah build lama habis.

Detail teknis (kenapa bukan RLS, kenapa yang dikunci baris `user_subscriptions`): `teknis_arsitektur-database.md` → "RPC Gerbang Limit Tier".

---

### 1.19 Hotfix: Timestamp "Dibuat pada" di Bukti Hutang Pakai UTC, Bukan WIB (16 September 2026)

**Bug:** `debtProof.js` memakai `new Date().toISOString().slice(0, 10)` untuk label "Dibuat pada" di PDF bukti hutang — satu-satunya titik di `src/` yang memakai UTC alih-alih pola lokal-WIB yang dipakai konsisten di tempat lain (`dateToISO()` di `transactions.jsx`, `localISO()` di `useNotifications.js`). Generate PDF jam 00:00-06:59 WIB mencetak tanggal mundur 1 hari.

**Fix:** ganti ke ekspresi getter lokal inline (pola yang sama, tidak ada helper baru diimpor/dibuat).

---

## 2. Hal yang Diketahui Belum Sempurna / TODO

### 2.1 Kolom `spent` dan `enabled` di Tabel `budgets` Tidak Dipakai

Kolom ini ada di database tapi tidak digunakan oleh kode aplikasi. Potensi kebingungan bagi developer baru.

### 2.2 Playwright Dipakai, tapi Belum Punya Runner

Sejak 13-14 Sep 2026 `playwright` dipakai nyata oleh `tests/*.harness.mjs` (menjalankan hook asli di browser dengan Supabase distub) dan `tests/shared-wallet-sync.spec.mjs` (e2e dua akun). Tiap file dijalankan manual via `node <file>` — belum ada `playwright.config`, npm script, maupun CI.

### 2.3 Belum Ada Form Edit Goal

Hanya Add/Delete/Deposit Goal. Goal lama yang dibuat sebelum migration `20260701000000` akan punya `deadline_date = NULL` selamanya sampai fitur edit dibuat.

### 2.4 Label "Dompet" di Filter Analitik

Key i18n baru `analitik.semuaDompet`, `analitik.belumAdaTransaksiDompet`, `analitik.dataTerlaluSedikit`. Perlu dipastikan tidak ada halaman lain yang butuh key serupa.

### 2.5 Sidebar Desktop & Responsive Container Queries (Added 18 Juli 2026)

**Implementasi baru:**
- Sidebar fixed 240px muncul hanya di ≥750px (desktop/tablet)
- BottomNav tetap dimount di semua breakpoint; visibility dikontrol CSS
- TopBar sekarang conditional — hanya render di halaman Beranda (active === "dashboard")
- `useContainerWidth` hook baru untuk measure `.main-content` width — dipakai TopBar, Transaksi, Budgets, Analytics
- Container queries (@container) di `.main-content` — responsive layouts berdasarkan actual container width bukan viewport
- Modal sticky footer untuk tombol action — tetap visible saat scroll
- 750-767px overlap zone: mobile !important rules mungkin menang — acceptable karena zona transitional

**Verifikasi manual diperlukan:**
- Sidebar tidak mengganggu TopBar notification panel (position:fixed descendants tetap works)
- Modal tidak covered oleh Sidebar di web ≥750px
- Compact layouts di Transaksi/Budgets/Analytics proper di 760px threshold (container queries)
- Mobile <750px TIDAK terpengaruh sama sekali (bottom nav, modal behavior, layout — semuanya sama)

---

## 3. Infrastruktur & Layanan Eksternal

### Email Infrastructure

- **Provider:** Resend (region Tokyo)
- **Domain:** `finance-app.pro` (terdaftar via Hostinger)
- **Status:** ✅ SELESAI dan terverifikasi berfungsi (sejak 25 Juni 2026)
- Email konfirmasi registrasi dari `team@finance-app.pro` dengan branding terbaru
- Redirect setelah verifikasi → `newbeboys.github.io` (GitHub Pages, halaman `email-confirmed.html`)
- Email reset password menggunakan OTP 6 digit (kustomisasi template Supabase)
- **Sebelumnya** memakai email default Supabase (`noreply@mail.app.supabase.io`) — sejak Sept 2024 Supabase membatasi hanya ke anggota organisasi sendiri. Custom SMTP (Resend) membuka blocker ini.

### Domain & DNS

- **Domain utama:** `finance-app.pro` — dikelola via Hostinger
- **Digunakan untuk:** Email infrastruktur (Resend), custom domain untuk web app, rencana custom URL scheme/App Links

### Web App Deployment (Vercel — Added 19 Juli 2026)

- **Platform:** Vercel (auto-deploy from GitHub push to main)
- **Project:** FinanceApp web repo terhubung ke Vercel dashboard
- **URL Production:**
  - Default Vercel URL: `finance-app-one-dun.vercel.app`
  - Custom domain: `app.finance-app.pro` (sudah valid dan aktif)
- **DNS Records di Hostinger:**
  - **A record (@)** → `216.198.79.1` (untuk root domain `finance-app.pro`, pointing ke Vercel infrastructure)
  - **CNAME record (app)** → Vercel DNS value (untuk subdomain `app.finance-app.pro`, pointing ke Vercel)
- **Auto-deploy:** Setiap push ke branch `main` di GitHub → Vercel otomatis build & deploy (no manual steps)
- **Build command:** `npm run build` (dari `package.json`)
- **Status:** ✅ Live dan accessible sejak 19 Juli 2026

### Hosting Halaman Statis

- **GitHub Pages:** `newbeboys.github.io` — hosting untuk halaman pendukung:
  - Halaman konfirmasi email (`email-confirmed.html`)
  - Legal documents: Privacy Policy & Terms of Service di `newbeboys.github.io/financeapp-legal`

### Akun-Akun Penting (referensi identitas, bukan kredensial)

| Akun Email | Fungsi |
|---|---|
| `jangkahadevv@gmail.com` | Akun developer Play Console (publik) |
| `reviewfinance32@gmail.com` | Demo account untuk tim review Google — set Pro permanen via SQL (expires_at +10 tahun, bukan NULL) |
| `demofimance@gmail.com` | Akun testing pribadi developer (penulisan "fimance" sengaja, bukan typo) |
| `support@finance-app.pro` | Email support user-facing (sebelumnya `financeappsupport@gmail.com`, sudah dimigrasikan ke semua touchpoint) |

### CI/CD & Build

- **Platform:** GitHub Actions, workflow `.github/workflows/build-apk.yml`
- **Build command:** `bundleRelease` (AAB untuk Play Store, bukan APK biasa)
- **Keystore signing:**
  - File: `financeapp-release.keystore`, alias `financeapp-key`
  - Disimpan 4 GitHub Repository Secrets: `KEYALIAS`, `KEYPASSWORD`, `KEYSTOREBASE64`, `KEYSTOREPASSWORD`
  - Generated via `keytool` dari Android Studio JBR (path: `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`)
  - Workflow: decode base64 keystore → `bundleRelease` → cleanup
- **SHA-256 certificate fingerprint:** sudah diekstrak, disubmit ke Play Console

### Supabase Project

- **Project URL:** `https://ykyzgaztfbvwsjdcdpwk.supabase.co`
- **Region:** `ap-south-1` — South Asia (Mumbai, India)
  *(dikonfirmasi dari Supabase Dashboard pada 30 Juni 2026)*

### Google Play Console

- **Package name:** `com.Financeapp.app`
- **Kebijakan baru:** Akun developer dibuat SETELAH Nov 2023 → WAJIB Closed Testing minimal 12 tester aktif selama 14 hari berturut-turut sebelum Production Access
- **Verifikasi developer Android:** Sudah diselesaikan — nama paket terdaftar & terverifikasi dengan SHA-256 certificate fingerprint

---

## 4. Status & Posisi Project Saat Ini (per 18 Juli 2026)

### Yang SUDAH Selesai ✅

**Infrastruktur & Build:**
- ✅ Keystore signing release dibuat & disimpan aman (GitHub Secrets)
- ✅ GitHub Actions workflow untuk build AAB (`bundleRelease`) berfungsi
- ✅ AAB pertama berhasil di-build & diupload ke Internal Testing track
- ✅ Tester list "intern testing" dibuat di Play Console
- ✅ Custom SMTP (Resend + domain finance-app.pro) — selesai & terverifikasi
- ✅ Verifikasi developer Android — selesai

**Fitur Aplikasi Inti:**
- ✅ Seluruh fitur inti (auth, catat transaksi, dompet, kategori, budget, goals, analitik, laporan, notifikasi, Money IQ, dark/light, tema font, PIN/biometrik, recurring, widget, scan struk OCR, hutang/piutang)
- ✅ Filter dompet di Analitik + preview/download laporan
- ✅ Logo aplikasi baru (geometric "FA") ke seluruh aset (icon, splash, laporan, email)
- ✅ Label UI "Akun" → "Dompet" di seluruh aplikasi
- ✅ Lupa password dengan OTP 6 digit
- ✅ Migrasi support email ke `support@finance-app.pro` di semua touchpoint
- ✅ Data Safety form di Play Console
- ✅ Store Listing Play Console (deskripsi, screenshot, icon)
- ✅ Dua akun demo (set Pro permanen via SQL)

**Pembaruan 29 Juni – 6 Juli 2026:**
- ✅ Google Play Billing + RevenueCat — kode SELESAI
- ✅ Supabase Edge Function `revenuecat-webhook` — menerima & proses event RC
- ✅ Kolom RevenueCat di `user_subscriptions` — migration `20260629000000` selesai
- ✅ Celah keamanan RLS ditutup — migration `20260630000001` selesai
- ✅ `EditCategoryModal` & `setPlanForTesting` migrasi ke RPC — migration `20260630000002` selesai
- ✅ Bug `txForAccount` di `wallets.jsx` diperbaiki
- ✅ Privacy Policy & Terms of Service direvisi (RevenueCat, region, billing cycle)
- ✅ Semua perubahan di-commit & di-push (branch main sinkron origin/main)

**Pembaruan 1 Juli – 9 Juli 2026:**
- ✅ `MonthYearPicker` reusable component baru (4 lokasi: CashflowCard, SpendingCard, TransactionsPage, AnalyticsPage)
- ✅ CashflowCard & SpendingCard (beranda) — filter bulan upgrade
- ✅ TransactionsPage — filter bulan + KPI dinamis + performa (tidak render seluruh history)
- ✅ Fix kategori custom di `AccountTxSheet`
- ✅ Modal konfirmasi hapus dompet + UX baru (tombol + dropdown di heading)
- ✅ Filter bulan Analitik diganti `MonthYearPicker`
- ✅ Deadline date picker & goal sorting (migration `20260701000000` dijalankan)
- ✅ `RecurringTransactionForm` — dropdown pilih dompet
- ✅ Version bump ke 2.6.0

**Pembaruan 6 Juli 2026:**
- ✅ Sistem error logging terpusat (tabel `error_logs` + RPC `log_error()` + helper `errorLogger.js`)
- ✅ Diintegrasikan ke 11 titik: adjustBalance, debts (create/delete), recurringHelper, revenuecat-webhook, auth-signup, auth-reset-password (×2), auth-verify-otp, financial-chat
- ✅ Peringatan cooldown hutang/piutang jadi tier-aware (`!isPro`)
- ✅ Semua file di-commit & di-push

**Pembaruan 9 Juli 2026:**
- ✅ Product Tour 10 halaman dibangun (ProductTour, TransaksiTour, SavingsTour, BudgetsTour, AnalitikTour, HutangPiutangTour, LaporanTour, DompetTour, PengaturanTour, RecurringTour)
- ✅ `scrollSettle.js` helper dibuat (smooth scroll + debounce settle)
- ✅ I18n 115 key baru (id/en)
- ✅ CSS baru untuk tour styling
- ✅ Commit `9734834` 36 file diubah

**Pembaruan 11–12 Juli 2026:**
- ✅ Money IQ Chatbot selesai & di-deploy
- ✅ Perbaikan Level 2 Guardrail: perkuat system prompt classification + 8 few-shot examples
- ✅ Perbaikan Intent Parser: deteksi income-vs-expense comparison + route ke `type: "general"` + `fetchSummary()` untuk KEDUA side + rasio
- ✅ Dokumentasi section 4.18 Money IQ Chatbot ditambah

**Pembaruan 16 Juli 2026:**
- ✅ Rate limiter per-user (8 req/min) dengan atomic SELECT FOR UPDATE
- ✅ Fix user_id kosong di logServerError() — captured from JWT
- ✅ Periode berjalan detection (range.end === todayStr) + lead line dengan CATATAN eksplisit
- ✅ Truncation handling untuk wantsTotal (header eksplisit, prompt rule ATURAN TOTAL)
- ✅ Migration `20260716000000_add_chat_rate_limits.sql` ditambah ke migrations/

**Pembaruan 18 Juli 2026:**
- ✅ Sidebar desktop/tablet (fixed 240px, ≥750px only) + 9 nav items
- ✅ TopBar conditional render — hanya di halaman Beranda (active === "dashboard")
- ✅ `useContainerWidth` hook baru (ResizeObserver, CONTENT_COMPACT_MAX=760, TOPBAR_COMPACT_MAX=900)
- ✅ Container queries (@container main-content) untuk responsive layouts berdasarkan actual container width
- ✅ Responsive perbaikan: TopBar, Transaksi, Budgets, Analytics compact layouts di 760px container threshold
- ✅ Modal sticky footer (position: sticky) + backdrop centering untuk mencegah Sidebar overlap di web ≥750px
- ✅ Mobile <750px TIDAK terpengaruh — BottomNav, modal UX, semua layout tetap sama
- ✅ Dokumentasi teknis diperbarui (4 file): struktur folder, responsive section, TopBar conditional, TODO list, changelog

**Pembaruan 16 Juli 2026:**
- ✅ Rate limiter per-user (8 req/min) dengan atomic SELECT FOR UPDATE
- ✅ Fix user_id kosong di logServerError() — now captured from JWT
- ✅ Periode berjalan detection (range.end === todayStr) + lead line dengan CATATAN eksplisit
- ✅ Truncation handling untuk wantsTotal (header eksplisit, prompt rule ATURAN TOTAL)
- ✅ Migration `20260716000000_add_chat_rate_limits.sql` ditambah ke migrations/
- ✅ Test hasil 5/5 SEMPURNA untuk "total pengeluaranku bulan ini berapa"

---

### Yang SEDANG/BELUM Selesai ⏳

**Status per 15 Sep 2026 — sudah SELESAI dan live (bukan lagi item terbuka):**
- ✅ **Bug saldo realtime** — saldo dompet kini ditarik absolut lewat `syncBalances()` setelah tiap RPC tulis, plus channel `wallets` yang sudah hidup kembali. Tidak lagi bergantung pada realtime saja.
- ✅ **Daftar anggota** — `wallet_members` masuk publication `supabase_realtime`, channel `wallets_lock`/`wallet_members_sheet` hidup lagi.
- ✅ **Kunci hutang (`is_locked`)** — `debts` masuk publication, channel `debts:<uid>` hidup lagi; kolom `is_locked` diformalkan lewat migration `20260920000000`.
- ✅ **Penguncian saat downgrade sudah diukur, bukan diasumsikan** — kebocoran praktis nol pada kondisi terukur (1 dompet, akun tes).
- ✅ **Penguncian downgrade tidak pernah jalan (15 Sep 2026)** — akar masalahnya (kolom `is_locked` hanya terisi kalau ada tab yang kebetulan menyaksikan transisi plan) ditutup dengan memindahkan sumber kebenaran ke hasil hitung di klien, `src/lib/lockStatus.js`. Kolom DB dibiarkan apa adanya sebagai legacy. Detail & aturan turunannya di §1.17.
- ✅ **`checkCreateAllowed()` gagal-terbuka (15 Sep 2026)** — kedua query cooldown di `useDebts.js` (COUNT rolling-window + SELECT baris tertua) ditukar dari fail-open/senyap jadi fail-closed + `logError()` ke `error_logs`. Aman diubah ke fail-closed karena Pro tidak pernah menyentuh query ini (`maxActiveDebts = Infinity` return duluan) — risiko fail-closed murni menyentuh user Basic yang masih punya sisa kuota tapi errornya transien, bukan user berbayar. UI (`AddDebtModal.jsx`) dapat cabang pesan baru (`debts.error.quotaCheckFailed`) supaya error transien ini tidak jatuh ke pesan cooldown yang menyesatkan (menyiratkan ada tanggal "boleh lagi").

**Masih terbuka (diketahui, belum diperbaiki):**
- ⏳ **Tidak ada gerbang server untuk `is_locked`** — penguncian downgrade sepenuhnya ditegakkan di klien (`planReconciliation.js` + gating UI). Tidak ada policy RLS atau constraint yang menolak tulisan ke baris terkunci, jadi pemanggilan langsung dari console masih bisa menembusnya.

**Launch Blocker — WAJIB selesai sebelum Production:**

**✅ CRITICAL SECURITY (RESOLVED 11 Sep 2026) — REVOKE EXECUTE ON FUNCTION set_plan_for_testing SUDAH DIEKSEKUSI**

⚠️ **RISIKO KRITIS:** Siapapun user yang login saat ini bisa memanggil RPC `set_plan_for_testing()` lewat browser console untuk upgrade diri sendiri ke Pro gratis secara permanen. Contoh:
```javascript
supabase.rpc('set_plan_for_testing', { p_user_id: '...', p_plan: 'pro', p_expires_at: '2099-12-31T23:59:59Z' })
```

**Kenapa guard `import.meta.env.DEV` di JS tidak cukup:**
- Guard di level JavaScript hanya melindungi dari akses UI normal
- RPC adalah entitas database terpisah — tidak terikat pada flag build Vite
- Setiap authenticated user bisa bypass build guard via browser console & call RPC langsung

**FIX — WAJIB dieksekusi di SQL Editor Supabase sebelum submit Production:**
```sql
REVOKE EXECUTE ON FUNCTION public.set_plan_for_testing(uuid, text, timestamptz, text) FROM authenticated;
```

**Update status:** SQL fix di atas dituliskan (dalam bentuk lebih lengkap — revoke dari `authenticated, anon, public` sekaligus) di migration `supabase/migrations/20260723010000_harden_functions_search_path_and_grants.sql` (bagian 4), dan **migration ini sudah dieksekusi/push ke Supabase** — diverifikasi 11 Sep 2026 lewat `list_migrations` dan pengecekan langsung `pg_proc` (`set_plan_for_testing` execute kini hanya `service_role`). Lihat bagian 1.12 untuk detail.

**Verifikasi:** Sudah dilakukan 11 Sep 2026 — lihat `teknis_arsitektur-database.md` bagian "Function Security Hardening".

**Timeline:** Selesai sebelum submit Play Store production — blocker ini closed.

---

**Closed Testing & Production Access:**

1. **Closed Testing 14 hari dengan minimal 12 tester aktif BELUM DIMULAI** — WAJIB karena akun developer dibuat setelah Nov 2023. Countdown 14 hari baru berjalan setelah Closed Testing track aktif dengan tester terpenuhi berkelanjutan.

2. **Production Access belum bisa diajukan** — bergantung pada selesainya Closed Testing 14 hari di atas.

**Pre-Production Checklist (warning, aman untuk testing track):**

3. **`minifyEnabled` masih `false`** — sebelum production pertimbangkan diaktifkan + setup ProGuard rules + testing menyeluruh, upload mapping/deobfuscation file ke Play Console.

4. **Native debug symbols belum diupload** — diperlukan sebelum Production track untuk debugging native crash report.

**Setup Monetisasi (bergantung pada Production Access):**

5. **Subscription products sudah dibuat di Play Console** ✅ — Produk `pro_subscription` dengan 3 base plan aktif:
    - `monthly` — Rp 30.000/bulan (auto-renew)
    - `semi-annual` — Rp 140.000/6 bulan (auto-renew)
    - `annual` — Rp 270.000/tahun (auto-renew)

    RevenueCat sudah dikonfigurasi penuh:
    - Entitlement: `pro`
    - Offering: `default`
    - 3 package mapping: `$rc_weekly` → monthly | `$rc_monthly` → semi-annual | `$rc_annual` → annual
    - Ketiga produk sudah di-import dari Play Console ke RevenueCat; entitlement `pro` sudah terhubung ke ketiga produk Android

**Item yang perlu verifikasi:**

6. ⏳ **Migration `20260706000000` (error_logs) sudah dijalankan di Supabase SQL Editor?**
   - RPC `log_error()` tidak akan tersedia sampai migration dieksekusi
   - Belum ada test manual end-to-end (trigger error → cek di error_logs)

7. ⏳ **Migration `20260716000000` (chat_rate_limits) sudah dijalankan?**
   - RPC `check_chat_rate_limit()` tidak akan tersedia sampai migration dieksekusi
   - Sudah tested via manual request throttling, tapi perlu verifikasi di production database

8. ✅ **3 migration (23 Juli 2026) — SUDAH di-push/dieksekusi**, diverifikasi 11 Sep 2026 (`20260723010000`/`20260723020000`) & 15/20 Sep 2026 (`20260723000000`, via `migration list`):
   - `20260723000000_document_user_summary_view.sql` — dokumentasi resmi view `user_summary` (fix Security Advisor sudah jalan manual di SQL Editor sebelumnya; migration ini untuk histori)
   - `20260723010000_harden_functions_search_path_and_grants.sql` — fix search_path mutable + revoke/grant execute beberapa fungsi, **termasuk fix blocker kritis `set_plan_for_testing`** (lihat item 0 di section 5 & bagian "CRITICAL SECURITY" — closed)
   - `20260723020000_revoke_rls_auto_enable_execute.sql` — hygiene revoke execute `rls_auto_enable`

---

## 5. Roadmap Selanjutnya

### Urutan Prioritas Immediate (sebelum bisa submit Production)

**🔴 PALING URGENT — Eksekusi ASAP (sebelum semua aktivitas lain):**

0. **REVOKE EXECUTE ON FUNCTION set_plan_for_testing() di Supabase**
   - Lihat penjelasan detail di section "Yang SEDANG/BELUM Selesai" → "CRITICAL SECURITY"
   - SQL yang dijalankan: `REVOKE EXECUTE ON FUNCTION public.set_plan_for_testing(...) FROM authenticated;`
   - Test verifikasi: browser console RPC call → harus permission denied
   - **Status:** ✅ SUDAH DIEKSEKUSI (diverifikasi 11 Sep 2026) — closed

---

1. **Verifikasi migration sudah dijalankan:**
   - ✅ `20260629000000` (RevenueCat fields) — EXECUTED
   - ✅ `20260630000001` (secure RLS) — EXECUTED
   - ✅ `20260630000002` (set_plan_for_testing RPC) — EXECUTED
   - ✅ `20260701000000` (deadline_date to savings) — EXECUTED
   - ✅ `20260704000000` (add_debts) — EXECUTED (status terverifikasi)
   - ✅ `20260705000000` (add_is_locked to debts) — EXECUTED (status terverifikasi)
   - ⏳ `20260706000000` (add_error_logs) — BELUM DIKONFIRMASI, perlu verifikasi di SQL Editor
   - ⏳ `20260716000000` (add_chat_rate_limits) — BELUM DIKONFIRMASI, perlu verifikasi di SQL Editor
   - ✅ `20260717000000` (add_chat_unanswered_log) — EXECUTED (dikonfirmasi dari kode financial-chat/index.ts yang insert ke tabel ini di production)
   - ✅ `20260902000000` (add_cash_disbursed_flag_to_debts) — EXECUTED
   - ✅ `20260903000000` (add_icon_to_custom_categories) — EXECUTED
   - ✅ `20260723000000` (document_user_summary_view) — EXECUTED (diverifikasi 15/20 Sep 2026)
   - ✅ `20260723010000` (harden_functions_search_path_and_grants) — EXECUTED (diverifikasi 11 Sep 2026). **Berisi fix blocker kritis `set_plan_for_testing` (lihat item 0 di atas, closed)**
   - ✅ `20260723020000` (revoke_rls_auto_enable_execute) — EXECUTED (diverifikasi 11 Sep 2026)
   - ✅ `20260920000000` (document_is_locked_columns) — EXECUTED (15 Sep 2026)

2. **Mulai Closed Testing 14 hari**
   - Rekrut/konfirmasi minimal 12 tester aktif berkelanjutan
   - Mulai countdown clock secepatnya (blocker dengan durasi tetap)

3. **Setelah Closed Testing selesai:** Apply Production Access (estimasi review Google ~7 hari)

4. **Setelah Production Access terbuka:**
   - Build final dengan `minifyEnabled: true` + ProGuard
   - Verifikasi native debug symbols
   - Submit untuk review production

### Backlog Post-Launch (SETELAH app live di Play Store)

**Kategori: Fitur Baru**
- **OS push notification** (Capacitor local-notifications + background scheduling) — saat ini semua notifikasi (recurring, reminder tagihan, weekly summary) hanya in-app
- **Pengingat Tagihan yang lebih akurat** — saat ini heuristik kategori; backlog: derive due date dari recurring transaction + reminder H-N hari sebelum jatuh tempo
- **Form Edit Goal** — currently hanya Add/Delete/Deposit
- **Integrasi bank API** (opsional, skala besar) — auto-sync transaksi dari bank

**Kategori: Dompet Bersama (Fitur B)**
- **Task 4 WAJIB — blokir/guard hapus dompet bersama yang masih punya anggota aktif.** `transactions.wallet_id` punya FK `ON DELETE CASCADE` ke `wallets`, jadi owner yang menghapus dompet bersama saat ini akan ikut menghapus transaksi member **tanpa persetujuan mereka**. Bertabrakan dengan keputusan produk "transaksi member tetap ada setelah dia keluar". Perlu guard di UI, atau ubah FK jadi `RESTRICT`.

**Kategori: Peningkatan Kualitas**
- **Playwright test suite** — harness manual sudah ada (`tests/*.harness.mjs`), tapi belum ada config/npm script/CI yang menjalankannya otomatis
- **CI/CD untuk SQL migrations** — automated testing sebelum production push
- **Multi-device sync notifikasi** — saat ini localStorage tidak sinkron antar device
- **Optimize bundle size** — app sekarang agak besar untuk build Vite

---

## 📝 Changelog Teknis

### Versi 2.6.0 → 2.8.0 (12 Juli – 15 September 2026)

| Tanggal | Perubahan | Status | Verified |
|---------|-----------|--------|----------|
| 29 Juni | Migration RevenueCat fields | ✅ Executed | Boss Ali |
| 30 Juni | Migration RLS security fix + RPC set_plan_for_testing | ✅ Executed | Boss Ali |
| 1 Juli | Migration deadline_date to savings | ✅ Executed | Boss Ali |
| 1 Juli | Commit: Fix txForAccount + RLS updates | ✅ Pushed | Boss Ali |
| 1-2 Juli | MonthYearPicker component (4 lokasi), CashflowCard/SpendingCard/TransactionsPage/AnalyticsPage upgrade | ✅ Pushed | newbeboys |
| 1 Juli | TransactionsPage filter bulan + KPI + filter dompet | ✅ Pushed | newbeboys |
| 1 Juli | Fix kategori custom di AccountTxSheet | ✅ Pushed | newbeboys |
| 1 Juli | Modal hapus dompet + UX baru (dropdown) | ✅ Pushed | newbeboys |
| 5 Juli | Commit `313a604`: Recurring transaction form — pilihan dompet eksplisit | ✅ Pushed | newbeboys |
| 6 Juli | Commit `7e42a7c`: Version bump 2.6.0 + peringatan cooldown jadi tier-aware | ✅ Pushed | newbeboys |
| 6 Juli | Commit `ca6a2e1`: Sistem error logging terpusat (tabel error_logs + RPC log_error + helper) | ✅ Pushed | newbeboys |
| 6 Juli | Migration `20260706000000_add_error_logs.sql` ditambah | ✅ Committed | Claude Code |
| 9 Juli | Commit `9734834`: Product Tour 10 halaman + scrollSettle helper | ✅ Pushed | newbeboys |
| 11 Juli | Money IQ Chatbot deployed (Groq LLM, 3-level guardrail, intent parser, query builder) | ✅ Deployed | Boss Ali |
| 12 Juli | Perbaikan L2 Guardrail: 8 few-shot examples, system prompt lebih tegas | ✅ Deployed | Claude Code |
| 12 Juli | Perbaikan Intent Parser: deteksi income-vs-expense comparison (kalimat "rincikan pemasukan vs pengeluaranku" sekarang bekerja) | ✅ Deployed | Claude Code |
| 16 Juli | Rate limiter per-user (8 req/min), atomic SELECT FOR UPDATE | ✅ Committed | Claude Code |
| 16 Juli | Fix user_id kosong di logServerError() — captured from JWT | ✅ Committed | Claude Code |
| 16 Juli | Periode berjalan detection + lead line dengan CATATAN eksplisit (fix "sampai sekarang" di periode sudah selesai) | ✅ Committed | Claude Code |
| 16 Juli | Truncation handling untuk wantsTotal (header eksplisit, prompt rule ATURAN TOTAL) | ✅ Committed | Claude Code |
| 16 Juli | Migration `20260716000000_add_chat_rate_limits.sql` ditambah | ✅ Committed | Claude Code |
| 17 Juli | Dokumentasi teknis dibagi 4 file (pengenalan, arsitektur-database, fitur-tier, keputusan-infrastruktur-roadmap) | ✅ Completed | Claude Code |
| 18 Juli | Sidebar desktop/tablet (≥750px) + TopBar conditional (Beranda only) | ✅ Implemented | Claude Code |
| 18 Juli | useContainerWidth hook + container queries @container main-content + responsive layouts (TopBar, Transaksi, Budgets, Analytics) | ✅ Implemented | Claude Code |
| 18 Juli | Modal sticky footer fix + Sidebar overlap prevention (web ≥750px) | ✅ Implemented | Claude Code |
| 18 Juli | Dokumentasi teknis diperbarui: struktur folder, responsive design section (arsitektur-database.md), TopBar conditional (fitur-tier.md), TODO list (keputusan-infrastruktur-roadmap.md) | ✅ Completed | Claude Code |
| 22 Juli | Grep investigasi codebase: view `user_summary` dikonfirmasi TIDAK dipanggil kode aplikasi manapun (murni referensi admin) | ✅ Completed | Claude Code |
| 23 Juli | Migration `20260723000000_document_user_summary_view.sql` dibuat — dokumentasi resmi view `user_summary` (security_invoker=on, revoke anon/authenticated) | ✅ Executed (diverifikasi 15/20 Sep) | Claude Code |
| 23 Juli | Migration `20260723010000_harden_functions_search_path_and_grants.sql` dibuat — fix search_path mutable, revoke/grant execute beberapa RPC, **fix blocker kritis `set_plan_for_testing`** | ✅ Executed (diverifikasi 11 Sep) | Claude Code |
| 23 Juli | Migration `20260723020000_revoke_rls_auto_enable_execute.sql` dibuat — hygiene revoke execute event trigger function | ✅ Executed (diverifikasi 11 Sep) | Claude Code |
| 23 Juli | Dokumentasi teknis diperbarui (arsitektur-database.md, keputusan-infrastruktur-roadmap.md, fitur-dan-tier.md) untuk mencatat investigasi & 3 migration baru di atas | ✅ Completed | Claude Code |
| 8 Sep | Migrasi i18n klaster 1–3 (Hutang/Piutang, Paywall & Subscription, modal Kategori) di branch `chore/i18n-full-migration` | ✅ Pushed | Claude Code |
| 9 Sep | **Klaster 4** — konten laporan: `reports.jsx` (buildPayload, buildReportDoc, downloadPdf, ExcelPreviewRenderer) + `report-excel.js` (nama sheet, header kolom, judul chart). Tanggal & nama bulan ikut bahasa UI | ✅ Committed | Claude Code |
| 9 Sep | `src/lib/budgetSpent.js` — util bersama `resolveBudgetCategoryId`/`getBudgetSpent`, menggantikan 3 kalkulator "terpakai" lokal (budgets-page, BudgetsCard, useNotifications) | ✅ Committed | Claude Code |
| 9 Sep | Migration `20260909000000_add_wallet_id_to_budgets.sql` dibuat — kolom `budgets.wallet_id` (FK wallets, ON DELETE SET NULL, NULL = semua dompet) | ✅ Executed | Boss Ali |
| 9 Sep | Anggaran per dompet: filter dompet di halaman Anggaran + selector Dompet di AddBudgetModal (keduanya hanya bila >1 dompet → Pro-only implisit), baris gabungan untuk kategori multi-dompet, `isCategoryBlocked()` | ✅ Committed | Claude Code |
| 9 Sep | Fix: `groupedRows` di budgets-page.jsx kehilangan kategori yang anggaran generalnya ≥2 (data lama sebelum wallet-scoping) saat difilter ke dompet spesifik — cocok persis dulu, baru fallback ke anggaran general dalam grup yang sama | ✅ Committed | Claude Code |
| 9 Sep | Keputusan §1.13: **single-currency final** — nominal selalu `Rp`/`id-ID` di semua bahasa. Rencana awal ganti "Rp"→"IDR" saat English DIBATALKAN | ✅ Documented | Boss Ali |
| 9 Sep | **Klaster 5** — label kategori & tipe dompet bawaan disambungkan ke resolver yang sudah ada (`analytics.jsx` 4 titik, `charts.jsx` donut, `reports.jsx` `catLabelOf()`, `wallets.jsx` `typeLabelI18n()`). `data.jsx` 0 perubahan | ✅ Committed | Claude Code |
| 9 Sep | Fix: key `beranda.wawasanAiProDesc` dipanggil kode tapi tidak ada di kedua locale (selalu fallback Indonesia) + CTA Money IQ hardcode → ditambahkan/diterjemahkan | ✅ Committed | Claude Code |
| 9 Sep | Verifikasi Excel: workbook ID & EN dibuka di Microsoft Excel (COM), `CalculateFullRebuild` + edit baris data → SUMIFS lintas-sheet tetap benar, 0 sel error di kedua bahasa | ✅ Verified | Claude Code |
| 2 Sep | Migration `20260902000000_add_cash_disbursed_flag_to_debts.sql` → kolom `debts.cash_disbursed_at_creation` (boolean, DEFAULT true), hanya bermakna type='receivable'. false = tagihan belum dibayar (skip transaksi pokok sampai pembayaran pertama). | ✅ Executed | Boss Ali |
| 3 Sep | Migration `20260903000000_add_icon_to_custom_categories.sql` → kolom `custom_categories.icon` (text, DEFAULT 'other'), icon picker di CategoryField/EditCategoryModal (cooldown 30 hari sama nama/warna). | ✅ Executed | Boss Ali |
| 14–15 Sep | Hotfix realtime dompet (4 commit, merge `e71dc41`): channel `wallets` & `wallet_members` dipisah + suffix topic unik, callback status + pendengar `system` di channel dompet, saldo ditarik **absolut** setelah RPC tulis (tidak lagi mengandalkan realtime saja), kegagalan channel dicatat ke `error_logs` dengan rem per sesi | ✅ Pushed | Claude Code |
| 15 Sep | `ALTER PUBLICATION supabase_realtime ADD TABLE wallet_members` — fix channel `wallets_lock`/`wallet_members_sheet` yang mati; RLS diverifikasi tetap berlaku (akun-B non-anggota tidak menerima frame) | ✅ Executed | Claude Code |
| 15 Sep | `ALTER PUBLICATION supabase_realtime ADD TABLE debts` — fix channel `debts:<uid>` yang mati. Publication `supabase_realtime` kini berisi **8 tabel** | ✅ Executed | Claude Code |
| 15 Sep | Migration `20260920000000_document_is_locked_columns.sql` — dokumentasi resmi kolom `is_locked` di `wallets`/`savings`/`custom_categories` (sudah ada di production sejak lama, menutup schema drift) | ✅ Executed | Claude Code |
| 15 Sep | Commit `27acaee`: kegagalan SELECT/UPDATE di `planReconciliation.js` dicatat ke `error_logs` (severity `high`) — sebelumnya gagal senyap total | ✅ Pushed | Claude Code |
| 15 Sep | Merge `b89e717`: **Task 5 Fase 1** masuk `main` — refetch foreground `useTransactions` (debounce 60 dtk + gerbang PIN/biometrik) + tombol "Segarkan" manual di halaman Transaksi | ✅ Pushed | Claude Code |
| 15 Sep | Fix bug #5: `checkCreateAllowed()` (`useDebts.js`) fail-open → fail-closed + `logError()` untuk dua query cooldown hutang/piutang; pesan UI baru `debts.error.quotaCheckFailed` (id/en) supaya error transien tidak jatuh ke pesan cooldown yang menyesatkan | ✅ Committed | Claude Code |
| 15 Sep | Fix bug #4 (§1.17): status terkunci DIHITUNG lewat `src/lib/lockStatus.js` (+ harness `tests/lockStatus.harness.mjs`, 20/20), bukan dibaca kolom `is_locked`. 4 hook disentuh (`useDebts`/`useSavings`/`useCustomCategories`/`useWallets`); konsumen UI 0 perubahan; kolom DB & `planReconciliation.js` dibiarkan sebagai legacy | ✅ Committed | Claude Code |
| 16 Sep | Fix bug #6 (§1.18) — **SELESAI**, menutup keluarga #4/#5/#6: migrasi `20260921000000_add_tier_limit_rpcs.sql` (4 RPC `SECURITY DEFINER` cek-kuota+INSERT atomik) + dry-run `tests/dryrun_20260921_tier_limit_rpc.sql` (28 uji) + 4 hook create dialihkan ke `.rpc()`. Precheck klien dipertahankan (gerbang jadi dua lapis: klien UX, server penegakan) | ⏳ Belum di-push / belum dijalankan | Claude Code |
| 19 Sep | **Timezone Batch 0** (branch `refactor/date-helpers-batch0`, refactor murni, nol perubahan perilaku, tanpa migration/DB): fungsi baru `monthPrefixISO(d)` di `dateLocal.js` menggantikan 11 pola "YYYY-MM" manual (`analytics.jsx` 4, `widgets.jsx` 3, `useNotifications.js` 3, `budgetSpent.js` 1); `debtProof.js` memakai `todayISO()` dan `toISO` di `recurringHelper.js` menjadi alias `dateToISO` (membalik keputusan PR #8 yang membiarkannya lokal) | ⏳ Commit lokal, belum push | Claude Code (build + harness); tes manual lolos (Boss Ali, 8 area) |
| 19 Sep | **Timezone Batch 1** (branch `refactor/timezone-batch1`, tanpa migration/DB): `useSubscription` meng-expose `timezone` (kolom `user_subscriptions.timezone` dari PR #11, akhirnya dipakai), helper baru `hourInTimezone(tz)` di `src/utils/userTimezone.js`, dan 7 lokasi label kosmetik (TopBar tanggal + sapaan, `KpiCards` monthName, `buildInsights` monthName, `BudgetsCard`, `TransactionsPage`, `BudgetsPage`) dialihkan ke timezone tersimpan, bukan jam perangkat. `transactions.jsx` field `time` SENGAJA tidak disentuh (write path, domain Batch 6/7). Juga: koreksi CLAUDE.md — daftar harness kurang menyebut `tests/lockStatus.harness.mjs` (20 tes) | ⏳ Commit lokal (branch `refactor/timezone-batch1`), belum push. Tes manual LOLOS (Boss Ali) — kondisi normal tak berubah, jam sistem diubah ke Eastern Time, sapaan/tanggal tetap konsisten dengan WIB tersimpan | Claude Code (build + 4 harness, 70/70); tes manual (Boss Ali) |

### Versi-Versi Sebelumnya
- v2.5.6 (1 Juli): Deadline date picker & goal sorting
- v2.5.5 (30 Juni): RevenueCat + RLS security implementation
- v2.5.0+ (28 Juni): Dokumentasi teknis dibuat
- v1.2.0 (sebelumnya): Fitur inti (auth, transaksi, dompet, budget, goals, dll)

---

*Dokumen ini adalah bagian 4 dari 4 — referensi silang ke 3 dokumen lain: `teknis_pengenalan-aplikasi.md`, `teknis_arsitektur-database.md`, `teknis_fitur-dan-tier.md`.*
