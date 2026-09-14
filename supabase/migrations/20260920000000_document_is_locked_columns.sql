-- ════════════════════════════════════════════════════
--  FinanceApp — Dokumentasi kolom is_locked (wallets/savings/custom_categories)
--  Jalankan di Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════
--
--  Konteks: ketiga kolom is_locked di bawah ini SUDAH ADA di database
--  produksi, tapi tidak ada satu pun file SQL di repo (schema.sql,
--  migrations.sql, atau supabase/migrations/*) yang membuatnya —
--  kemungkinan dibuat manual lewat SQL Editor dan tidak pernah dicatat.
--  Baru kolom is_locked milik tabel debts yang tercatat, di migration
--  20260705000000_add_is_locked_to_debts.sql.
--
--  Migration ini menutup schema drift tersebut: kalau database
--  dibangun ulang dari nol lewat folder migrations/, tiga kolom ini
--  ikut lahir. Semua statement idempoten (IF NOT EXISTS) dan tidak
--  mengubah data yang sudah ada — di produksi, ADD COLUMN IF NOT
--  EXISTS jadi no-op karena kolomnya sudah ada.

-- ────────────────────────────────────────────────────
--  Kolom is_locked di tabel wallets — sama seperti savings/
--  custom_categories/debts. Saat Pro → Basic, dompet yang melebihi
--  limit Basic TIDAK dihapus, melainkan dikunci (is_locked=true).
--  Urutan: dompet PALING LAMA (created_at ASC) tetap aktif, sisanya
--  dikunci (lihat reconcileTable() di src/lib/planReconciliation.js).
--  Saat Basic → Pro, semua dibuka lagi (unlockAllOnUpgrade()).
--
--  Data lama otomatis dianggap tidak terkunci (DEFAULT false).
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS).
-- ────────────────────────────────────────────────────
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────
--  Kolom is_locked di tabel savings — sama seperti wallets/
--  custom_categories/debts. Saat Pro → Basic, target tabungan yang
--  melebihi limit Basic TIDAK dihapus, melainkan dikunci
--  (is_locked=true). Urutan: target PALING LAMA (created_at ASC)
--  tetap aktif, sisanya dikunci (lihat reconcileTable() di
--  src/lib/planReconciliation.js). Saat Basic → Pro, semua dibuka
--  lagi (unlockAllOnUpgrade()).
--
--  Data lama otomatis dianggap tidak terkunci (DEFAULT false).
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS).
-- ────────────────────────────────────────────────────
ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────
--  Kolom is_locked di tabel custom_categories — sama seperti
--  wallets/savings/debts. Saat Pro → Basic, kategori kustom yang
--  melebihi limit Basic TIDAK dihapus, melainkan dikunci
--  (is_locked=true). Urutan: kategori PALING LAMA (created_at ASC)
--  tetap aktif, sisanya dikunci — dihitung hanya dari baris yang
--  belum soft-deleted (is_deleted=false), lihat reconcileTable()
--  di src/lib/planReconciliation.js. Saat Basic → Pro, semua
--  dibuka lagi (unlockAllOnUpgrade()).
--
--  Data lama otomatis dianggap tidak terkunci (DEFAULT false).
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS).
-- ────────────────────────────────────────────────────
ALTER TABLE public.custom_categories
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
