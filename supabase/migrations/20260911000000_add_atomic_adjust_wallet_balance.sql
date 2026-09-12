-- ════════════════════════════════════════════════════
--  FinanceApp — RPC atomik penyesuaian saldo dompet
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  MASALAH YANG DIPERBAIKI:
--    adjustBalance() di src/hooks/useWallets.js melakukan SELECT balance lalu
--    UPDATE balance sebagai dua round-trip terpisah. Nilai baru dihitung di
--    JavaScript (newBalance = balance + delta) lalu ditulis balik sebagai angka
--    mati. Antara SELECT dan UPDATE tidak ada kunci apa pun, jadi dua penulis
--    bersamaan (dua device, atau tab + widget) saling menimpa:
--
--      Device A: SELECT balance → 100.000
--      Device B: SELECT balance → 100.000
--      Device A: UPDATE balance = 100.000 + 50.000  → 150.000
--      Device B: UPDATE balance = 100.000 - 20.000  →  80.000   ← +50.000 HILANG
--
--    Komentar di useWallets.js sudah menyadari sebagian risiko ini dan
--    menanganinya dengan "await sequential, jangan Promise.all" — itu hanya
--    menyelesaikan race ANTAR-PANGGILAN DI SATU KLIEN. Race antar-klien /
--    antar-device tidak bisa diselesaikan dari sisi klien sama sekali.
--
--  SOLUSI:
--    Satu statement UPDATE ... SET balance = balance + delta. Postgres mengunci
--    baris selama UPDATE dan — pada READ COMMITTED — meng-evaluasi ulang
--    ekspresi terhadap versi baris TERBARU bila ada transaksi lain yang commit
--    duluan. Jadi kedua delta di skenario atas dijumlahkan benar (130.000),
--    tanpa perlu SELECT ... FOR UPDATE terpisah (beda dgn check_chat_rate_limit
--    di 20260716000000 yang memang butuh baca-lalu-bercabang sebelum menulis).
--
--  KENAPA SECURITY DEFINER:
--    Supaya nanti anggota dompet bersama (Fitur B) bisa menyesuaikan saldo
--    dompet yang BUKAN miliknya tanpa harus melonggarkan policy RLS
--    "wallets: own data only" untuk SEMUA operasi. Konsekuensinya: fungsi ini
--    berjalan sebagai pemiliknya dan MELEWATI RLS — klausa WHERE di bawah
--    adalah SATU-SATUNYA penjaga akses. Jangan pernah melonggarkannya tanpa
--    mengganti dengan cek yang setara.
--
--    p_wallet_id hanya menunjuk BARIS; identitas selalu diambil dari auth.uid()
--    (JWT terverifikasi), tidak pernah dari argumen — pola sama seperti
--    log_error() dan check_chat_rate_limit(). Jadi user tidak bisa memalsukan
--    dirinya jadi user lain lewat argumen.
--
--  Aman dijalankan berulang (CREATE OR REPLACE + revoke/grant idempoten).
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
  p_wallet_id uuid,
  p_delta     numeric
)
RETURNS numeric
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_new_balance numeric;
BEGIN
  -- Fail-closed: tanpa sesi login, jangan sentuh saldo siapa pun.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'adjust_wallet_balance: tidak ada sesi login'
      USING ERRCODE = '42501';   -- insufficient_privilege
  END IF;

  IF p_wallet_id IS NULL THEN
    RAISE EXCEPTION 'adjust_wallet_balance: p_wallet_id wajib diisi'
      USING ERRCODE = '22004';   -- null_value_not_allowed
  END IF;

  -- INTI ATOMIK: cek akses + kunci baris + hitung + tulis, semuanya dalam SATU
  -- statement. `balance + COALESCE(p_delta, 0)` dihitung oleh Postgres terhadap
  -- baris terkunci, BUKAN oleh klien terhadap angka basi.
  --
  -- ┌─ TITIK PERLUASAN FITUR B (shared wallet) ────────────────────────────┐
  -- │ Saat tabel keanggotaan sudah ada, ganti baris `AND w.user_id = ...`  │
  -- │ di bawah dengan:                                                     │
  -- │                                                                      │
  -- │   AND (                                                              │
  -- │     w.user_id = v_user_id                                            │
  -- │     OR EXISTS (                                                      │
  -- │       SELECT 1 FROM public.wallet_members m                          │
  -- │       WHERE m.wallet_id      = w.id                                  │
  -- │         AND m.member_user_id = v_user_id                             │
  -- │         AND m.status         = 'active'                              │
  -- │     )                                                                │
  -- │   )                                                                  │
  -- │                                                                      │
  -- │ SENGAJA belum ditulis sekarang: tabel wallet_members BELUM ADA.      │
  -- │ Body plpgsql tidak divalidasi saat CREATE FUNCTION, jadi referensi ke │
  -- │ tabel yang belum ada TIDAK gagal saat migrasi — dia gagal saat        │
  -- │ RUNTIME, di SETIAP panggilan, dengan "relation does not exist".       │
  -- │ Artinya: seluruh penyesuaian saldo aplikasi mati total. Tambahkan     │
  -- │ klausa itu SETELAH migrasi wallet_members dijalankan, bukan sebelum.  │
  -- └──────────────────────────────────────────────────────────────────────┘
  UPDATE public.wallets w
  SET    balance = w.balance + COALESCE(p_delta, 0)
  WHERE  w.id      = p_wallet_id
    AND  w.user_id = v_user_id
  RETURNING w.balance INTO v_new_balance;

  -- Tidak ada baris tersentuh = dompet tidak ada ATAU bukan milik pemanggil.
  -- Sengaja TIDAK dibedakan pesannya: membedakan "tidak ada" vs "bukan milikmu"
  -- membocorkan keberadaan dompet user lain kepada penebak UUID.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'adjust_wallet_balance: dompet tidak ditemukan atau tidak dapat diakses'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_new_balance;
END;
$$;

-- ────────────────────────────────────────────────────
-- Grant. Postgres memberi EXECUTE ke PUBLIC secara default saat fungsi dibuat,
-- jadi REVOKE di bawah WAJIB — tanpa itu anon bisa memanggil fungsi
-- SECURITY DEFINER ini (auth.uid() akan NULL dan fungsi menolak, tapi jangan
-- bergantung pada pertahanan lapis dalam saja). Pola sama seperti BAGIAN 3
-- migrasi 20260723010000_harden_functions_search_path_and_grants.sql.
-- ────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.adjust_wallet_balance(uuid, numeric) IS
  'Menambah/mengurangi saldo dompet secara atomik (balance = balance + delta dalam satu UPDATE terkunci), menggantikan pola SELECT-lalu-UPDATE di useWallets.js yang rawan lost update antar-device. Mengembalikan saldo baru. Identitas dari auth.uid(), bukan argumen. SECURITY DEFINER: melewati RLS, klausa WHERE di dalamnya adalah satu-satunya cek akses. Titik perluasan untuk anggota dompet bersama (Fitur B) ditandai di komentar body.';
