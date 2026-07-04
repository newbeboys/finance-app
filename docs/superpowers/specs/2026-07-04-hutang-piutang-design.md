# Desain: Fitur Catatan Hutang & Piutang

Tanggal: 2026-07-04
Status: Disetujui user (menunggu review spec tertulis)

## 1. Ringkasan

Fitur baru untuk mencatat **piutang** (uang yang dipinjamkan ke orang lain) dan
**hutang** (uang yang dipinjam dari orang lain), terintegrasi penuh dengan dompet
dan transaksi: setiap kejadian hutang membuat baris transaksi tertaut dan
menyesuaikan saldo dompet. Halaman penuh diakses dari drawer "Lainnya", dengan
card ringkasan di Beranda.

Keputusan kunci yang sudah disepakati:

| Keputusan | Pilihan |
|---|---|
| Integrasi | Terintegrasi penuh — pendekatan C (transaksi tertaut via `debt_id`) |
| Penempatan | Item baru di drawer "Lainnya" (jadi 5 item) |
| Cakupan v1 | Cicilan parsial, catatan per hutang, ringkasan Beranda, jatuh tempo + pengingat |
| Jatuh tempo | Satu `due_date` per catatan (tanpa jadwal cicilan bulanan berulang) |
| Monetisasi | Basic: maks 5 aktif + cooldown 50 hari; Pro: tak terbatas |

## 2. Data model (Supabase)

Semua tabel baru mengikuti pola tabel lain: kolom `user_id` + RLS per user.

### Tabel `debts`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK auth.users, RLS |
| `type` | text | `'receivable'` (piutang) / `'payable'` (hutang) |
| `person_name` | text | Nama orang, wajib |
| `note` | text nullable | Keterangan bebas |
| `amount` | numeric | Nilai pokok, > 0 |
| `paid` | numeric default 0 | Akumulasi terbayar |
| `wallet_id` | uuid nullable | Dompet sumber/tujuan; jadi null bila dompet dihapus |
| `date` | date | Tanggal terjadinya |
| `due_date` | date nullable | Jatuh tempo (opsional) |
| `status` | text default `'active'` | `'active'` / `'paid'` (otomatis saat `paid >= amount`) |
| `is_deleted` | boolean default false | Soft delete — jejak pembuatan tetap terhitung untuk cooldown |
| `created_at` | timestamptz | Basis perhitungan jendela cooldown 50 hari |

### Tabel `debt_payments`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `debt_id` | uuid | FK debts |
| `user_id` | uuid | RLS |
| `amount` | numeric | > 0, ≤ sisa hutang saat input |
| `date` | date | |
| `note` | text nullable | |
| `transaction_id` | uuid nullable | Tautan ke baris `transactions` yang dibuatnya |

### Migration tabel `transactions`

Kolom baru `debt_id` (uuid nullable, FK `debts`). Baris ber-`debt_id`:
- **dikecualikan** dari hitungan kuota 75 transaksi/bulan user Basic
  (filter `debt_id is null` pada query count di `useTransactions.createTransaction`);
- ikut dihapus + saldo dikoreksi saat hutang induknya dihapus.

## 3. Aliran uang

Semua kejadian membuat baris transaksi (dengan `debt_id`) lalu menyesuaikan
saldo dompet lewat mekanisme `adjustBalance` yang sudah ada:

| Kejadian | Transaksi | Efek saldo dompet |
|---|---|---|
| Catat piutang (meminjamkan uang) | pengeluaran, kategori "Piutang" | −pokok |
| Terima cicilan piutang | pemasukan, kategori "Pembayaran Piutang" | +cicilan |
| Catat hutang (menerima pinjaman) | pemasukan, kategori "Hutang" | +pokok |
| Bayar cicilan hutang | pengeluaran, kategori "Pembayaran Hutang" | −cicilan |

Empat kategori di atas adalah kategori bawaan baru (bukan custom category),
sehingga muncul wajar di cashflow, laporan, dan analitik tanpa kode tambahan.

## 4. Struktur kode

