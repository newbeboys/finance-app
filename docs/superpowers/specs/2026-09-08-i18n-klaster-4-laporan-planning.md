# Perencanaan: i18n Klaster 4 — Konten Laporan PDF/Excel

Tanggal: 2026-09-08
Status: **SELESAI** (2026-09-09) — user memilih **Opsi A** (§7.4): §5.2 dibatalkan,
`fmt`/`fmtShort`/`fmtSigned`/`formatNominal` di `data.jsx` tetap terkunci `id-ID`/"Rp"
selamanya, tidak ikut bahasa UI. Klaster 4 dieksekusi dengan scope dipersempit kembali
ke label teks & tanggal saja di `reports.jsx`/`report-excel.js`, di commit
[`eaddc1b`](../../../../.git) "i18n: migrate report content (PDF/Excel) cluster to
react-i18next". `CLAUDE.md` sudah diperbarui (section "Currency: single-currency by
design") untuk mendokumentasikan keputusan ini sebagai keputusan produk yang mengunci,
sesuai catatan §6. Dokumen ini dipertahankan sebagai arsip proses pengambilan keputusan.
Cabang: `chore/i18n-full-migration`
File terdampak: [src/reports.jsx](../../../src/reports.jsx), [src/report-excel.js](../../../src/report-excel.js) — `src/data.jsx` pada akhirnya **tidak** ikut diubah (lihat resolusi §7.4/Opsi A di atas).

## 1. Ringkasan

Klaster 4 adalah klaster terakhir dari rencana migrasi i18n penuh (lihat `CLAUDE.md`),
mencakup konten laporan keuangan yang di-generate sebagai PDF (`buildReportDoc` di
reports.jsx) dan Excel (report-excel.js). Berbeda dari 3 klaster sebelumnya, sebagian
besar fungsi di sini berada di **level module**, bukan di dalam komponen React — jadi
tidak bisa langsung pakai `useTranslation()`.

Keputusan kunci yang sudah disepakati:

| Keputusan | Pilihan |
|---|---|
| Pendekatan i18n fungsi module-level | `i18n.t()` manual (pola sama seperti `useDebts.js`), bukan thread `t` sebagai parameter |
| Simbol mata uang ("Rp") | Ikut bahasa UI → jadi "IDR" saat English |
| Pengelompokan angka (pemisah ribuan) | Ikut bahasa UI (`id-ID` vs `en-US`) |
| Format tanggal di laporan | Ikut bahasa UI, pola sama seperti `SubscriptionStatus.jsx` |
| Scope format currency/angka | **Diperluas** — juga ubah `fmtShort()` di `data.jsx` (dipakai app-wide, sebelumnya "not scheduled") |
| Nama sheet Excel + kriteria formula SUMIFS | Diperlakukan sebagai satu grup atomik, resolve sekali & konsisten |

## 2. Inventaris fungsi — module-level vs component-level

### 2.1 `src/reports.jsx`

**Module-level (di luar komponen React, TIDAK ada akses `useTranslation()`):**

