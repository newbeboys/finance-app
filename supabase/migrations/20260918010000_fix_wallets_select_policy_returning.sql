-- ════════════════════════════════════════════════════
--  FinanceApp — PERBAIKAN BUG P0: membuat dompet baru SELALU gagal 42501
--  "new row violates row-level security policy for table wallets".
--
--  DAMPAK SEBELUM PERBAIKAN: tidak ada satu pun user yang bisa membuat
--  dompet — Basic maupun Pro, akun lama maupun baru. Fitur berbayar
--  "dompet tanpa batas" mati total. Terverifikasi di produksi 12 Sep 2026.
--
--  ┌─ AKAR MASALAH ────────────────────────────────────────────────────────┐
--  │ Klien memanggil `.insert(...).select()`, yang membuat PostgREST       │
--  │ mengirim INSERT ... RETURNING. Pada INSERT ber-RETURNING, Postgres    │
--  │ ikut menerapkan policy SELECT pada baris yang dikembalikan.           │
--  │                                                                       │
--  │ Policy SELECT `wallets` sejak migrasi 20260912000000 berbunyi:        │
--  │     USING (wallet_access_role(id) IS NOT NULL)                        │
--  │                                                                       │
--  │ wallet_access_role() bersifat STABLE, dan di dalamnya melakukan       │
--  │ SELECT ... FROM wallets WHERE id = p_wallet_id. Fungsi STABLE memakai │
--  │ snapshot milik query pemanggil, sehingga TIDAK BISA MELIHAT baris     │
--  │ yang baru saja disisipkan oleh perintah yang sama. Hasilnya NULL →    │
--  │ policy SELECT gagal → INSERT ditolak.                                 │
--  │                                                                       │
--  │ Pesan errornya menyesatkan: teksnya sama persis dengan kegagalan      │
--  │ WITH CHECK, sehingga terlihat seperti masalah identitas (user_id vs   │
--  │ auth.uid()) padahal identitasnya sama sekali tidak salah.             │
--  └───────────────────────────────────────────────────────────────────────┘
--
--  DIISOLASI DI SERVER (12 Sep 2026), sebagai role `authenticated` tanpa
--  BYPASSRLS, dalam transaksi yang di-rollback:
--      INSERT polos             → BERHASIL
--      INSERT ... RETURNING id  → GAGAL 42501, pesan identik
--  Satu-satunya variabel yang berbeda adalah RETURNING.
--
--  KENAPA HANYA `wallets` YANG KENA: tabel lain punya cabang perbandingan
--  KOLOM LANGSUNG di policy SELECT-nya (`auth.uid() = user_id`), yang
--  dievaluasi pada baris yang dikembalikan itu sendiri tanpa perlu mencari
--  ulang ke tabel. `transactions` bahkan sudah memakai bentuk yang benar
--  (`user_id = auth.uid() OR wallet_access_role(...) IS NOT NULL`) — cabang
--  pertamanya lolos duluan, jadi tidak pernah kena. `wallets` adalah
--  satu-satunya yang kehilangan cabang itu saat 20260912000000 mengganti
--  policy lama "wallets: own data only".
--
--  UPDATE dan DELETE tidak terpengaruh: barisnya sudah ada di snapshot, jadi
--  wallet_access_role() bisa menemukannya seperti biasa.
-- ════════════════════════════════════════════════════

DROP POLICY IF EXISTS "wallets: read own or member" ON public.wallets;

CREATE POLICY "wallets: read own or member"
  ON public.wallets FOR SELECT
  USING (
    -- CABANG 1 — pemilik. WAJIB berupa perbandingan kolom langsung, dan WAJIB
    -- berada di depan. Ini yang membuat INSERT ... RETURNING lolos: nilainya
    -- dibaca dari baris yang sedang dikembalikan, bukan dicari ulang ke tabel
    -- (yang tidak akan menemukannya di dalam perintah yang sama).
    --
    -- JANGAN menyederhanakan policy ini kembali menjadi hanya panggilan
    -- wallet_access_role(). Itu persis bug yang diperbaiki migrasi ini.
    user_id = (SELECT auth.uid())

    -- CABANG 2 — anggota dompet bersama. Tetap lewat helper SECURITY DEFINER:
    -- membaca `wallet_members` langsung di sini akan membuat rekursi policy
    -- (lihat catatan panjang di 20260912000000). Cabang ini hanya dievaluasi
    -- untuk baris milik ORANG LAIN, karena OR sudah pendek di cabang 1 —
    -- efek sampingnya: baris milik sendiri tidak lagi memanggil fungsi ini
    -- per baris, jadi query daftar dompet juga sedikit lebih murah.
    OR public.wallet_access_role(id) IS NOT NULL
  );

COMMENT ON POLICY "wallets: read own or member" ON public.wallets IS
  'Pemilik ATAU anggota aktif boleh membaca. Cabang pemilik sengaja berupa perbandingan kolom langsung dan diletakkan PERTAMA: policy SELECT ikut dievaluasi pada INSERT ... RETURNING, dan wallet_access_role() (STABLE) tidak bisa melihat baris yang baru disisipkan oleh perintah yang sama — tanpa cabang ini, pembuatan dompet selalu gagal 42501.';
