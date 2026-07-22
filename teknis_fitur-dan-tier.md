# FinanceApp — Fitur-Fitur Aplikasi & Sistem Tier

> **Dibuat:** 2026-06-28 | **Terakhir diperbarui:** 2026-07-18 | **Versi App:** 2.6.0  
> **Tujuan:** Dokumentasi lengkap semua fitur, tier system, dan gating mechanism.

---

## 1. Authentication

**Login** (`src/pages/Login.jsx`)
- Email + password via `supabase.auth.signInWithPassword()`
- Setelah sukses: `validateUserStillExists()` validasi user belum dihapus backend
- Jika tidak valid: `logoutDeletedUser()` → clear session

**Register** (`src/pages/Register.jsx`)
- Input: Nama, Email, Password (min 6 karakter)
- `supabase.auth.signUp()` dengan `options.data.full_name`
- Email verifikasi dikirim; redirect: `https://newbeboys.github.io/financeapp-email-verification/email-confirmed.html`
- Setelah register: `showOnboarding = true` → `OnboardingScreen`

**Lupa Password** (`src/pages/ForgotPassword.jsx`)
- **4 langkah:**
  1. Input email → `supabase.auth.resetPasswordForEmail()`
  2. Input OTP 6 digit → `supabase.auth.verifyOtp()`
  3. Input password baru (min 6 char, confirm match) → `supabase.auth.updateUser()`
  4. Sukses → redirect login (3 detik auto)
- Tombol "Kirim Ulang OTP" dengan cooldown 60 detik

**Gerbang Keamanan Saat Buka App**
```
PIN aktif?
  ├─ ya → Tampilkan PinLock → Verifikasi → Splash 3 detik → Konten
  └─ tidak →
     Biometrik aktif?
       ├─ ya → Tampilkan BiometricLock → Verifikasi → Splash → Konten
       └─ tidak → Langsung Splash 3 detik → Konten
```

---

## 2. Catat Transaksi

**Lokasi kode:** `src/transactions.jsx` (modal) + `src/hooks/useTransactions.js` (Supabase ops)

| Field | Wajib | Keterangan |
|---|---|---|
| Tipe | Ya | Toggle Pengeluaran / Pemasukan |
| Jumlah | Ya | Numerik format Rupiah |
| Merchant | Tidak | Nama toko/pembayar |
| Kategori | Ya | Dropdown bawaan + kustom |
| Dompet | Ya* | Dropdown dompet (*wajib jika user punya dompet) |
| Metode | Ya | Toggle Tunai / Transfer |
| Catatan | Tidak | Teks bebas |
| Tanggal | Ya | Date picker (lokal, bukan UTC) |
| Berulang | Tidak | Checkbox |

**Saat simpan:**
1. Data → Supabase via `useTransactions.createTransaction`
2. Jika ada `wallet_id` → `adjustBalance(wallet_id, amount)`
3. Edit: saldo lama di-reverse, saldo baru diupdate
4. Hapus: saldo di-reverse

**Scan Struk** (Pro only)
- Kamera Android via Capacitor Camera plugin
- OCR offline via `MlkitOcr` (plugin native custom)
- Hasil diparse `src/lib/strukParser.js` → prefill form
- Di web: tidak tersedia (`Capacitor.isNativePlatform()` guard)

**Batas:** Basic = 75 transaksi/bulan kalender (by tanggal transaksi, bukan `created_at`)

### Halaman Transaksi Lengkap

- **File:** `src/transactions-page.jsx`
- **Akses:** Menu "Transaksi" → halaman full history
- **Filter Bulan:** Tombol "Pilih Bulan" → `MonthYearPicker`; default: bulan sekarang
- **KPI Dinamis:** 3 kartu (Pemasukan | Pengeluaran | Selisih) update otomatis saat bulan berubah
- **List:** Transaksi bulan dipilih, grouped per tanggal lokal
- **Empty State:** "Belum ada transaksi di bulan ini"
- **Filter lain tetap aktif:** Search, type, kategori, metode, dompet — semua AND logic
- **Benefit:** Tidak scroll panjang (max ~5–30 tx/bulan vs seluruh historis)

**Filter Dompet (added 9 Juli 2026):**
- State lokal `selectedWalletId` (default `"all"`)
- useEffect fallback ke `"all"` kalau dompet yang dipilih sudah dihapus
- Dropdown muncul hanya jika `accounts.length > 1` (reuse pattern dari AnalyticsPage)
- Pipeline filter: dompet AND bulan AND type AND kategori AND metode AND search (semua sekaligus)

---

## 3. Dompet (Wallets)

**Lokasi kode:** `src/wallets.jsx` (UI) + `src/hooks/useWallets.js` (logika)

**Tipe:** Rekening Bank, E-Wallet, Tunai, Investasi

