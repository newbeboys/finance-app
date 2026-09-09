-- ════════════════════════════════════════════════════
--  FinanceApp — Anggaran per dompet (budgets.wallet_id)
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  TUJUAN:
--    Sampai sekarang satu kategori hanya bisa punya SATU anggaran, dan
--    anggaran itu selalu menghitung pengeluaran dari SEMUA dompet. Kolom ini
--    memungkinkan anggaran dikunci ke satu dompet: getBudgetSpent()
--    (src/lib/budgetSpent.js) hanya menjumlahkan transaksi dompet tersebut
--    (transaksi tanpa wallet_id dianggap milik dompet utama).
--
--  NULL = anggaran umum / berlaku untuk semua dompet — inilah nilai untuk
--  semua baris lama, jadi perilakunya persis seperti sebelum kolom ini ada
--  (tidak perlu backfill).
--
--  ON DELETE SET NULL: dompet dihapus → anggarannya tidak ikut hilang, cuma
--  berubah jadi anggaran umum. Lebih aman daripada CASCADE yang diam-diam
--  menghapus anggaran user.
--
--  IF NOT EXISTS: aman dijalankan berulang / di database yang sudah sempat
--  dipatch manual (hindari drift seperti 2-3 September).
-- ════════════════════════════════════════════════════

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.budgets.wallet_id IS
  'Dompet yang dicakup anggaran ini. NULL = anggaran umum (semua dompet) — nilai default & satu-satunya nilai untuk baris sebelum migrasi ini. Diisi dari selector Dompet di AddBudgetModal (hanya tampil bila user punya >1 dompet). Satu kategori boleh punya beberapa anggaran selama dompetnya berbeda; anggaran umum dan anggaran per-dompet untuk kategori yang sama saling mengunci (lihat isCategoryBlocked di src/budgets-page.jsx).';
