-- ════════════════════════════════════════════════════
--  FinanceApp — RPC atomik: catat transaksi + sesuaikan saldo sekaligus
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  MASALAH YANG DIPERBAIKI:
--    adjust_wallet_balance (20260911000000) sudah membuat penyesuaian saldo
--    atomik PER DIRINYA SENDIRI, tapi alur "catat transaksi" tetap dua
--    round-trip terpisah: INSERT transactions lalu RPC saldo. Di antara
--    keduanya aplikasi bisa mati (proses Android dibunuh, sinyal putus) dan
--    menyisakan transaksi tanpa perubahan saldo.
--
--    Fungsi ini menggabungkan keduanya. Body plpgsql berjalan dalam SATU
--    transaksi Postgres, jadi UPDATE saldo dan INSERT transaksi commit
--    bersama atau batal bersama — tidak ada jendela gagal di tengah, dan
--    tidak perlu compensating write (reverse) yang belum tentu sempat jalan.
--
--  KONVENSI TANDA `amount` — PENTING:
--    amount SUDAH BERTANDA di aplikasi ini: negatif = pengeluaran, positif =
--    pemasukan (lihat useTransactions.js, `type: tx.amount < 0 ? 'expense' :
--    'income'`). Jadi saldo cukup `balance + p_amount`, TANPA CASE WHEN
--    income/expense. Memakai `CASE WHEN type='income' THEN +amount ELSE
--    -amount` akan membalik tanda pengeluaran dua kali → belanja justru
--    MENAMBAH saldo. Kolom `type` di bawah diturunkan dari tanda amount
--    (bukan dari parameter terpisah) supaya baris tidak akan pernah bisa
--    menyimpan type yang bertentangan dengan amount-nya.
--
--  KONVENSI TANGGAL:
--    p_date bertipe `date` (bukan timestamp) dan WAJIB diisi klien. Kolom
--    transactions.date menyimpan tanggal kalender LOKAL (WIB), bukan
--    timestamp UTC. Sengaja TIDAK ada fallback ke CURRENT_DATE: CURRENT_DATE
--    di server Supabase adalah UTC, yang untuk WIB (UTC+7) salah satu hari
--    setiap malam sebelum jam 07:00. Klien sudah menghitung tanggal lokalnya
--    sendiri — biarkan itu satu-satunya sumber.
--
--  KENAPA TIDAK ADA p_user_id:
--    Identitas SELALU dari auth.uid() (JWT terverifikasi), tidak pernah dari
--    argumen. Menerima p_user_id pada fungsi SECURITY DEFINER membuka IDOR —
--    pemanggil tinggal mengirim uuid orang lain. Pola sama dgn log_error(),
--    check_chat_rate_limit(), adjust_wallet_balance(), dan edge function
--    financial-chat yang juga menolak user_id dari request body.
--
--  Aman dijalankan berulang (CREATE OR REPLACE + revoke/grant idempoten).
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_transaction(
  p_amount    numeric,
  p_category  text,
  p_date      date,
  p_wallet_id uuid DEFAULT NULL,
  p_merchant  text DEFAULT '',
  p_note      text DEFAULT '',
  p_time      text DEFAULT '00:00',
  p_method    text DEFAULT 'Tunai',
  p_debt_id   uuid DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tx_id   uuid;
BEGIN
  -- Fail-closed: tanpa sesi login, jangan menulis apa pun.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'record_transaction: tidak ada sesi login'
      USING ERRCODE = '42501';   -- insufficient_privilege
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'record_transaction: p_amount wajib diisi dan tidak boleh 0'
      USING ERRCODE = '22004';
  END IF;

  -- Lihat "KONVENSI TANGGAL" di header: tidak ada fallback UTC yang diam-diam.
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'record_transaction: p_date wajib diisi klien (tanggal lokal WIB)'
      USING ERRCODE = '22004';
  END IF;

  -- Transaksi boleh tidak terikat dompet (wallet_id nullable). Kalau terikat,
  -- saldo disesuaikan di sini — dalam transaksi yang sama dengan INSERT di bawah.
  --
  -- SECURITY DEFINER melewati RLS, jadi `w.user_id = v_user_id` di WHERE adalah
  -- SATU-SATUNYA penjaga akses dompet. Jangan dilonggarkan tanpa pengganti setara.
  --
  -- ┌─ TITIK PERLUASAN FITUR B (shared wallet) ────────────────────────────┐
  -- │ Sama seperti adjust_wallet_balance: tambahkan OR EXISTS(...          │
  -- │ wallet_members ... status='active') di sini SETELAH tabel            │
  -- │ wallet_members benar-benar dibuat — body plpgsql tidak divalidasi    │
  -- │ saat CREATE, jadi referensi ke tabel yang belum ada baru meledak     │
  -- │ saat runtime, di setiap panggilan.                                   │
  -- └──────────────────────────────────────────────────────────────────────┘
  IF p_wallet_id IS NOT NULL THEN
    UPDATE public.wallets w
    SET    balance = w.balance + p_amount
    WHERE  w.id      = p_wallet_id
      AND  w.user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_transaction: dompet tidak ditemukan atau tidak dapat diakses'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- debt_id ikut diverifikasi kepemilikannya: RLS dilewati di sini, jadi tanpa
  -- cek ini sebuah transaksi bisa ditautkan ke catatan hutang milik user lain
  -- kalau uuid-nya tertebak.
  IF p_debt_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.debts d
      WHERE d.id = p_debt_id AND d.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'record_transaction: catatan hutang tidak ditemukan atau tidak dapat diakses'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.transactions (
    user_id, type, amount, category, merchant, note,
    date, time, method, wallet_id, debt_id
  )
  VALUES (
    v_user_id,
    -- Diturunkan dari tanda amount, bukan parameter terpisah — lihat header.
    CASE WHEN p_amount < 0 THEN 'expense' ELSE 'income' END,
    p_amount,
    p_category,
    COALESCE(p_merchant, ''),
    COALESCE(p_note, ''),
    p_date,
    COALESCE(p_time, '00:00'),
    COALESCE(p_method, 'Tunai'),
    p_wallet_id,
    p_debt_id
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ────────────────────────────────────────────────────
-- Grant. Postgres memberi EXECUTE ke PUBLIC secara default saat fungsi dibuat,
-- jadi REVOKE di bawah WAJIB. Pola sama seperti BAGIAN 3 migrasi
-- 20260723010000_harden_functions_search_path_and_grants.sql.
-- ────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) IS
  'Mencatat satu transaksi DAN menyesuaikan saldo dompetnya dalam satu transaksi Postgres (atomik, tanpa compensating write). amount bertanda: negatif=pengeluaran; kolom type diturunkan dari tandanya. p_date wajib tanggal lokal WIB dari klien. Identitas dari auth.uid(), bukan argumen. Mengembalikan id transaksi baru. CATATAN: kuota transaksi/bulan plan Basic TIDAK dicek di sini — gating tetap di useTransactions.createTransaction (src/lib/planLimits.js sebagai sumber tunggal).';