**Cara kerja saldo:**
- Saldo **TIDAK** dihitung dari transaksi (bukan reconciliation otomatis)
- Diupdate via `adjustBalance(walletId, delta)` saat transaksi dibuat/diedit/dihapus
- `adjustBalance` baca saldo dari state React (sudah realtime), hitung `newBalance = current + delta`, tulis Supabase
- **Keterbatasan:** Transaksi lama (sebelum `wallet_id` ditambah) tidak punya `wallet_id`, jadi saldo tidak terpengaruh

**Fungsi `txForAccount`:**
```javascript
t.wallet_id === account.id ||
(t.wallet_id == null && account.primary === true)
// Transaksi tanpa wallet_id (lama) anggap milik dompet primary
```

### Hapus Dompet Dengan Warning Cascade Delete

- **Tombol:** "🗑️ Hapus Dompet" (terra/merah) di heading
- **Status:** Disabled jika cuma 1 dompet
- **UX:** Klik dropdown → pilih dompet → `WalletDeleteConfirmation` (bottom sheet)
  - Tampilkan: `⚠️ [X transaksi] terhubung akan hilang selamanya`
  - Tombol "Hapus Selamanya" → cascade delete via FK `wallet_id ON DELETE CASCADE`
- **Safety:** Guard hanya = `accounts.length > 1` (semua dompet bisa dihapus, termasuk primary)

### Fix: Kategori Custom di Detail Dompet

- **Sebelumnya:** Bottom sheet detail dompet lookup hanya `ALL_CATEGORIES` → UUID kategori kustom tidak dikenali
- **Sekarang:** `customCategories` prop diteruskan `app.jsx` → `WalletsPage` → `AccountTxSheet`
- **Resolve:** `resolveCategory(t.category, customCategories)` dari `category-field.jsx`
- **Label:** `categoryLabel(cat, tr)` (tr = alias rename dari `useTranslation()` agar tidak di-shadow oleh `t` = transaction object)
- **Result:** Kategori custom tampil nama & warna benar

**Batas:** Basic = 1, Pro = unlimited

**Downgrade Pro → Basic:** Dompet 2+ (urut `created_at` ASC) dapat `is_locked = true`

---

## 4. Kategori Kustom

**Lokasi kode:** `src/hooks/useCustomCategories.js` + `src/category-field.jsx`

- Tipe: Pengeluaran atau Pemasukan (terpisah)
- Warna: 8 preset saat pembuatan
- Nama: unik per user (case-insensitive); duplikat → return kategori yang sudah ada
- Soft delete: `is_deleted = true`, tidak pernah hard delete

**Cooldown edit (Basic only):** 30 hari setelah edit nama/warna. Pro tidak ada cooldown.

**Batas:** Basic = 3 aktif, Pro = unlimited

---

## 5. Anggaran (Budget)

**Lokasi kode:** `src/budgets-page.jsx` + `src/hooks/useBudgets.js`

**Cara kerja:**
- Budget **TERHUBUNG OTOMATIS READ-ONLY ke transaksi**
- Kolom `spent` di DB **tidak dipakai**
- Saat UI render, `spent` dihitung real-time dari array transaksi yang di-load
- Formula: `spent = sum(|amount|)` untuk semua tx `category === budget.categoryId` dalam periode aktif
- Mencatat tx pengeluaran di kategori tertentu **otomatis menambah progress**
- **Tidak ada** menarik uang dari budget (budget = pelacak saja, bukan rekening)

**Periode:** UI punya toggle Bulanan/Mingguan, tapi DB **tidak ada kolom periode** — hanya di client

**Notifikasi:**
- 80% terpakai → peringatan
- 100%+ → over-budget

**Batas:** Basic = 7, Pro = unlimited

---

## 6. Tabungan / Goals

**Lokasi kode:** `src/savings-page.jsx` + `src/hooks/useSavings.js`

**Cara kerja:**
- Goals **MANUAL** — tidak ada koneksi otomatis ke transaksi
- `current` hanya berubah saat user eksplisit deposit via tombol "Tambah Dana"
- Deposit bisa quick buttons (+100K, +500K, +1M, +2.5M) atau input manual

**Fitur:**
- 10 ikon pilihan (star, emergency, travel, home, vehicle, education, gadget, gift, health, ring)
- 8 warna preset
- Deadline: date picker (reuse dari `transactions.jsx`) → hasil simpan sebagai label ringkas ("Jan 2026") di `deadline_label` ATAU ISO date di `deadline_date`
- Tombol "Bersihkan" → "Tanpa tenggat"
- **Sorting otomatis (client-side):** Goal dengan `deadlineDate` terdekat paling atas; NULL di bawah. Dihitung ulang tiap render, bukan query Supabase
- **Animasi celebrasi** (`GoalCompleteOverlay`) saat goal 100% (hanya jika Sound/Animasi aktif)

**Batas:** Basic = 2, Pro = unlimited