Mengikuti pola per-fitur yang sudah ada:

- `supabase/migrations/…_add_debts.sql` — tabel `debts`, `debt_payments`,
  kolom `transactions.debt_id`, RLS.
- `src/hooks/useDebts.js` — `useDebts(userId, limits)`: fetch, `createDebt`,
  `addPayment`, `markPaid`, `deleteDebt` + guard limit/paywall.
- `src/debts-page.jsx` — halaman penuh.
- `DebtsCard` di `src/widgets.jsx` — card ringkasan Beranda.
- `src/components/BottomNav.jsx` — entri `debts` di `MORE_NAV` (drawer jadi 5
  item; grid disesuaikan).
- `src/app.jsx` — routing `active === "debts"`, wiring hook + wrapper yang
  memanggil `adjustBalance` (pola sama dengan `handleCreateTransaction`).
- `src/lib/planLimits.js` — `maxActiveDebts: 5` + `debtCooldownDays: 50`
  (basic); `Infinity` / tanpa cooldown (pro).
- `src/i18n.js` — string baru dua bahasa mengikuti pola terjemahan yang ada.
- `useNotifications` — dua pemicu pengingat baru (H-3 dan lewat tempo).

## 5. UX halaman Hutang/Piutang

- **Header ringkasan**: total Piutang aktif (hijau) dan total Hutang aktif
  (merah) berdampingan.
- **Banner telat bayar (persistent)**: lihat §7.
- **Filter tab**: `Piutang` / `Hutang` / `Lunas`. Dua tab pertama menampilkan
  yang aktif; tab Lunas adalah arsip.
- **Card per item**: nama orang, keterangan singkat, progress bar terbayar
  ("Rp200rb / Rp500rb"), sisa, badge tempo — merah "Lewat tempo" bila
  `due_date` terlewati, oranye bila ≤3 hari lagi.
- **Detail item** (tap): riwayat cicilan dari `debt_payments`, tombol
  **Bayar/Terima Cicilan**, **Tandai Lunas** (membuat cicilan sebesar sisa),
  **Hapus** (dengan konfirmasi).
- **Form tambah**: tipe (Piutang/Hutang), nama orang (wajib), jumlah (>0),
  dompet, tanggal, jatuh tempo (opsional), keterangan (opsional). Gaya
  modal/sheet mengikuti `AddGoalModal`.
- **Form cicilan**: jumlah (>0, ≤ sisa) + tanggal + catatan opsional. Saat
  `paid >= amount` → status `paid` + toast "Lunas 🎉".

### Card Beranda (`DebtsCard`)

Ringkasan kompak: total piutang vs hutang aktif + item terdekat jatuh tempo.
Tap → navigasi ke halaman Hutang/Piutang. Posisi: setelah `BudgetsCard`.

### Pengingat (notifikasi in-app)

