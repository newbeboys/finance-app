-- ════════════════════════════════════════════════════
--  FinanceApp — Fitur Catatan Hutang & Piutang
--  Jalankan di Supabase Dashboard → SQL Editor
--  (lihat docs/superpowers/specs/2026-07-04-hutang-piutang-design.md)
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Tabel debts — satu baris per catatan hutang/piutang
--    type = 'receivable' → PIUTANG (uang kamu di orang lain)
--    type = 'payable'    → HUTANG (uang yang kamu pinjam)
--    amount SELALU nilai positif; arah uang ditentukan oleh `type`,
--    bukan tanda minus pada amount.
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text        NOT NULL CHECK (type IN ('receivable', 'payable')),
  person_name  text        NOT NULL,
  note         text                  DEFAULT NULL,   -- keterangan bebas, opsional
  amount       numeric     NOT NULL  CHECK (amount > 0),   -- nilai pokok, selalu positif
  paid         numeric     NOT NULL  DEFAULT 0 CHECK (paid >= 0),   -- akumulasi terbayar
  wallet_id    uuid                  REFERENCES public.wallets(id) ON DELETE SET NULL,
  date         date        NOT NULL  DEFAULT CURRENT_DATE,   -- tanggal terjadinya (lokal, bukan timestamp)
  due_date     date                  DEFAULT NULL,           -- jatuh tempo, opsional
  status       text        NOT NULL  DEFAULT 'active' CHECK (status IN ('active', 'paid')),
  is_deleted   boolean     NOT NULL  DEFAULT false,   -- soft delete: TIDAK pernah hard delete.
                                                       -- Wajib tetap ada di DB agar cooldown 50 hari
                                                       -- (user Basic) tidak bisa diakali hapus-buat-ulang.
  created_at   timestamptz NOT NULL  DEFAULT now(),   -- basis hitung jendela cooldown 50 hari
  updated_at   timestamptz NOT NULL  DEFAULT now()
);

-- ────────────────────────────────────────────────────
-- 2. Tabel debt_payments — riwayat cicilan per catatan debts.
--    Baris di sini TIDAK PERNAH diedit/dihapus manual dari UI —
--    ini murni log historis pembayaran.
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id         uuid        NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric     NOT NULL  CHECK (amount > 0),
  date            date        NOT NULL  DEFAULT CURRENT_DATE,
  note            text                  DEFAULT NULL,
  transaction_id  uuid                  REFERENCES public.transactions(id) ON DELETE CASCADE,
                  -- ↑ tautan ke baris transactions yang dibuat otomatis saat cicilan
                  --   ini disimpan (pemasukan/pengeluaran + penyesuaian saldo dompet).
                  --   Jika transaksi itu dihapus, baris cicilan ini ikut terhapus
                  --   supaya riwayat pembayaran tidak "menggantung".
  created_at      timestamptz NOT NULL  DEFAULT now()
);

-- ────────────────────────────────────────────────────
-- 3. Kolom debt_id di tabel transactions — menautkan baris transaksi
--    ke catatan hutang/piutang asalnya. NULL berarti transaksi biasa
--    (bukan bagian dari fitur hutang/piutang).
--
--    PENTING: transaksi ber-debt_id DIKECUALIKAN dari kuota
--    75 transaksi/bulan milik user Basic — lihat filter
--    `debt_id IS NULL` di useTransactions.js.
-- ────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS debt_id uuid REFERENCES public.debts(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────
-- 4. Indexes
-- ────────────────────────────────────────────────────

-- Daftar hutang/piutang aktif per user (tab Piutang/Hutang/Lunas)
CREATE INDEX IF NOT EXISTS idx_debts_user_status
  ON public.debts (user_id, status);

-- Hitung jendela cooldown 50 hari (created_at, termasuk yang soft-deleted/lunas)
CREATE INDEX IF NOT EXISTS idx_debts_user_created
  ON public.debts (user_id, created_at);

-- Riwayat cicilan per catatan hutang (halaman detail)
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id
  ON public.debt_payments (debt_id);

-- Lookup cicilan dari transaction_id (mis. saat transaksi dihapus manual)
CREATE INDEX IF NOT EXISTS idx_debt_payments_transaction_id
  ON public.debt_payments (transaction_id);

-- Lookup transaksi milik satu catatan hutang (mis. saat hutang dihapus,
-- cari semua transaksi tertaut untuk dihapus + saldo dikoreksi balik)
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id
  ON public.transactions (debt_id);

-- ────────────────────────────────────────────────────
-- 5. Trigger updated_at untuk debts
--    Setiap kali baris debts diubah (mis. `paid` bertambah saat
--    cicilan masuk, atau `status` berubah jadi 'paid'), kolom
--    updated_at otomatis ikut diperbarui.
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_debts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_debts_updated_at ON public.debts;
CREATE TRIGGER trigger_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_debts_updated_at();

-- ────────────────────────────────────────────────────
-- 6. Row Level Security — tabel debts
--    Semua akses (baca/tulis/ubah/hapus) wajib cocok user_id
--    dengan sesi login (auth.uid()). Tanpa ini, user A bisa
--    membaca/mengubah catatan hutang milik user B.
-- ────────────────────────────────────────────────────
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debts_select_own" ON public.debts;
CREATE POLICY "debts_select_own"
  ON public.debts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_insert_own" ON public.debts;
CREATE POLICY "debts_insert_own"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_update_own" ON public.debts;
CREATE POLICY "debts_update_own"
  ON public.debts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debts_delete_own" ON public.debts;
CREATE POLICY "debts_delete_own"
  ON public.debts FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────
-- 7. Row Level Security — tabel debt_payments
-- ────────────────────────────────────────────────────
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debt_payments_select_own" ON public.debt_payments;
CREATE POLICY "debt_payments_select_own"
  ON public.debt_payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "debt_payments_insert_own" ON public.debt_payments;
CREATE POLICY "debt_payments_insert_own"
  ON public.debt_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debt_payments_update_own" ON public.debt_payments;
CREATE POLICY "debt_payments_update_own"
  ON public.debt_payments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debt_payments_delete_own" ON public.debt_payments;
CREATE POLICY "debt_payments_delete_own"
  ON public.debt_payments FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════
-- CATATAN UNTUK Boss Ali:
--  - Kategori "Piutang", "Pembayaran Piutang", "Hutang",
--    "Pembayaran Hutang" TIDAK dibuat di sini — sudah cukup
--    hardcode sebagai kategori bawaan di src/data.jsx, sama
--    seperti kategori bawaan lain (Makanan, Transport, dll).
--  - Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS /
--    DROP POLICY IF EXISTS di semua bagian), jadi kalau ragu
--    sudah pernah dijalankan atau belum, jalankan saja lagi.
-- ════════════════════════════════════════════════════