**Catatan:** Belum ada form Edit Goal — goal lama (sebelum migration `20260701000000`) akan punya `deadline_date = NULL` sampai fitur edit dibuat.

---

## 7. Dashboard — CashflowCard & SpendingCard

**Lokasi kode:** `src/widgets.jsx` + `src/app.jsx` (render di tab Beranda)

**TopBar (Beranda only — Added 18 Juli 2026):**
- TopBar hanya ditampilkan saat active tab = "dashboard" (halaman Beranda)
- Semua halaman lain (Transaksi, Tabungan, Anggaran, Analitik, Laporan, Dompet, Hutang/Piutang, Pengaturan) **tidak menampilkan TopBar** — konten mulai langsung dari paling atas
- Conditional render di `app.jsx`: `{active === "dashboard" && <TopBar ... />}`
- Applies to web (≥750px) dan mobile (<750px) sama-sama

**CashflowCard — Arus Kas Pemasukan vs Pengeluaran**
- Toggle "1M / 6M / 1Y" → tampilkan rentang
- Tombol "Pilih Bulan" → `MonthYearPicker`; scope auto ke "1 Bulan"
- Sebelumnya: bottom sheet custom; sekarang: `MonthYearPicker` (konsisten)
- Grafik: bar chart income vs expense; daily mode (1M) atau monthly mode (6M/1Y)

**SpendingCard — Rincian Pengeluaran Per Kategori**
- Tombol "Pilih Bulan" → `MonthYearPicker`; default: bulan sekarang
- Sebelumnya: bottom sheet custom; sekarang: `MonthYearPicker`
- Donut chart: komposisi pengeluaran per kategori bulan terpilih
- Tabel: top-N kategori dengan nominal + persen + progress bar mini
- Data: filter `dateRaw` dengan prefix `YYYY-MM` bulan terpilih

---

## 8. Analitik

**Lokasi kode:** `src/analytics.jsx`

**Komponen:**
1. Filter tanggal — toggle "1 Tahun" (12 bulan lalu) atau "1 Bulan" (via `MonthYearPicker`)
2. Filter dompet — dropdown "Semua Dompet" + individual; **HANYA tampil jika `accounts.length > 1`**
3. Stat strip — 4 kartu (pemasukan, pengeluaran, selisih, rata-rata/bulan atau /hari)
4. Bar chart — income vs expense per hari (mode bulan) atau per bulan (mode tahun)
5. Donut + tabel — komposisi income per kategori
6. Donut + tabel — komposisi expense per kategori
7. Money IQ — insight rule-based (dengan threshold sparse data)
8. WeeklySummaryCard — ringkasan minggu lalu

**Filter dompet & tanggal AND logic:**
- Semua kalkulasi dijalankan pada `filteredByWallet` (sudah filter dompet)
- `txInScope` = subset filter tanggal juga → dipakai threshold Money IQ

**Money IQ threshold:** `txInScope.length < 5` → tampilkan "Data terlalu sedikit..." (bukan insight)

**Empty state khusus dompet:** Dompet dipilih + `txInScope.length === 0` → kartu empty state, sembunyikan grafik & Money IQ. WeeklySummaryCard tetap tampil.

**Edge case:** Dompet dihapus → `useEffect` deteksi, fallback ke "Semua Dompet"

---

## 9. Laporan PDF & Excel

**Lokasi kode:** `src/reports.jsx` (1192 baris)

- **PDF:** `html2canvas` (screenshot DOM) → `jsPDF`. Multi-halaman, header berulang, page-break optimization
- **Excel:** `ExcelJS` — sheet terpisah per detail transaksi
- **Android:** Simpan ke filesystem via Capacitor, dialog share native
- **Fitur:** Filter dompet (all vs spesifik), laporan bulanan/tahunan, resolve label kategori kustom, pie + bar chart

**Tier:** Export = Pro only (`reportsExportEnabled`)

---

## 10. Notifikasi

**Lokasi kode:** `src/hooks/useNotifications.js`

**Penyimpanan:** `localStorage` — **BUKAN push notification OS**. Hanya tampil saat app terbuka.

| Tipe | Trigger | Preferensi |
|---|---|---|
| **Budget** | Pengeluaran 80% atau 100%+ limit | `notif.budget` |
| **Income** | Setiap transaksi pemasukan | `notif.income` |
| **Weekly** | Hari Senin — ringkasan minggu lalu | `notif.weekly` |
| **Bills** | Bulan lalu ada "tagihan" tapi bulan ini belum | `notif.bills` |

**Retensi:**
- Max 50 notifikasi
- Dibaca + usia > 5 hari di-purge otomatis
- Belum dibaca TIDAK pernah di-purge

**Audio:** Volume 0.5, hanya saat dokumen visible

---

## 11. Money IQ (InsightsCard)

**Lokasi kode:** `src/widgets.jsx` (fungsi `buildInsights`)

