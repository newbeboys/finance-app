# FinanceApp — Keputusan Arsitektur, Infrastruktur, & Roadmap

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-18 | **Versi App:** 2.6.0  
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

| RPC Function | Tujuan | Dipanggil dari |
|---|---|---|
| `update_category_edit_cooldown(p_user_id)` | Update `last_custom_category_edit_at` | `EditCategoryModal.jsx` |
| `set_plan_for_testing(p_user_id, p_plan, ...)` | Ubah plan untuk testing (DEV only) | `useSubscription.js → setPlanForTesting` |
| `check_chat_rate_limit(p_max_requests, p_window_seconds)` | Cek & update rate limit chatbot | `index.ts (financial-chat)` |
| `log_error(p_source, p_message, p_metadata, p_severity)` | Catat error ke error_logs | `errorLogger.js` (client-side logging) |

Kolom sensitif (`plan`, `expires_at`, RC fields) **hanya bisa diupdate** oleh Edge Function `revenuecat-webhook` via `service_role` (bypass RLS).

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

## 2. Hal yang Diketahui Belum Sempurna / TODO

### 2.1 Kolom `spent` dan `enabled` di Tabel `budgets` Tidak Dipakai

Kolom ini ada di database tapi tidak digunakan oleh kode aplikasi. Potensi kebingungan bagi developer baru.

### 2.2 Playwright Ada tapi Tidak Jelas Dipakai

`playwright` ada di `devDependencies` tapi tidak ada konfigurasi test atau file test yang ditemukan. Kemungkinan dipakai untuk testing manual atau belum diimplementasikan sepenuhnya.

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

**Launch Blocker — WAJIB selesai sebelum Production:**

**🔴 CRITICAL SECURITY — REVOKE EXECUTE ON FUNCTION set_plan_for_testing BELUM DIEKSEKUSI**

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

**Verifikasi:** Setelah REVOKE, test di browser console → RPC call harus return permission denied error (42501).

**Timeline:** WAJIB sebelum submit ke Play Store production — tidak bisa ditunda.

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

---

## 5. Roadmap Selanjutnya

### Urutan Prioritas Immediate (sebelum bisa submit Production)

**🔴 PALING URGENT — Eksekusi ASAP (sebelum semua aktivitas lain):**

0. **REVOKE EXECUTE ON FUNCTION set_plan_for_testing() di Supabase**
   - Lihat penjelasan detail di section "Yang SEDANG/BELUM Selesai" → "CRITICAL SECURITY"
   - SQL yang dijalankan: `REVOKE EXECUTE ON FUNCTION public.set_plan_for_testing(...) FROM authenticated;`
   - Test verifikasi: browser console RPC call → harus permission denied
   - **Status:** ❌ BELUM DIEKSEKUSI — WAJIB sebelum production

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

**Kategori: Peningkatan Kualitas**
- **Playwright test suite** — `playwright` ada di devDeps tapi tidak dikonfigurasi
- **CI/CD untuk SQL migrations** — automated testing sebelum production push
- **Multi-device sync notifikasi** — saat ini localStorage tidak sinkron antar device
- **Optimize bundle size** — app sekarang agak besar untuk build Vite

---

## 📝 Changelog Teknis

### Versi 2.6.0 (12 Juli – 17 Juli 2026)

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

### Versi-Versi Sebelumnya
- v2.5.6 (1 Juli): Deadline date picker & goal sorting
- v2.5.5 (30 Juni): RevenueCat + RLS security implementation
- v2.5.0+ (28 Juni): Dokumentasi teknis dibuat
- v1.2.0 (sebelumnya): Fitur inti (auth, transaksi, dompet, budget, goals, dll)

---

*Dokumen ini adalah bagian 4 dari 4 — referensi silang ke 3 dokumen lain: `teknis_pengenalan-aplikasi.md`, `teknis_arsitektur-database.md`, `teknis_fitur-dan-tier.md`.*
