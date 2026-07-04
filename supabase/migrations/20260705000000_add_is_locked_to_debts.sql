-- ════════════════════════════════════════════════════
--  FinanceApp — Lock-on-Downgrade untuk Catatan Hutang & Piutang
--  Jalankan di Supabase Dashboard → SQL Editor
--  (lihat docs/superpowers/specs/2026-07-04-hutang-piutang-design.md)
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
--  Kolom is_locked di tabel debts — sama seperti wallets/savings/
--  custom_categories. Saat Pro → Basic, catatan aktif yang melebihi
--  limit Basic (5) TIDAK dihapus, melainkan dikunci (is_locked=true).
--  Urutan: 5 catatan PALING LAMA (created_at ASC) tetap aktif,
--  sisanya dikunci. Saat Basic → Pro, semua dibuka lagi.
--
--  Data lama otomatis dianggap tidak terkunci (DEFAULT false).
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS).
-- ────────────────────────────────────────────────────
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