**Jenis:** Rule-based (bukan ML/LLM), contoh:
- Perbandingan kategori vs bulan lalu
- Deteksi kategori terbesar
- Saran berhemat dari tren

**Di halaman Analitik:** Dihitung dari `txInScope` (filter dompet + tanggal). Threshold 5 transaksi berlaku.

**Tier:** Pro only (`aiInsightsEnabled`)

---

## 12. Dark/Light Mode & Tema Font

**Mode gelap/terang:**
- Toggle di TopBar & SettingsPage
- CSS class `dark` di `document.documentElement`
- Semua warna via CSS variables (`--ink`, `--cream`, `--paper`, dll)
- Disimpan localStorage key `finance_tweaks`

**Palette warna latar (light mode only):**
| Nama | CSS `--cream` |
|---|---|
| Cream (default) | `#EAE5D5` |
| Sand | `#E6DECB` |
| Mist | `#E4E7E0` |
| Bone | `#EFEBDF` |

**Tema font (5 pilihan):**
| ID | Nama | Font | Tier |
|---|---|---|---|
| `modern-tech` | Modern Tech | Geist | Basic + Pro |
| `soft-friendly` | Soft & Friendly | DM Sans | Basic + Pro |
| `pro-finance` | Professional Finance | Plus Jakarta Sans | Pro only |
| `elegant` | Elegant Classic | Raleway | Pro only |
| `luxury` | Luxury Fintech | Manrope | Pro only |

**Auto-reset saat downgrade:** Pro user dengan tema Pro lalu downgrade → auto-reset ke `modern-tech`

---

## 13. PIN & Biometrik

**Lokasi kode:** `src/lib/pin.js` + `src/components/PinLock.jsx` + `src/components/BiometricLock.jsx`

**PIN:**
- Hash: SHA-256 + random salt (ada migrasi otomatis dari btoa lama ke SHA-256)
- Disimpan: `appPIN` (hash), `appPIN_salt` (base64), `pinAktif` (boolean) — localStorage
- **Saling eksklusif** dengan biometrik (mengaktifkan satu → nonaktifkan lain)

**Biometrik:**
- Plugin: `@aparajita/capacitor-biometric-auth` v10.0.0
- Flag: `biometrikAktif` di localStorage
- **Hanya Android native** — web fallback ke PIN atau tanpa keamanan
- Gagal total → `handleBiometricEscape()` → reset keamanan → paksa login ulang

**Auto-lock:** `useAutoLock` hook — saat app masuk background lalu kembali foreground, tampilkan gerbang keamanan lagi

---

## 14. Transaksi Berulang

**Lokasi kode:** `src/lib/recurringHelper.js` + `src/components/RecurringTransactionForm.jsx` + `src/pages/RecurringTransactionPage.jsx`

**Penyimpanan:** localStorage key `recurringTransactions` (array JSON) — **BUKAN Supabase**

**Frekuensi:** `mingguan`, `bulanan` (1-28), `tahunan`

**Auto-eksekusi:**
1. Saat app dibuka, `checkRecurringTransactions(createTransaction)` dipanggil sekali per sesi
2. Cek schedule yang jatuh tempo sejak terakhir eksekusi
3. Transaksi dibuat otomatis dengan prefix `[Otomatis] `
4. Max 60 eksekusi per schedule (catch-up protection)
5. Stop jika `createTransaction` gagal atau `limitReached` (kuota Basic penuh)

**Pemilihan dompet (updated 5 Juli 2026):**
- Setiap schedule sekarang simpan `wallet_id` (nullable)
- Form: dropdown muncul hanya jika `accounts.length > 1`, auto-pakai 1 dompet kalau cuma 1, disembunyikan kalau 0
- Eksekusi otomatis (`resolveWalletId`): schedule.wallet_id (kalau valid) → primary → pertama → skip + warning
- Tampilan list: "Dompet: `<nama>`" atau "Dompet: Otomatis" (italic/muted) kalau fallback

**Tier:** Pro only (`recurringTransactionsEnabled`)

---

## 15. Widget Android Home Screen

**Lokasi kode:** `src/lib/widgetSync.js`

**Data disinkronkan:**
- Total pemasukan & pengeluaran bulan ini (short format)
- Saldo bersih
- % penggunaan anggaran
- 3 transaksi terakhir
- Karakter animasi (celebrate/panic/worried/happy)

**Implementasi:** Via plugin custom `WidgetBridge` (native Android). No-op di web.

**Launch dari widget:** Tap tombol "Catat Transaksi" → `consumeWidgetLaunchAction()` deteksi action `add_tx` → modal tambah transaksi terbuka

---

## 16. Product Tour — Panduan Interaktif 10 Halaman

**Status:** ✅ Selesai & di-commit 9 Juli 2026 (commit `9734834`)

