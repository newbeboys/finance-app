# Rangkuman Project FinanceApp

> Versi terakhir: **v1.2.0** | Tanggal dokumen: 14 Juni 2026

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework UI | React 18.3 + Vite 6 |
| Backend / Auth / Database | Supabase (PostgreSQL + Auth) |
| Mobile (Android APK) | Capacitor 8 (`@capacitor/android`) |
| Biometrik | `@aparajita/capacitor-biometric-auth` |
| Animasi | `lottie-react` (Lottie JSON) |
| Laporan | `jsPDF` + `html2canvas` (PDF), `exceljs` (Excel) |
| Status bar Android | `@capacitor/status-bar` |
| Filesystem Android | `@capacitor/filesystem` |
| CI/CD (APK build) | GitHub Actions (Node 22 + Java 21 + Android SDK) |
| Bahasa | JavaScript (ESM), CSS custom properties |

---

## Struktur Folder Project

```
finance apps Ori/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # CI otomatis build APK saat push ke main
├── android/                        # Project Android Capacitor
├── src/
│   ├── app.jsx                     # Root app: auth flow, splash, PIN lock, routing halaman
│   ├── main.jsx                    # Entry point React
│   ├── index.css                   # CSS global + CSS custom properties (tema)
│   ├── data.jsx                    # Kategori bawaan, helper format angka (fmt, fmtShort)
│   ├── supabase.js                 # Inisialisasi Supabase client
│   │
│   ├── pages/
│   │   ├── Login.jsx               # Halaman login (Supabase Auth)
│   │   ├── Register.jsx            # Halaman registrasi
│   │   └── RecurringTransactionPage.jsx  # Halaman kelola transaksi berulang
│   │
│   ├── components/
│   │   ├── BottomNav.jsx           # Navigasi bawah (mobile)
│   │   ├── OnboardingScreen.jsx    # Onboarding 3-slide (Lottie) pasca login/register
│   │   ├── SplashScreen.jsx        # Splash screen animasi (2.5 detik)
│   │   ├── GoalCompleteOverlay.jsx # Overlay perayaan saat target tabungan tercapai
│   │   ├── PinPad.jsx              # Komponen UI numpad PIN
│   │   ├── PinSetup.jsx            # Alur buat / ubah PIN
│   │   ├── PinLock.jsx             # Layar kunci PIN (tampil saat app dibuka)
│   │   └── RecurringTransactionForm.jsx  # Form tambah/ubah jadwal transaksi berulang
│   │
│   ├── hooks/
│   │   ├── useTransactions.js      # CRUD transaksi ↔ Supabase
│   │   ├── useBudgets.js           # CRUD anggaran ↔ Supabase (+ migrasi dari localStorage)
│   │   ├── useSavings.js           # CRUD goals tabungan ↔ Supabase
│   │   ├── useWallets.js           # CRUD dompet/akun ↔ Supabase
│   │   ├── useCustomCategories.js  # Kategori kustom per user ↔ Supabase
│   │   └── useNotifications.js     # Logika notifikasi in-app
│   │
│   ├── lib/
│   │   ├── recurringHelper.js      # Logika transaksi berulang (localStorage + Supabase exec)
│   │   ├── pin.js                  # Simpan/verifikasi PIN (localStorage, hash sederhana)
│   │   ├── biometric.js            # Wrapper biometrik Capacitor
│   │   ├── sound.js                # Helper efek suara
│   │   └── widgetSync.js           # Sinkron data ke Android home-screen widget
│   │
│   ├── assets/
│   │   ├── animation/              # File Lottie JSON (onboarding, goals, kucing tidur)
│   │   │   └── splash-screen.png   # Gambar logo splash
│   │   ├── sound/                  # Efek suara (.mp3/.wav)
│   │   └── widget/                 # Gambar karakter widget (happy/worried/panic/celebrate)
│   │
│   ├── widgets.jsx                 # Kartu-kartu dashboard (KPI, Cashflow, Spending, Insights, dll)
│   ├── transactions.jsx            # Komponen kartu & modal tambah transaksi
│   ├── transactions-page.jsx       # Halaman daftar transaksi + edit/hapus
│   ├── budgets-page.jsx            # Halaman anggaran
│   ├── wallets.jsx                 # Halaman dompet / multi-akun
│   ├── savings-page.jsx            # Halaman goals tabungan
│   ├── analytics.jsx               # Halaman analitik (grafik cashflow, spending)
│   ├── reports.jsx                 # Halaman laporan (HTML→PDF, Excel)
│   ├── settings-page.jsx           # Halaman pengaturan
│   ├── charts.jsx                  # Komponen grafik (bar/line chart SVG murni)
│   ├── topbar.jsx                  # Bar atas: user info, notifikasi, tombol tambah
│   ├── sidebar.jsx                 # Sidebar navigasi (desktop/tablet)
│   ├── category-field.jsx          # Field pilih kategori (bawaan + kustom)
│   ├── icons.jsx                   # Ikon SVG inline
│   ├── tweaks-panel.jsx            # Panel tweak developer (tema, layout, font)
│   ├── report-excel.js             # Generator file Excel dengan exceljs
│   └── use-mobile.js               # Hook deteksi layar mobile
│
├── package.json                    # v1.2.0
└── capacitor.config.ts             # Konfigurasi Capacitor
```