Menumpang `useNotifications`: pemicu H-3 sebelum jatuh tempo ("Piutang ke Budi
jatuh tempo 3 hari lagi") dan saat lewat tempo. Toggle on/off baru
"Hutang/Piutang" di panel notifikasi Pengaturan (pola `notifSubs`).

## 6. Limit Basic (cooldown 50 hari)

Pro: tanpa batasan. Basic terikat DUA syarat untuk membuat catatan baru —
keduanya harus terpenuhi:

1. **Maks 5 catatan aktif** (hutang + piutang digabung; status `active`,
   `is_deleted = false`).
2. **Maks 5 pembuatan per jendela 50 hari (rolling)** — dihitung dari
   `created_at` semua baris `debts` dalam 50 hari terakhir, **termasuk** yang
   sudah lunas maupun yang di-soft-delete.

Konsekuensi aturan:

- **Hapus tidak membebaskan slot cooldown** → karena itu hapus memakai soft
  delete (`is_deleted = true`), mengikuti pola `custom_categories`. User tidak
  bisa akali dengan hapus-buat-ulang.
- **Lunas tidak membebaskan slot cooldown** — lunas hanya mengurangi hitungan
  "aktif", yang baru berguna setelah jendela cooldown longgar.
- **Pesan blokir informatif**: menampilkan tanggal pasti bisa membuat lagi
  (`created_at` pembuatan tertua dalam jendela + 50 hari) + tombol upgrade Pro
  (paywall). Contoh: 5 catatan dibuat 1 Juli → bisa lagi ±21 Agustus.
- Contoh campuran: 3 dibuat 1 Juli + 2 dibuat 10 Juli → 21 Agustus tiga slot
  jendela terbuka; bila catatan aktif tinggal 2, user boleh membuat maks 3 lagi
  (dibatasi juga oleh syarat maks-5-aktif).

Pengecekan dilakukan di `useDebts.createDebt` (jaring pengaman otoritatif) dan
pre-check di tombol pemicu (pola `handleAddAcct`/`handleAddGoal` di `app.jsx`).

## 7. Banner telat bayar (persistent)

- Muncul di bagian atas halaman Hutang/Piutang untuk **setiap** catatan aktif
  yang melewati `due_date`: "⚠ Kamu telat membayar {nama} {N} hari" — N
  bertambah tiap hari. Beberapa catatan telat → satu baris per catatan.
- Tombol **Bayar sekarang** → membuka form cicilan catatan itu. Tombol
  **Nanti** → banner tertutup untuk kunjungan halaman saat ini saja (state
  lokal, tidak dipersist).
- Banner hilang permanen hanya bila: ada cicilan yang **disimpan** (waktu
  penyimpanan/`created_at`, bukan field tanggal cicilan yang bisa diisi mundur)
  pada/setelah `due_date`, atau catatan berstatus lunas. Klik "Bayar
  sekarang" lalu batal tanpa menyimpan → banner muncul lagi di kunjungan
  berikutnya.
- Banner melengkapi notifikasi §5: notifikasi = ping sekali, banner = menetap
  sampai ditindaklanjuti.

## 8. Aturan hapus & edge case

- **Hapus hutang**: konfirmasi dulu → soft delete baris `debts`; semua
  transaksi tertaut (`debt_id`) dihapus dan saldo dompet dikoreksi balik.
  Makna "hapus" = membatalkan pencatatan, bukan menyembunyikan. Baris
  `debt_payments` ikut tidak berlaku (dihapus).
- **Dompet dihapus user**: catatan hutang tetap ada (`wallet_id` → null);
  cicilan berikutnya meminta pilih dompet lagi.
- **Cicilan melebihi sisa**: ditolak di validasi form.
- **Kegagalan parsial (teknis)**: pembuatan hutang = insert `debts` → insert
  `transactions` + adjust saldo. Bila langkah transaksi gagal → baris `debts`
  di-rollback (dihapus) + pesan error; tidak ada catatan setengah jadi. Pola
  sama untuk cicilan.

## 9. Testing (checklist manual)

Proyek belum punya test otomatis; verifikasi lewat checklist skenario:

1. Buat piutang → saldo dompet turun, transaksi kategori "Piutang" muncul,
   card Beranda ter-update.
2. Input cicilan → saldo naik, sisa benar, riwayat cicilan tampil.
3. Cicilan penuh / Tandai Lunas → status `paid`, pindah ke tab Lunas, toast.
4. Hapus catatan → transaksi tertaut hilang, saldo kembali seperti semula.
5. Buat hutang (payable) → arah saldo/transaksi kebalikan piutang.
6. User Basic: catatan ke-6 dalam 50 hari → blokir + tanggal cooldown benar
   + paywall; hapus/lunasi catatan → tetap terblokir.
7. Kuota 75 transaksi/bulan Basic tidak berkurang oleh transaksi ber-`debt_id`.
8. `due_date` H-3 dan lewat tempo → notifikasi muncul sesuai toggle.
9. Lewat tempo → banner telat muncul; "Nanti" → hilang sementara, muncul lagi
   saat halaman dibuka ulang; input cicilan → hilang permanen.
10. Hapus dompet yang dipakai hutang → catatan tetap ada, cicilan minta dompet.
