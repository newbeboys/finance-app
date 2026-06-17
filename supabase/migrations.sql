-- ════════════════════════════════════════════════════
--  Jalankan di Supabase SQL Editor setelah schema.sql
-- ════════════════════════════════════════════════════

-- savings: tambah kolom deadline sebagai text + fix icon default
ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS deadline_label text NOT NULL DEFAULT 'Tanpa tenggat';

ALTER TABLE public.savings
  ALTER COLUMN icon SET DEFAULT 'star';

-- wallets: tambah kolom color dan last4
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#5C6B4C';

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS last4 text NOT NULL DEFAULT '—';

-- transactions: pastikan kolom tanggal ada (untuk fitur "pilih tanggal" di Catat Transaksi)
-- Tanggal yang dipilih user disimpan di sini, dipakai untuk laporan (bukan tanggal sistem).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE;

-- custom_categories: tambah kolom type agar kategori income & expense dipisah tampilannya.
-- Limit tetap gabungan (Basic: maks 3, dihitung dari total income + expense).
-- Default 'expense' agar data lama (tanpa type) otomatis masuk ke expense.
ALTER TABLE public.custom_categories
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense';