**Lokasi kode:** `src/components/` (10 tour components) + `src/lib/scrollSettle.js`

**10 komponen tour:**

| Halaman | File | Akses dari | Deskripsi |
|---------|---|---|---|
| 1. Beranda | ProductTour.jsx | Home tab | Dashboard overview, KPI, tombol utama |
| 2. Transaksi | TransaksiTour.jsx | Menu Transaksi | Form, filter, history |
| 3. Tabungan | SavingsTour.jsx | Menu Tabungan | Goals, progress, deposit |
| 4. Anggaran | BudgetsTour.jsx | Menu Anggaran | Budget cards, progress, kategori |
| 5. Analitik | AnalitikTour.jsx | Menu Analitik | Filter scope, chart, Money IQ |
| 6. Hutang & Piutang | HutangPiutangTour.jsx | Menu Hutang/Piutang | Tab Piutang/Hutang/Lunas, cicilan |
| 7. Laporan | LaporanTour.jsx | Menu Laporan | Export PDF/Excel, filter, preview |
| 8. Dompet | DompetTour.jsx | Menu Dompet | Daftar dompet, saldo, aksi |
| 9. Pengaturan | PengaturanTour.jsx | Menu Pengaturan | Tema, PIN/Biometrik, upgrade, data |
| 10. Recurring | RecurringTour.jsx | RecurringTransactionPage | List jadwal, form, frekuensi |

**Helper `scrollSettle.js`:**
- Fungsi: `scrollIntoViewAndSettle(element, offset = 80)` — smooth scroll + settle sebelum next step
- Digunakan semua 10 komponen untuk sinkronisasi visual focus

**Cara kerja:**
- Render per-step (satu elemen highlight per waktu)
- Cutout effect: overlay gelap + transparent box elemen yang dijelaskan
- Tombol: "Sebelumnya", "Selanjutnya", "Lewati"
- State localStorage: `tourDismissed_{halaman}`
- Tampil pertama kali saat user buka halaman

**I18n:** 115 key baru di `locales/id/translation.json` + `locales/en/translation.json`

**CSS:** `.tour-overlay`, `.tour-cutout`, `.tour-step-text`

---

## 17. Hutang & Piutang (Debts)

**Status:** ✅ Sudah live, tersedia Basic & Pro (dengan limit berbeda)

**Lokasi kode:** `src/debts-page.jsx` + `src/hooks/useDebts.js` + `src/components/debts/`

**Konsep:**
- `type = 'receivable'` → Piutang (uang orang lain ke kamu)
- `type = 'payable'` → Hutang (uang kamu ke orang lain)
- `amount` selalu positif; arah via type
- Membuat catatan → otomatis 1 transaksi + `adjustBalance` ke dompet
- Tiap cicilan (`addPayment`) → 1 transaksi + baris `debt_payments`
- Transaksi ber-`debt_id` **dikecualikan** dari kuota 75 Basic
- 3 tab: Piutang, Hutang, Lunas

**Limit Basic — 2 syarat sekaligus** (di `checkCreateAllowed()`):
1. Max 5 catatan aktif (hutang + piutang, `status = 'active'`, `is_deleted = false`)
2. Max 5 pembuatan per 50 hari rolling (dihitung `created_at` semua baris, termasuk yang sudah lunas/soft-deleted) — cegah akal-akalan hapus-buat-ulang
   - UI tampilkan tanggal kapan bisa membuat lagi + tombol upgrade Pro

**⚠️ Penting:** Cooldown 50 hari hanya menggerbangi **pembuatan**, bukan penghapusan. `deleteDebt()` tidak memanggil `checkCreateAllowed()` sama sekali.

**Peringatan cooldown saat hapus (`DebtDetailSheet.jsx`)** — updated 6 Juli 2026:
- Dialog konfirmasi hapus selalu tampilkan baris netral: "Hapus catatan ini? Transaksi terkait akan dihapus dan saldo dikoreksi balik."
- Baris peringatan cooldown ("⚠️ Membatalkan hutang ini tidak membebaskan kuota cooldown...") **hanya jika `!isPro`**
- Prop `isPro` diteruskan `app.jsx` → `DebtsPage` → `DebtDetailSheet`

**Lock saat downgrade:** Catatan aktif > 5 dapat `is_locked = true` (5 paling lama tetap aktif, sama pola wallets/savings)

**Hapus (soft delete):** Set `is_deleted = true` → hapus semua transaksi tertaut → koreksi saldo dompet balik

**Dompet dihapus:** Catatan tetap ada; `wallet_id` → `NULL` (FK `ON DELETE SET NULL`)

---

## 18. Sistem Error Logging Terpusat

**Status:** ✅ Dibangun 6 Juli 2026, di-commit, sudah di-push

**Lokasi kode:** `src/lib/errorLogger.js` (client helper) + `supabase/migrations/20260706000000_add_error_logs.sql`

