-- ════════════════════════════════════════════════════
--  FinanceApp — Toggle mode pencatatan PIUTANG: kas keluar vs tagihan
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  TUJUAN:
--    createDebt() sebelumnya SELALU mengasumsikan uang sudah berpindah tangan
--    saat catatan piutang dibuat (langsung membuat transaksi pokok + koreksi
--    saldo dompet). Itu benar untuk "aku pinjamkan cash ke orang" — tapi salah
--    untuk piutang berupa TAGIHAN yang belum dibayar (mis. iuran bulanan
--    kelompok/kontrakan): di sana tidak ada uang berpindah sama sekali sampai
--    orangnya benar-benar bayar lewat addPayment().
--
--    Kolom ini menyimpan pilihan user saat membuat catatan piutang, supaya
--    createDebt() tahu apakah harus membuat transaksi pokok + adjustBalance
--    (true, perilaku lama) atau melewatinya sama sekali (false).
--
--  DEFAULT true WAJIB: semua baris lama (dan semua type='payable', yang
--  perilakunya tidak berubah sama sekali) otomatis dianggap "uang sudah
--  berpindah saat dibuat" — sama seperti perilaku sebelum migration ini,
--  tanpa perlu backfill apapun.
-- ════════════════════════════════════════════════════

ALTER TABLE public.debts
ADD COLUMN cash_disbursed_at_creation boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.debts.cash_disbursed_at_creation IS
  'Hanya bermakna untuk type=receivable (piutang). true (default) = uang/barang sudah berpindah tangan saat catatan dibuat -> createDebt() membuat transaksi pokok & menyesuaikan saldo dompet seperti biasa. false = catatan ini baru berupa tagihan yang belum dibayar -> createDebt() TIDAK membuat transaksi/menyentuh saldo; uang baru dicatat & saldo baru disesuaikan saat pembayaran masuk lewat addPayment(). Untuk type=payable (hutang) nilainya selalu true dan tidak ada opsi di UI untuk mengubahnya.';
