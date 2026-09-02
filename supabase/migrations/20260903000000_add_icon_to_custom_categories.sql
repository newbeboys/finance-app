-- ════════════════════════════════════════════════════
--  FinanceApp — Icon picker untuk kategori KUSTOM (custom_categories)
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  TUJUAN:
--    Kategori bawaan (CATEGORIES/INCOME_CATEGORIES di src/data.jsx) sudah
--    punya ikon tetap lewat CatIcon({ kind }) di src/icons.jsx, dikunci ke
--    id kategori itu sendiri (mis. kind="food"). Kategori KUSTOM buatan user
--    tidak punya id yang cocok dengan shape manapun di CatIcon, jadi selama
--    ini SELALU jatuh ke shape fallback "other" (lihat CatIcon: `shapes[kind]
--    || shapes.other`) — tanpa cara bagi user memilih ikon lain.
--
--    Kolom ini menyimpan pilihan ikon eksplisit per kategori kustom (salah
--    satu `kind` yang sudah ada di CatIcon — lihat CUSTOM_CATEGORY_ICONS di
--    src/icons.jsx), dibaca langsung oleh resolveCategory()/CatIcon di semua
--    tempat kategori kustom ditampilkan (Transaksi, Dompet, Anggaran).
--
--  DEFAULT 'other' WAJIB: sama persis dengan shape fallback CatIcon yang
--  sudah dipakai untuk semua kategori kustom sampai sekarang, jadi kolom
--  NOT NULL DEFAULT ini otomatis "mengisi" baris lama tanpa mengubah
--  tampilan mereka sama sekali (tidak perlu backfill/fallback logic di kode).
-- ════════════════════════════════════════════════════

ALTER TABLE public.custom_categories
ADD COLUMN icon text NOT NULL DEFAULT 'other';

COMMENT ON COLUMN public.custom_categories.icon IS
  'Kind icon dari CatIcon (src/icons.jsx) — harus salah satu nilai di CUSTOM_CATEGORY_ICONS (mis. "other", "shopping", "bills", dst). Dipilih user lewat icon picker di CategoryField (saat membuat) / EditCategoryModal (saat edit, tunduk cooldown 30 hari yang sama dengan edit nama/warna). Default "other" = shape fallback CatIcon yang sama seperti sebelum kolom ini ada, supaya baris lama tidak berubah tampilannya.';