**Tujuan:** Catat error yang melibatkan **uang atau data permanen** (bukan error UI seperti toggle tema)

**Client helper:** `logError(source, message, metadata, severity)`
- Panggil RPC `log_error(...)` via Supabase (bukan INSERT langsung)
- Dibungkus try-catch penuh — kegagalan menulis jatuh ke `console.error`, tidak pernah lempar ke pemanggil
- `severity` dinormalisasi `'high'` atau `'medium'` (default `'medium'`)

**Keamanan:** 
- User tidak punya INSERT langsung ke `error_logs`
- Jalur tulis client: RPC `log_error()` SECURITY DEFINER (user_id otomatis dari JWT)
- Sisi server (Edge Function): langsung via `service_role`
- RLS SELECT: hanya baris milik sendiri

**Titik integrasi yang sudah dipasang:**

| Source | Lokasi | Severity | Trigger |
|---|---|---|---|
| `adjustBalance` | useWallets.js | high | Update saldo gagal |
| `debts` | useDebts.js | high | adjustBalance pasca-insert catatan baru gagal |
| `debts` | useDebts.js | high | Reversal saldo saat hapus gagal |
| `recurringHelper` | recurringHelper.js | high | createTransaction gagal saat eksekusi jadwal |
| `revenuecat-webhook` | Edge Function | medium/high | JSON tidak valid / update user_subscriptions gagal |
| `auth-signup` | Register.jsx | high | supabase.auth.signUp() gagal |
| `auth-reset-password` | ForgotPassword.jsx | high | resetPasswordForEmail() gagal |
| `auth-verify-otp` | ForgotPassword.jsx | medium | verifyOtp() gagal |
| `financial-chat` | Edge Function | medium | Groq query / Supabase fetch gagal |

**Status implementation:**
- ✅ Semua file terkait di-commit (commit `ca6a2e1`, 6 Juli 2026) & di-push
- ⏳ Migration `20260706000000` belum dikonfirmasi dijalankan di Supabase SQL Editor
- ⏳ Belum ada test manual end-to-end

**SQL query audit:**
```sql
-- Error severity 'high' dalam 24 jam terakhir
SELECT created_at, source, message, metadata, user_id
FROM public.error_logs
WHERE severity = 'high' AND created_at >= now() - interval '24 hours'
ORDER BY created_at DESC;
```

---

## 19. Money IQ Chatbot — AI Assistant Finansial Interaktif

**Status:** ✅ Selesai & di-deploy 12 Juli 2026

**Arsitektur:** Edge Function `/financial-chat` (Groq LLM) + React UI overlay frontend

### Backend — Supabase Edge Function `financial-chat`

**File:** `supabase/functions/financial-chat/` (7 file)
- `types.ts` — ChatRequest, ChatResponse, ParsedIntent, Classification interface
- `guardrail.ts` — Level 1 (keyword filter, ~20 keyword hardcoded) + Level 2 wrapper (call Groq classification)
- `intent-parser.ts` — parse natural language → ParsedIntent (rule-based, bukan LLM). Deteksi: tipe (expense/income/budget/savings/investment/general/debt), periode (today/yesterday/this_month/last_month/this_year), bulan eksplisit, kategori, order, limit, perbandingan income-vs-expense
- `query-builder.ts` — build SQL dari ParsedIntent + user_id → fetch Supabase → format jadi "data context" string. Handle tanggal WIB, agregasi, periode berjalan detection, truncation untuk wantsTotal
- `groq-client.ts` — wrapper Groq API dengan 2 model. Classification + answering. Few-shot examples untuk classification (8 pair).
- `index.ts` — main orchestration: CORS, JWT auth, 3-level pipeline, rate limit check, error handling
- `deno.json` — dependencies

**3-Level Guardrail Pipeline:**
```
User Question
    │
    ├─ L1: Keyword Filter (instan)
    │   └─ ~20 keyword → blok instan
    │
    ├─ L2: Groq Classification (1-2 detik)
    │   └─ FINANCIAL vs OUT_OF_SCOPE? + 8 few-shot examples
    │      Fail-open: ragu? default FINANCIAL
    │
    └─ L3: Query + Answering (3-5 detik)
        ├─ Parse intent (rule-based)
        ├─ Fetch Supabase (RLS, autentikasi user)
        └─ Send ke model answering + return jawaban natural language
```

**Sistem penanggalan:** Tabel `transactions.date` adalah date lokal (YYYY-MM-DD). Query builder hitung rentang tanggal dalam kalender WIB (offset +7 dari UTC). "Bulan ini" untuk user di WIB = YYYY-MM (1 s/d hari sekarang).

**Handling Income vs Expense (perbaikan 12 Juli):**
- Deteksi kalimat perbandingan via `isIncomeExpenseComparison(q)`
- Route ke `type: "general"` → `fetchSummary()` untuk ambil KEDUA side + rasio
- Data context: `Total pemasukan: Rp...\nTotal pengeluaran: Rp...\nRasio: ...%`