---

## Fitur yang Sudah Selesai

### 1. Autentikasi & Sesi
- Login dan Registrasi via **Supabase Auth** (email + password)
- Sesi persisten; logout membersihkan state onboarding
- Halaman **Onboarding 3-slide** dengan animasi Lottie muncul sekali setelah login/register pertama

### 2. Splash Screen
- Animasi logo drop+bounce → nama app slide-up → tagline fade
- Durasi total 2,5 detik lalu cross-fade ke halaman utama
- Diimplementasikan terakhir (commit `47a11aa`)

### 3. Keamanan Aplikasi (PIN & Biometrik)
- **PIN 6 digit**: diaktifkan dari Pengaturan; hash disimpan di localStorage
- **Layar kunci** muncul otomatis setiap app dibuka jika PIN aktif
- **Biometrik (sidik jari)**: wrapper Capacitor; prompt otomatis saat layar kunci muncul
- Gagal 5× → PIN di-reset dan user diminta login ulang Supabase
- Fitur **Ubah PIN** (verifikasi PIN lama dulu)

### 4. Dashboard (Beranda)
- **KPI Cards**: Total saldo, pemasukan bulan ini, pengeluaran bulan ini, sisa bersih
  - Nominal pendek (`fmtShort`) agar tidak overflow di layar 330px
  - Tombol toggle sembunyikan/tampilkan saldo
- **Cashflow Chart**: Grafik area/bar pemasukan vs pengeluaran (filter 1M/6M/1Y + Pilih Bulan)
- **Spending Chart**: Pie/bar pengeluaran per kategori bulan berjalan
- **Insights Card**: Wawasan AI (analisis pengeluaran, tips, prediksi) — bisa disembunyikan
- **Kartu Transaksi Terbaru**: 8 item terakhir dengan link "Lihat Semua"
- **Kartu Tabungan**: ringkasan progress goals
- **Kartu Anggaran**: progress budget bulanan per kategori

### 5. Transaksi
- Tambah transaksi (pemasukan/pengeluaran, kategori, nominal, catatan, metode bayar, tanggal custom via date picker)
- Edit dan hapus transaksi
- Data disimpan ke **Supabase** (`transactions` table) per user
- Grouping transaksi by tanggal pada halaman daftar

### 6. Anggaran (Budget)
- CRUD anggaran per kategori dengan limit nominal
- `spent` selalu dihitung dari data transaksi nyata (bukan dari DB) → akurat
- **Fuzzy match** label lama ke categoryId (untuk data migrasi)
- Migrasi otomatis dari localStorage ke Supabase (runs once)
- Sinkron ke Supabase (`budgets` table)

### 7. Tabungan (Goals)
- Buat, hapus goals dengan nama, target nominal, deadline, ikon
- Deposit ke goal; progress bar visual
- Deteksi goal mencapai 100% → tampilkan **GoalCompleteOverlay** (animasi perayaan + suara)
- Sinkron ke Supabase (`savings` / goals table)

### 8. Dompet / Multi-Akun (Wallets)
- Multiple wallet/akun keuangan per user
- Set akun primer; hapus akun (filter transaksi terkait)
- Sinkron ke Supabase (`wallets` table)
- Filter transaksi by akun di dashboard

