-- ============================================================
-- Tambah kolom deadline_date ke tabel savings.
-- Kolom ini menyimpan tanggal deadline dalam format ISO (YYYY-MM-DD)
-- untuk keperluan sorting/filtering di backend. Tidak menggantikan
-- deadline_label (teks) yang sudah ada. Nullable karena user bisa
-- memilih "Tanpa tenggat"; existing rows akan bernilai NULL.
-- ============================================================

ALTER TABLE savings
ADD COLUMN deadline_date DATE NULL;