**Periode berjalan detection (perbaikan 12 Juli):**
- Jika `range.end === todayStr` → periode masih berjalan
- Lead line ke context dengan CATATAN eksplisit:
  - PERIODE BERJALAN: boleh pakai "sampai sekarang"
  - SUDAH SELESAI: jawab sebagai periode tuntas, DILARANG "sampai sekarang"
- Prompt rule: temperature=0 untuk wantsTotal (deterministic), temperature=0.3 untuk percakapan normal

**Truncation handling (perbaikan 12 Juli):**
- Saat wantsTotal + rows > 10, tampilkan 10 transaksi sebagai contoh
- Header eksplisit: "Total ... (rincian hanya menampilkan 10 sebagai contoh — total SUDAH mencakup seluruh 30 transaksi)"
- Prompt instruksi: ATURAN TOTAL (wajib jawab total kalau "Total ..." ada di DATA)

**Rate limit per-user (added 16 Juli 2026):**
- 8 request/min per user (fail-open: kalau RPC gagal, let through)
- Cek atomik via RPC `check_chat_rate_limit()` SECURITY DEFINER
- Status 200 (bukan 429) dengan `source:"rate_limit"` supaya pesan friendly ditampilkan

### Frontend — React Integration

**File baru:** `src/components/MoneyIQChat.jsx` — MoneyIQChatProvider + useMoneyIQ() hook + MoneyIQChatPage overlay

**File ubah:**
- `src/widgets.jsx` — `buildInsights()` tambah `kind` + `data` field; `InsightsCard` tambah onClick
- `src/main.jsx` — wrap `<App>` dengan `<MoneyIQChatProvider>`
- Locales — key `insight.tanyaMoneyIq` + section `moneyIqChat` (9 keys)

**UI Chat:**
- Full-screen overlay (position:fixed, z-index:1200)
- Header: back button + title + emoji ✨
- Message history: user bubbles (ink bg), assistant bubbles (card style)
- Input: textarea + send button (disabled kosong/sedang mengirim)
- Loading: "Money IQ sedang mengetik…"
- Error: "Terjadi error. Coba lagi…" (terra bg)

**Pro-only gating:**
- Free user: 🔒 + "Pro" badge + deskripsi → klik openPaywall
- Pro user: kartu normal, tombol "Tanya Money IQ" aktif
- Flow: klik tombol → chat buka dengan starter message sesuai isi kartu

**Starter message dari KPI Card:**
- Pengeluaran terbesar: "Kategori X (Y%). Rincikan pengeluaran X-ku dong."
- Rasio pendapatan: "Z% pendapatanku terpakai. Rincikan pemasukan vs pengeluaranku ya."
- Ringkasan transaksi: "Aku sudah catat N transaksi bulan ini. Ringkas pengeluaranku dong."

**Few-shot examples (perbaikan L2 guardrail, 12 Juli):**
```
✅ "pengeluaranku bulan ini berapa" → FINANCIAL
✅ "kapan aku belanja terakhir" → FINANCIAL
✅ "beli apa aja kemarin" → FINANCIAL
✅ "pengeluaranku tanggal 7 juli apa saja" → FINANCIAL ← fix false-positive
✅ "berapa aku habisin bulan ini" → FINANCIAL
✅ "uang masuk berapa minggu ini" → FINANCIAL
❌ "berikan saya resep nasi goreng" → OUT_OF_SCOPE
❌ "apa itu cryptocurrency" → OUT_OF_SCOPE
```

**Deployment:**
```bash
supabase functions deploy financial-chat
```
(Sudah di-deploy 11 Juli, update L2 & Intent Parser redeploy 12 Juli)

---

## Sistem Tier (Basic vs Pro)

### Sumber Kebenaran

File `src/lib/planLimits.js` adalah satu-satunya sumber kebenaran untuk semua limit. Tidak ada pengecekan tier yang di-hardcode di komponen.

### Perbandingan Lengkap

| Fitur | Basic | Pro |
|---|---|---|
| **Transaksi per bulan** | 75 | Unlimited |
| **Dompet** | 1 | Unlimited |
| **Goals tabungan** | 2 | Unlimited |
| **Budget** | 7 | Unlimited |
| **Kategori kustom** | 3 | Unlimited |
| **Export laporan** (PDF/Excel) | ❌ | ✅ |
| **Scan struk** (OCR) | ❌ | ✅ |
| **Money IQ** (insights) | ❌ | ✅ |
| **Transaksi berulang** | ❌ | ✅ |
| **Tema font** | 2 dari 5 | Semua 5 |
| **Cooldown edit kategori kustom** | 30 hari | Tidak ada |
| **Catatan Hutang/Piutang aktif** | 5 (+ maks 5 pembuatan/50 hari rolling) | Unlimited, tanpa cooldown |