### 9. Transaksi Berulang (Recurring Transactions)
- Jadwalkan transaksi otomatis: **mingguan / bulanan / tahunan**
- Konfigurasi: hari minggu, tanggal, bulan, tanggal mulai
- Saat app dibuka, `checkRecurringTransactions()` mengeksekusi semua jadwal yang sudah jatuh tempo (termasuk catch-up hingga 60 periode terlewat)
- Jika gagal (offline) → jadwal dicoba lagi saat app berikutnya dibuka
- **Toast notifikasi** muncul untuk setiap transaksi yang dieksekusi otomatis
- Data jadwal disimpan di localStorage; eksekusi masuk ke Supabase
- CRUD penuh dari halaman **Pengaturan → Jadwal**

### 10. Analitik
- Filter periode: 1 Bulan / 1 Tahun + Pilih Bulan
- Grafik cashflow dan pengeluaran per kategori dari data Supabase

### 11. Laporan
- Generate laporan **bulanan** dan **tahunan**
- Download sebagai **PDF** (HTML standalone → print/save)
- Download sebagai **Excel** (exceljs, sheet ringkasan + sheet detail transaksi)
- Escape HTML injection pada nama kategori kustom (keamanan)

### 12. Kategori Kustom
- User bisa membuat kategori sendiri (nama + warna + ikon) untuk pemasukan maupun pengeluaran
- Disimpan per user di Supabase
- Dipakai bersama di Transaksi, Anggaran, dan Laporan

### 13. Notifikasi In-App
- Notifikasi di TopBar (badge unread count)
- Jenis notifikasi: peringatan anggaran (≥80% / melebihi limit), transaksi masuk, ringkasan mingguan, pengingat tagihan
- Preferensi per jenis notifikasi disimpan di localStorage
- Master switch notifikasi

### 14. Pengaturan (Settings)
- **Tema**: Terang / Gelap (dark mode persisten di localStorage)
- **Warna Latar**: Cream, Sand, Mist, Bone (4 palette)
- **Tema Font**: 5 pilihan (Modern Tech, Professional Finance, Elegant Classic, Luxury Fintech, Soft & Friendly)
- **Layout Sidebar**: Berlabel / Ringkas (ikon saja)
- **Keamanan**: PIN, Biometrik, Ubah PIN
- **Jadwal**: akses ke halaman Transaksi Berulang
- **Notifikasi**: master switch + sub-toggle per jenis
- **Animasi & Suara**: toggle global
- **Wawasan AI**: toggle kartu Insights
- Logout dari akun Supabase

### 15. Android Home-Screen Widget
- Sinkron ringkasan saldo & anggaran ke widget Android (`widgetSync.js`)
- Tombol "Catat Transaksi" pada widget membuka app langsung ke form tambah transaksi (`consumeWidgetLaunchAction`)

### 16. CI/CD — Build APK Otomatis
- GitHub Actions workflow (`.github/workflows/build-apk.yml`)
- Trigger: push ke `main` / `master` + manual dispatch
- Pipeline: `npm ci` → `npm run build` → `cap sync android` → Gradle build APK

---

## Bug / Masalah yang Pernah Ada & Cara Penyelesaiannya

