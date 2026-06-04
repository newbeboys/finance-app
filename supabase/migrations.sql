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