### Mekanisme Gating

Setiap fitur berbayar dijaga di 2 tempat:
1. **Hook** — CRUD return `{ limitReached: true }` jika melebihi
2. **UI** — tombol tampilkan `LockBadge` atau trigger `PaywallModal`

### Saat Downgrade Pro → Basic

Fungsi `lockExcessOnDowngrade()` (`src/lib/planReconciliation.js`):
- Dompet, goals, kategori kustom yang melebihi limit didapat `is_locked = true`
- Urutan: yang paling baru (`created_at` DESC) dikunci dulu; paling lama tetap aktif
- Data **tidak dihapus** — hanya dikunci. Upgrade kembali ke Pro → semua otomatis unlock

### Filter Dompet di Analitik

Filter dompet **tidak perlu pengecekan tier terpisah** — memiliki >1 dompet sudah memerlukan Pro. Logic gating: dropdown hanya muncul jika `accounts.length > 1`.

### Sistem Billing & RevenueCat Integration — Web Limitation (Added 19 Juli 2026)

**Platform & Billing Support:**
- **Android (Capacitor app):** Google Play Billing via RevenueCat SDK — user bisa beli & subscribe Pro
- **Web app (`app.finance-app.pro` via Vercel):** RevenueCat SDK **tidak berfungsi** — tidak ada cara untuk user membeli Pro di web

**Upgrade CTA di Web:**
- PaywallModal di web menampilkan "Upgrade ke Pro" dengan deskripsi fitur berbayar
- Tombol upgrade di web **disabled / tidak fungsional** atau menampilkan pesan: "Upgrade hanya tersedia di aplikasi Android"
- Alternative link: "Buka di Android" (deep link / instruction) atau manual note: "Gunakan aplikasi Android untuk upgrade"

**Konsekuensi:**
- Web user **hanya bisa akses Basic tier** — tidak ada cara upgrade
- Semua fitur Pro (Money IQ, export, recurring, tema font premium, dll) **tidak tersedia di web**
- Subscription state di database (`user_subscriptions.plan`) tetap reflect app (Android) subscription — jika user Pro di Android, masuk ke web dengan akun yang sama akan masih basic
- Edge case: User Pro di Android → buka web → fitur Pro tidak aktif sampai browser cache subscription state di-load (biasanya instant via realtime, tapi edge case ada)

**Code pattern:**
```javascript
// Di PaywallModal atau fitur-specific gating:
if (Capacitor.isNativePlatform()) {
  // show RevenueCat paywall (Android)
} else {
  // show "upgrade unavailable on web" message
}
```

**Verifikasi & Testing:**
- ✅ PaywallModal menampilkan message yang jujur di web
- ✅ Tombol upgrade di web tidak membuka RevenueCat (akan error jika di-trigger)
- ⏳ Dokumentasi user-facing (Play Store listing, in-app tutorial, FAQ) perlu mention bahwa upgrade hanya di Android

---

## Akurasi & Verifikasi Informasi

### Bagian yang Akurat Langsung dari Kode
- ✅ Semua versi dependency (dari `package.json`)
- ✅ Semua limit Basic vs Pro (dari `src/lib/planLimits.js`)
- ✅ Struktur database (dari hook + file SQL)
- ✅ Cara kerja budget (spent dihitung, bukan disimpan)
- ✅ Cara kerja goals (manual deposit)
- ✅ Format localStorage key & logika auto-lock
- ✅ Cara kerja recurring transactions (localStorage, tidak Supabase)
- ✅ Kapan filter dompet di Analitik muncul (`accounts.length > 1`)
- ✅ URL Supabase & App ID Capacitor
- ✅ Soft delete kategori kustom & alasannya
- ✅ Cooldown 50 hari Hutang/Piutang hanya menggerbangi pembuatan (lihat 17)

### Bagian yang Perlu Konfirmasi Manual
- ⚠️ **Plugin `MlkitOcr`** — plugin native custom untuk OCR (implementasi Android di folder `android/`)
- ⚠️ **Plugin `WidgetBridge`** — custom plugin native untuk widget Android
- ⚠️ **Kapan `OnboardingScreen` ditampilkan ulang** — saat login/register, ada kondisi lain?
- ⚠️ **Rules spesifik `buildInsights`** — isi rule-rule Money IQ tidak diaudit mendetail
- ⚠️ **RC_PACKAGE_MAP di `settings-page.jsx`** — mapping UI plan ID ke RC package (nama tidak mencerminkan periode)
- ⚠️ **Products di Play Console** — produk `pro_subscription` belum dibuat per 1 Juli 2026

---

*Dokumen ini adalah bagian 3 dari 4 — lihat `teknis_keputusan-infrastruktur-roadmap.md` untuk keputusan arsitektur, infrastruktur, dan roadmap.*