| Fungsi | Baris | Catatan |
|---|---|---|
| `esc` | [18](../../../src/reports.jsx#L18) | escape HTML, tidak ada string UI |
| `aggregate` | [25](../../../src/reports.jsx#L25) | tidak ada string UI |
| `withLabels` | [44](../../../src/reports.jsx#L44) | tidak ada string UI |
| `sortDesc` | [52](../../../src/reports.jsx#L52) | tidak ada string UI |
| `monthsIndex` | [60](../../../src/reports.jsx#L60) | pakai `ID_MONTHS_ABBR`/`ID_MONTHS_FULL` |
| `yearsIndex` | [77](../../../src/reports.jsx#L77) | tidak ada string UI |
| `sanitizeFilename` | [92](../../../src/reports.jsx#L92) | tidak ada string UI |
| `buildPayload` | [98](../../../src/reports.jsx#L98) | `"Laporan Bulanan"`, `"Laporan Tahunan"`, `"Semua Dompet"`, filename pakai nama bulan ID |
| `reportPieSVG` / `reportBarSVG` / `reportCatBarSVG` | [132](../../../src/reports.jsx#L132), [151](../../../src/reports.jsx#L151), [168](../../../src/reports.jsx#L168) | hanya render label kategori dinamis, tidak ada teks statis |
| `buildReportDoc` | [179](../../../src/reports.jsx#L179) | **paling padat** — puluhan label statis dalam template HTML; juga `lang="id"` dan `toLocaleDateString("id-ID", …)` di [277](../../../src/reports.jsx#L277) |
| `resolveCssVars` | [351](../../../src/reports.jsx#L351) | tidak ada string UI |
| `downloadPdf` | [357](../../../src/reports.jsx#L357) | label autoTable duplikat dari `buildReportDoc` ("Tabel — Pemasukan per kategori", "Bagian 4 — Rincian Transaksi", "Penutup", "Hal. X dari Y", dll — [532](../../../src/reports.jsx#L532)–[626](../../../src/reports.jsx#L626)) |
| `printReport` | [661](../../../src/reports.jsx#L661) | tidak ada string UI langsung, memanggil `buildReportDoc` |
| `ID_MONTHS_FULL` / `ID_MONTHS_ABBR` | [13](../../../src/reports.jsx#L13)–[14](../../../src/reports.jsx#L14) | konstanta modul (bukan fungsi) — akar nama bulan hardcode yang menyebar ke `buildPayload`, `buildReportDoc`, `downloadPdf`, dan sheet "Tren Bulanan" di Excel |

**Component-level (sudah punya `const { t: tr } = useTranslation()`):**
`ReportPreview` ([821](../../../src/reports.jsx#L821)), `FormatPicker` ([984](../../../src/reports.jsx#L984)),
`ReportsPage` ([1051](../../../src/reports.jsx#L1051)), `ReportCard` ([1143](../../../src/reports.jsx#L1143)).

**Kasus khusus:** `ExcelPreviewRenderer` ([671](../../../src/reports.jsx#L671)) — dirender sebagai JSX
(`<ExcelPreviewRenderer payload={p} />` di [955](../../../src/reports.jsx#L955)), jadi secara teknis BISA
panggil `useTranslation()` sendiri seperti komponen biasa, meski saat ini belum. Ini yang
paling mudah dimigrasi karena tidak butuh trik apa pun.

### 2.2 `src/report-excel.js`

**100% module-level — tidak ada satupun komponen React.** Semua fungsi
(`buildSummarySheet`, `buildDetailSheet`, `buildCategorySheet`, `buildIncomeCategorySheet`,
`buildTrendSheet`, chart PNG builders, `buildWorkbook`, `downloadExcel`) tidak punya akses
hook — dipanggil dari `handleDownload` di `ReportPreview`/`FormatPicker` (yang punya `tr`),
tapi fungsinya sendiri berada di file terpisah tanpa React sama sekali.

## 3. Pendekatan i18n untuk fungsi module-level

**Keputusan: pakai `i18n.t()` manual**, pola yang sama dengan `useDebts.js`
([useDebts.js:5](../../../src/hooks/useDebts.js#L5), [35–37](../../../src/hooks/useDebts.js#L35-L37) —
komentar aslinya menjelaskan alasan: string di-resolve *di titik pemakaian*, bukan
sebagai konstanta modul-level, supaya tetap ikut bahasa aktif saat dipanggil).

```js
import i18n from './i18n';
// dipanggil saat fungsi dieksekusi, bukan disimpan sebagai const modul:
`<h2 class="sec">${i18n.t('laporan.pdf.diagramBatang')}</h2>`
```

Alasan dipilih dibanding alternatif (thread `t` sebagai parameter ke `buildReportDoc`/
`buildPayload`/`downloadPdf`/`downloadExcel` dari komponen pemanggil):

- Sudah ada preseden persis di repo ini (`useDebts.js`) — konsisten dengan keputusan
  arsitektur klaster 1, bukan pola baru.
- Fungsi-fungsi ini dipanggil lintas-file (`reports.jsx` → `report-excel.js`, plus
  `window.buildReportDoc` di [1191](../../../src/reports.jsx#L1191)) — thread `t` sebagai
  parameter berarti mengubah signature ~15+ fungsi dan rantai pemanggilnya.
- Semua titik panggil adalah event handler (klik tombol), bukan saat render — jadi
  `i18n` sudah pasti ter-inisialisasi dan bahasa aktif sudah ter-set saat fungsi jalan.
  Tidak ada risiko "stale language".

**Catatan implementasi:** supaya template HTML besar (`buildReportDoc`) tetap terbaca,
extract label unik ke local const di awal fungsi (mis.
`const T = { diagramBatang: i18n.t('laporan.pdf.diagramBatang'), ... }`), bukan panggil
`i18n.t(...)` inline berulang di tiap baris template literal.

**Tambahan di luar 4 pertanyaan awal, tapi perlu masuk migrasi:**
`ID_MONTHS_FULL`/`ID_MONTHS_ABBR` perlu jadi `i18n.t('common.months.X')` atau
`Intl.DateTimeFormat(i18n.language, {month:'long'})`, karena jadi akar nama bulan di
`monthsIndex`, `buildPayload` (periodLabel & filename), `buildReportDoc` (tabel bulanan),
dan sheet "Tren Bulanan" di Excel.

## 4. `report-excel.js` — formula Excel vs label yang boleh dimigrasi

### 4.1 JANGAN disentuh (syntax formula Excel & referensi sel)

- Semua isi properti `formula:` — cell refs (`B5`, `$F$2:$F$${dn}`, `A${rowIdx}`) dan
  fungsi Excel (`SUMIFS`, `SUM`, `IF`) di
  [218–225](../../../src/report-excel.js#L218-L225),
  [283–285](../../../src/report-excel.js#L283-L285),
  [310](../../../src/report-excel.js#L310), [315](../../../src/report-excel.js#L315),
  [324–325](../../../src/report-excel.js#L324-L325), [355](../../../src/report-excel.js#L355),
  [360](../../../src/report-excel.js#L360), [368–369](../../../src/report-excel.js#L368-L369),
  [397](../../../src/report-excel.js#L397), [406–408](../../../src/report-excel.js#L406-L408).
- Kode format angka `RP_FMT`/`PCT_FMT` ([45–46](../../../src/report-excel.js#L45-L46)) —
  syntax number-format Excel, bukan teks biasa (kecuali literal `"Rp"` di dalamnya, lihat §5).

### 4.2 ⚠️ Risiko terbesar — keterkaitan formula ↔ label, bukan pemisahan yang simpel

Beberapa formula SUMIFS mereferensikan **nama sheet** dan **string kriteria** yang
sebenarnya juga jadi target migrasi:

- `'Detail Transaksi'!$F$2:...` — nama sheet ini dipakai literal di 4+ formula string
  ([218–219](../../../src/report-excel.js#L218-L219), [310](../../../src/report-excel.js#L310),
  [355](../../../src/report-excel.js#L355)) SEKALIGUS sebagai nama worksheet aktual di
  `wb.addWorksheet('Detail Transaksi', …)` ([249](../../../src/report-excel.js#L249)) dan
  array urutan sheet di [440](../../../src/report-excel.js#L440). Kalau nama sheet
  diterjemahkan tapi salah satu referensi formula tidak ikut diubah → Excel menampilkan `#REF!`.
- Kriteria SUMIFS `"Pemasukan"` / `"Pengeluaran"` ([219](../../../src/report-excel.js#L219),
  [283](../../../src/report-excel.js#L283), [285](../../../src/report-excel.js#L285),
  [310](../../../src/report-excel.js#L310), [355](../../../src/report-excel.js#L355)) adalah
  string yang DICOCOKKAN terhadap nilai literal yang ditulis ke kolom "Tipe" di
  `buildDetailSheet` ([265](../../../src/report-excel.js#L265):
  `isIncome ? 'Pemasukan' : 'Pengeluaran'`). Kalau nilai sel diterjemahkan ke
  "Income"/"Expense" tapi kriteria formula tetap "Pemasukan" → formula diam-diam
  mengembalikan 0 saat Excel recalculate (nilai `result:` cache masih benar sampai
  user edit sheet, lalu jadi salah).

**Rekomendasi eksekusi:** perlakukan {nama sheet "Detail Transaksi", nilai sel tipe
"Pemasukan"/"Pengeluaran", kriteria formula yang mereferensikan keduanya} sebagai
**satu grup atomik** — resolve sekali di awal `buildWorkbook`/`buildDetailSheet`
(mis. via `refs.sheetNames`, `refs.typeLabels`) lalu interpolasikan konsisten ke semua
tempat, bukan translate satu-satu terpisah.

### 4.3 BOLEH & PERLU dimigrasi

- **Nama worksheet:** `'Ringkasan'` [191](../../../src/report-excel.js#L191),
  `'Detail Transaksi'` [249](../../../src/report-excel.js#L249),
  `'Per Kategori'` [299](../../../src/report-excel.js#L299),
  `'Pemasukan per Kategori'` [344](../../../src/report-excel.js#L344),
  `'Tren Bulanan'` [387](../../../src/report-excel.js#L387) — plus array `order` di
  [440](../../../src/report-excel.js#L440).
- **Header kolom:** `['No','Tanggal','Kategori','Keterangan','Tipe','Jumlah']`
  [250](../../../src/report-excel.js#L250), `['Kategori','Total','Persentase']`
  [300](../../../src/report-excel.js#L300)/[345](../../../src/report-excel.js#L345),
  `['Bulan','Pemasukan','Pengeluaran','Selisih']` [388](../../../src/report-excel.js#L388).
- **Label baris:** `'Total Pemasukan'`, `'Total Pengeluaran'`, `'Selisih Bersih'`,
  `'Tingkat Menabung'`, `'TOTAL PEMASUKAN'`/`'TOTAL PENGELUARAN'`
  [282](../../../src/report-excel.js#L282)–[285](../../../src/report-excel.js#L285),
  `'Total'` [405](../../../src/report-excel.js#L405), judul chart
  ("Diagram batang — Pemasukan vs Pengeluaran" dst.), `'FinanceApp'`,
  `'Less spending · More living'`, `Dompet: …`.
- **Teks yang digambar ke Canvas** (jadi PNG, bukan sel Excel asli) — label
  'Pemasukan'/'Pengeluaran' di `barChartPNG`/`lineChartPNG`
  ([64–65](../../../src/report-excel.js#L64-L65), [152](../../../src/report-excel.js#L152),
  [154](../../../src/report-excel.js#L154)) — aman diterjemahkan, tinggal teruskan string
  terjemahan ke fungsi chart builder.

### 4.4 Batas 31 karakter nama sheet Excel

Semua nama sheet saat ini aman jauh di bawah batas ('Detail Transaksi' = 17 karakter,
'Pemasukan per Kategori' = 22 karakter terpanjang). Terjemahan Inggris yang wajar
("Transaction Details", "Income by Category") kemungkinan besar tetap di bawah 31 —
perlu dicek ulang panjang string final begitu teks Inggrisnya ditentukan di prompt
eksekusi. Tidak ada karakter terlarang (`\ / ? * [ ] :`) yang berisiko muncul dari
kata-kata bisnis biasa dalam bahasa Inggris.

## 5. Format Rupiah, angka, dan tanggal — keputusan produk

### 5.1 Preseden yang sudah ada di repo (jadi dasar rekomendasi awal)

- [SubscriptionStatus.jsx:22](../../../src/components/subscription/SubscriptionStatus.jsx#L22)
  sudah melokalkan tanggal: `toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'id-ID', …)`.
- [AddDebtModal.jsx:158](../../../src/components/debts/AddDebtModal.jsx#L158) dan
  [DebtDetailSheet.jsx:153](../../../src/components/debts/DebtDetailSheet.jsx#L153) justru
  sengaja **mengunci** format angka nominal ke `'id-ID'` terlepas dari bahasa UI.
- `fmtShort()` di [data.jsx:2–9](../../../src/data.jsx#L2-L9) — dipakai app-wide, bukan
  cuma di reports — juga hardcode `"Rp "` selalu.

### 5.2 Keputusan final

| Item | Keputusan | Implikasi |
|---|---|---|
| Simbol mata uang ("Rp") | Ikut bahasa UI → "IDR" saat English | Menyimpang dari preseden AddDebtModal/DebtDetailSheet (yang mengunci ke id-ID) — keputusan produk yang disengaja |
| Pengelompokan angka | Ikut bahasa UI (`id-ID` vs `en-US`) | Konsisten dengan keputusan simbol mata uang |
| Format tanggal | Ikut bahasa UI | Konsisten dengan preseden `SubscriptionStatus.jsx` |
| Scope | Diperluas ke `fmtShort()` di `data.jsx` | Item ini sebelumnya "not currently scheduled" di CLAUDE.md — hari ini masuk kerjaan |

**Pendekatan teknis:** satu pemanggilan `Intl.NumberFormat` menangani simbol dan
pengelompokan angka sekaligus:

```js
new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(n)
```

### 5.3 Konsekuensi scope yang perlu diketahui

Karena `fmtShort()` ikut berubah, semua halaman lain yang memakainya (dashboard,
transaksi, dompet, dll — bukan cuma `ReportCard` di reports.jsx) ikut menampilkan "IDR"
saat UI English. Ini memperluas blast radius klaster 4 di luar
`reports.jsx`/`report-excel.js` yang disebut di CLAUDE.md.

## 6. Catatan untuk sesi eksekusi

- Update bagian i18n di `CLAUDE.md`: tandai klaster 4 selesai, dan perbaiki baris yang
  menyebut `data.jsx`/`fmtShort()` sebagai "not currently scheduled" — sudah tidak akurat
  setelah keputusan §5.2 (catatan: keputusan ini sedang ditinjau ulang, lihat §7).
- Cek ulang panjang nama sheet Excel final terhadap batas 31 karakter (§4.4) begitu
  teks Inggris final dipilih.
- Implementasi kelompok atomik nama sheet + kriteria SUMIFS (§4.2) sebelum menyentuh
  string lain di report-excel.js, supaya tidak ada `#REF!`/formula yang diam-diam salah.

## 7. Temuan pre-flight check eksekusi — inkonsistensi `fmt()` vs `fmtShort()`

**Status: ON HOLD.** Ditemukan saat sesi eksekusi diminta berhenti dulu untuk mengecek
`fmt()` di data.jsx sebelum menulis kode apa pun. User memutuskan menunda keputusan ini
(2026-09-08) — bagian ini mendokumentasikan temuan + rekomendasi supaya bisa dilanjutkan
kapan pun tanpa mengulang investigasi.

### 7.1 Ternyata ada 3 fungsi currency yang terkunci `id-ID`, bukan cuma `fmt()`

Pertanyaan awal user hanya menyebut `fmt()`. Investigasi menemukan **tiga** fungsi
di [data.jsx](../../../src/data.jsx) yang terkunci `id-ID`, sementara `fmtShort()`
(target keputusan §5.2) direncanakan ikut bahasa UI:

| Fungsi | Baris | Perilaku | Dipakai di |
|---|---|---|---|
| `fmt()` | [data.jsx:1](../../../src/data.jsx#L1) | Terkunci `id-ID` | 14 file |
| `fmtSigned()` | [data.jsx:10](../../../src/data.jsx#L10) | Terkunci (memanggil `fmt()` internal) | `widgetSync.js` (sync widget native Android — proses background, kemungkinan tidak reliable akses state bahasa UI) |
| `formatNominal()` | [data.jsx:13-17](../../../src/data.jsx#L13-L17) | Terkunci `id-ID` | 8 file — **belum pernah disebut di §5 sebelumnya** |
| `fmtShort()` | [data.jsx:2-9](../../../src/data.jsx#L2-L9) | Target §5.2 → ikut bahasa UI | 10 file |

Jadi kondisi sebenarnya: **3 fungsi tetap `id-ID` vs 1 fungsi ikut bahasa UI** — bukan
"dua fungsi beda perilaku" seperti dugaan awal user.

### 7.2 Pemisahannya bukan per-halaman, tapi tercampur di layar yang sama

Bagian paling serius: `fmt()` dan `fmtShort()` sama-sama dipakai **di file/halaman yang
sama**, untuk elemen UI berbeda pada layar yang sama — bukan terpisah rapi per fitur
(reports/dashboard vs hutang-piutang) seperti hipotesis awal user.

| File | Pakai `fmtShort` (ikut bahasa) untuk | Pakai `fmt` (tetap Rp) untuk |
|---|---|---|
| [wallets.jsx](../../../src/wallets.jsx) | saldo di chip/list ([53](../../../src/wallets.jsx#L53), [71](../../../src/wallets.jsx#L71), [84](../../../src/wallets.jsx#L84), [176](../../../src/wallets.jsx#L176)) | saldo besar (hero) di detail dompet + jumlah transaksi ([228](../../../src/wallets.jsx#L228), [311](../../../src/wallets.jsx#L311)) |
| [budgets-page.jsx](../../../src/budgets-page.jsx) | "terpakai"/sisa anggaran ([108](../../../src/budgets-page.jsx#L108)-[228](../../../src/budgets-page.jsx#L228)) | limit per-baris anggaran ([239](../../../src/budgets-page.jsx#L239)) |
| [transactions.jsx](../../../src/transactions.jsx) | selector saldo dompet ([509](../../../src/transactions.jsx#L509), [537](../../../src/transactions.jsx#L537)) | **total & jumlah tiap baris transaksi** — tampilan paling sering dilihat user ([98](../../../src/transactions.jsx#L98), [121](../../../src/transactions.jsx#L121), [142](../../../src/transactions.jsx#L142)) |
| [widgets.jsx](../../../src/widgets.jsx) | breakdown kategori & tabungan ([282](../../../src/widgets.jsx#L282), [489](../../../src/widgets.jsx#L489), [562](../../../src/widgets.jsx#L562)) | kalimat insight + kartu total hutang/piutang di beranda ([335](../../../src/widgets.jsx#L335), [349](../../../src/widgets.jsx#L349), [616](../../../src/widgets.jsx#L616), [621](../../../src/widgets.jsx#L621)) |
| [app.jsx](../../../src/app.jsx) | — (tidak pakai `fmtShort` sama sekali) | toast notifikasi transaksi berulang ([843](../../../src/app.jsx#L843)) |

**Konsekuensi kalau §5.2 dijalankan apa adanya:** saat UI di-set English, halaman Dompet
akan menampilkan angka kecil "IDR" di daftar sementara angka besar di detail dompet tetap
"Rp" — **dalam satu layar yang sama**. Pola serupa terjadi di Anggaran, Transaksi, dan
widget Beranda.

### 7.3 Rekomendasi

Mengingat mayoritas fungsi (3 dari 4: `fmt`, `fmtSigned`, `formatNominal`) sudah dan
tetap terkunci `id-ID`, dan app ini memang cuma support satu mata uang (IDR — tidak ada
kolom currency di schema, per `CLAUDE.md`), rekomendasi: **batalkan keputusan "Rp→IDR
ikut bahasa UI"** dari §5.2. Semua angka Rupiah (termasuk di laporan PDF/Excel) tetap
format `id-ID`/"Rp" selalu, terlepas bahasa UI — hanya teks label dan tanggal yang ikut
bahasa. Ini mengembalikan konsistensi penuh dengan footprint jauh lebih kecil (kembali ke
lingkup reports.jsx/report-excel.js saja, tidak perlu menyentuh 20+ file lain).

### 7.4 Opsi yang diajukan ke user (keputusan ditunda — 2026-09-08)

| Opsi | Deskripsi | Trade-off |
|---|---|---|
| **A — Batalkan (direkomendasikan)** | `fmtShort()` TIDAK ikut bahasa UI, tetap `id-ID` seperti `fmt`/`fmtSigned`/`formatNominal`. §5.2 di-revert. Klaster 4 kembali fokus ke label teks & tanggal saja. | Konsisten penuh, blast radius kecil. Membatalkan keputusan yang sudah diambil di sesi sebelumnya. |
| **B — Perluas** | Migrasi `fmt`/`fmtSigned`/`formatNominal` juga supaya semua currency konsisten ikut bahasa UI. | Blast radius jauh lebih besar — 20+ file di luar reports.jsx/report-excel.js (wallets, budgets, transactions, app.jsx, subscription, widgetSync.js). Bukan lagi "klaster i18n laporan", jadi proyek terpisah. |
| **C — Terima inkonsistensi** | Jalan sesuai rencana §5.2 apa adanya, inkonsistensi di §7.2 didokumentasikan sebagai known issue/follow-up, tidak menghalangi klaster 4 selesai. | Klaster 4 selesai cepat, tapi user-facing bug (angka "Rp"/"IDR" tercampur satu layar) dirilis dengan sengaja. |

**Keputusan user (2026-09-09): Opsi A.** §5.2 dibatalkan — `fmt`, `fmtShort`,
`fmtSigned`, `formatNominal` di `data.jsx` tetap terkunci `id-ID`/"Rp" untuk selamanya,
tidak ikut bahasa UI, sama seperti keputusan awal untuk `fmt`/`fmtSigned`/`formatNominal`.
Klaster 4 dieksekusi dengan scope dipersempit ke label teks & tanggal saja di
reports.jsx/report-excel.js (commit `eaddc1b`), `data.jsx` tidak disentuh. `CLAUDE.md`
sudah diperbarui untuk mencatat ini sebagai keputusan produk yang mengunci (section
"Currency: single-currency by design").