| Masalah | Solusi | Commit |
|---|---|---|
| **Status bar Android overlap** konten di bagian atas | Tambah padding/safe-area-inset-top menggunakan Capacitor Status Bar API | `4bf1385` |
| **KPI card overflow** di layar 330px | Ganti `fmt` (format panjang) dengan `fmtShort` (singkat: jt/M) + grid 2 kolom | `e6f9309`, `1b0d1c0` |
| **Nominal KPI tidak akurat** | Hitung ulang dari raw Supabase data, bukan cached state | `0960f61` |
| **Budget `spent` tidak cocok** (fuzzy match kategori lama) | Tambah logika fuzzy match label lama → categoryId baru saat kalkulasi spent | `ac46b48` |
| **Budget date tidak dinamis** (selalu bulan yang sama) | Hitung filter tanggal anggaran secara dinamis per bulan berjalan | `48fb40c` |
| **Budget sync ke Supabase gagal** (kolom salah) | Perbaiki mapping kolom: `institution` → `bank`, sesuaikan nama kolom DB | `4b0d840`, `25c6c67` |
| **Savings & Wallets INSERT schema mismatch** | Fix field mapping, `institution` → `bank`, parse deadline date dengan benar | `e567153`, `68f6835` |
| **Dark mode tidak persisten** | Simpan preferensi tema ke localStorage, baca saat init | `e6b01a` |
| **PDF download Android gagal** | Ganti pendekatan ke jsPDF + html2canvas; tulis via Capacitor Filesystem | `b33a4ca` |
| **Format popup laporan salah** | Fix format tanggal dan angka di modal preview laporan | `4cefd6d` |
| **Build APK workflow CI gagal** | Iterasi perbaikan GitHub Actions: Node versi, Java 21, `cap sync` step, dependency cache | Banyak commit `Update build-apk.yml` |
| **Merge conflict build-apk.yml** | Resolve dengan mempertahankan Node 22 + cap sync | `6b56041` |
| **Mobile layout `dash-grid` dan `page-wrap`** overflow/padding | Perbaiki CSS grid layout agar responsif di layar kecil | `8525a16` |
| **Transaksi berulang tidak mengejar periode yang terlewat** | While-loop catch-up dengan guard MAX=60 pada `checkRecurringTransactions` | `1ec20ae` |

---

## Catatan Penting per Fitur

### Transaksi Berulang
- Jadwal disimpan di **localStorage** (bukan Supabase) karena tidak perlu sinkron antar perangkat; hanya perlu tersedia lokal saat app dibuka.
- `checkRecurringTransactions()` dipanggil **sekali per sesi app** (dijaga dengan `useRef` guard) untuk mencegah duplikasi.
- Saat jadwal `mulaiDari` dan `frekuensi` tidak berubah pada edit, `nextDueDate` lama dipertahankan.

### Anggaran (Budget)
- Kolom `spent` di Supabase tidak dipakai sebagai sumber data — selalu dihitung ulang dari tabel `transactions`. Ini memastikan konsistensi data.
- Ada migrasi satu kali dari localStorage ke Supabase untuk user lama (commit `25c6c67`).

### PIN & Keamanan
- Hash PIN disimpan di localStorage (bukan Supabase) — ini keputusan desain untuk fitur lokal yang tidak memerlukan sync server.
- Biometrik hanya berfungsi di APK Android (Capacitor), tidak di web browser.

### Laporan (PDF/Excel)
- Semua nama kategori kustom di-escape HTML (`esc()` function) sebelum dimasukkan ke string HTML laporan, mencegah XSS self-injection.
- Excel menggunakan 2 sheet: ringkasan agregat + detail transaksi per baris.

### Tema & Font
- 5 tema font tersedia: Modern Tech (default), Professional Finance, Elegant Classic, Luxury Fintech, Soft & Friendly.
- 4 palette warna latar tersedia untuk mode terang; dark mode mengabaikan palette.
- Semua preferensi tampilan disimpan di `localStorage` key `finance_tweaks`.

### Widget Android
- Widget home-screen menerima aksi `add_tx` yang membuka langsung modal tambah transaksi.
- Sinkronisasi berjalan setiap kali state `transactions` atau `budgets` berubah (via `useEffect`).

### CI/CD
- Build APK berjalan di GitHub Actions setiap push ke `main`.
- Pipeline melakukan: install deps → build web (Vite) → setup Java 21 + Android SDK → `cap sync` → Gradle build APK.

---

## Riwayat Versi Singkat

| Versi | Highlight |
|---|---|
| Awal | Setup dasar, mobile layout responsif, dashboard KPI dari Supabase |
| v1.0 | Cashflow chart, budget dynamic, savings + wallets ke Supabase, sistem notifikasi |
| v1.1.0 | Logo baru, date picker, sinkronisasi kategori, keamanan PIN + biometrik, dark mode persist, delete/edit transaksi |
| v1.2.0 | Splash screen animasi, transaksi berulang (recurring), kategori kustom untuk pemasukan |

---

*Dokumen ini dibuat secara otomatis dari analisis kode sumber dan riwayat git pada 14 Juni 2026.*
