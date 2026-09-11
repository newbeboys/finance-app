-- ════════════════════════════════════════════════════
--  FinanceApp — Shared Wallet: transaksi hutang tetap privat + hapus/edit
--  transaksi atomik (Task 4, keputusan produk 11 Sep 2026)
--
--  BAGIAN 1 — Transaksi ber-debt_id TIDAK ikut terlihat oleh anggota dompet.
--    Keputusan Task 2 #4: hutang/piutang PRIBADI. Tabel `debts` sudah
--    terlindungi, tapi transaksi pokok/cicilan yang dicatat di dompet bersama
--    ikut terbaca anggota lewat cabang wallet_access_role() di policy SELECT
--    `transactions` — lengkap dengan nama orang di `merchant`, `note`, dan
--    `debt_id`. Cabang itu kini mensyaratkan `debt_id IS NULL`. Cabang
--    `user_id = auth.uid()` tidak berubah: pencatat selalu melihat
--    transaksinya sendiri, termasuk yang tertaut hutang.
--
--    Keputusan terkait (TIDAK mengubah SQL): anggota baru BOLEH melihat
--    riwayat dompet sebelum dia bergabung — policy memang tidak memfilter
--    tanggal, dan itu disengaja. Pengecualian hanya transaksi ber-debt_id di
--    atas, yang privat selamanya.
--
--  BAGIAN 2 — delete_transaction / update_transaction (RPC atomik).
--    Sebelumnya klien menghapus/mengubah baris lalu memanggil
--    adjust_wallet_balance TERPISAH. adjust_wallet_balance mensyaratkan
--    peran owner/editor yang AKTIF, sedangkan policy DELETE `transactions`
--    cukup `user_id = auth.uid()` (keputusan Task 2 #3: transaksi anggota
--    tetap miliknya setelah dia keluar). Akibatnya bekas anggota / viewer
--    bisa menghapus transaksinya tapi saldo dompet TIDAK ikut dibalik
--    (terverifikasi di server: baris hilang, saldo owner tetap memuat -1000).
--
--    Keputusan: JANGAN persempit RLS UPDATE/DELETE ke peran (itu membalik
--    Task 2 #3). Perbaikannya di RPC: pembalikan saldo untuk transaksi milik
--    sendiri TIDAK mensyaratkan wallet_access_role aktif — cukup baris itu
--    memang ber-user_id pemanggil. Besar pembalikan DITURUNKAN DARI BARIS
--    (amount lama), bukan dari argumen klien, jadi RPC ini tidak bisa dipakai
--    menggerakkan saldo sembarang angka.
--
--    Menempatkan dana BARU ke sebuah dompet (update_transaction ke dompet
--    tujuan) tetap mensyaratkan owner/editor — sama dengan WITH CHECK policy
--    UPDATE `transactions` yang sudah ada.
--
--    Efek samping yang disengaja: rollback di useDebts.addPayment (hapus
--    transaksi cicilan saat insert debt_payments gagal) sekarang ikut
--    membalik saldo. Dulu transaksinya terhapus tapi efek record_transaction
--    ke saldo tertinggal.
-- ════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — Policy SELECT transactions
-- ════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transactions: read own or wallet" ON public.transactions;
CREATE POLICY "transactions: read own or wallet"
  ON public.transactions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    -- Transaksi tertaut hutang/piutang TIDAK pernah dibagikan ke anggota
    -- dompet (Task 2 #4), sekalipun dompetnya dibagikan.
    OR (debt_id IS NULL AND public.wallet_access_role(wallet_id) IS NOT NULL)
  );

-- ════════════════════════════════════════════════════
--  BAGIAN 2a — delete_transaction
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tx      public.transactions%ROWTYPE;
  v_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_transaction: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- SECURITY DEFINER melewati RLS: klausa `user_id = v_user_id` ini SATU-
  -- SATUNYA penjaga akses, dan cerminan persis policy DELETE (keputusan
  -- Task 2 #2: owner pun tidak bisa menghapus transaksi anggota).
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  -- RAISE aman: belum ada yang ditulis. Pesan sengaja tidak membedakan
  -- "tidak ada" vs "milik orang lain" (pola adjust_wallet_balance).
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delete_transaction: transaksi tidak ditemukan atau bukan milikmu'
      USING ERRCODE = '42501';
  END IF;

  -- Pembalikan saldo TANPA cek wallet_access_role — lihat header BAGIAN 2.
  -- wallet_id NOT NULL + FK ON DELETE CASCADE: dompetnya pasti ada selama
  -- barisnya ada.
  UPDATE public.wallets
  SET    balance = balance - v_tx.amount
  WHERE  id = v_tx.wallet_id
  RETURNING balance INTO v_balance;

  DELETE FROM public.transactions WHERE id = v_tx.id;

  RETURN jsonb_build_object('wallet_id', v_tx.wallet_id, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_transaction(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.delete_transaction(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_transaction(uuid) IS
  'Menghapus transaksi milik pemanggil DAN membalik efeknya ke saldo dompet dalam satu transaksi Postgres. Akses = user_id pemanggil saja (owner dompet pun tidak bisa menghapus transaksi anggota). Pembalikan saldo SENGAJA tidak mensyaratkan peran aktif di dompet: bekas anggota/viewer tetap bisa menghapus transaksinya sendiri (Task 2 #3) dan saldo ikut benar. Besar pembalikan diambil dari baris, bukan argumen. Mengembalikan {wallet_id, balance}.';

-- ════════════════════════════════════════════════════
--  BAGIAN 2b — update_transaction
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_transaction(
  p_transaction_id uuid,
  p_amount         numeric,
  p_category       text,
  p_wallet_id      uuid,
  p_merchant       text DEFAULT '',
  p_note           text DEFAULT '',
  p_method         text DEFAULT 'Tunai',
  p_date           date DEFAULT NULL,   -- NULL = tanggal lama dipertahankan (BUKAN CURRENT_DATE/UTC)
  p_time           text DEFAULT NULL    -- NULL = jam lama dipertahankan
)
RETURNS public.transactions
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_tx         public.transactions%ROWTYPE;
  v_new_wallet uuid;
  v_row        public.transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'update_transaction: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'update_transaction: p_amount wajib diisi dan tidak boleh 0' USING ERRCODE = '22004';
  END IF;

  -- Cerminan policy UPDATE USING: hanya baris milik pemanggil.
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_transaction: transaksi tidak ditemukan atau bukan milikmu'
      USING ERRCODE = '42501';
  END IF;

  v_new_wallet := COALESCE(p_wallet_id, v_tx.wallet_id);

  -- Cerminan policy UPDATE WITH CHECK: dompet TUJUAN harus boleh ditulisi.
  -- Menaruh dana ke dompet tetap butuh owner/editor aktif; hanya MENARIK
  -- efek lama dari dompet asal yang dibebaskan dari cek peran.
  IF COALESCE(public.wallet_access_role(v_new_wallet), '') NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION 'update_transaction: dompet tujuan tidak ditemukan atau tidak dapat diakses'
      USING ERRCODE = '42501';
  END IF;

  -- Kunci kedua dompet dalam urutan id yang tetap, supaya dua edit bersamaan
  -- yang memindahkan transaksi berlawanan arah tidak saling deadlock.
  PERFORM 1 FROM public.wallets
  WHERE id IN (v_tx.wallet_id, v_new_wallet)
  ORDER BY id
  FOR UPDATE;

  IF v_new_wallet = v_tx.wallet_id THEN
    UPDATE public.wallets
    SET    balance = balance - v_tx.amount + p_amount
    WHERE  id = v_new_wallet;
  ELSE
    -- Tarik efek lama dari dompet asal — TANPA cek peran (baris milik sendiri).
    UPDATE public.wallets SET balance = balance - v_tx.amount WHERE id = v_tx.wallet_id;
    UPDATE public.wallets SET balance = balance + p_amount    WHERE id = v_new_wallet;
  END IF;

  UPDATE public.transactions
  SET    type      = CASE WHEN p_amount < 0 THEN 'expense' ELSE 'income' END,
         amount    = p_amount,
         category  = COALESCE(p_category, v_tx.category),
         merchant  = COALESCE(p_merchant, ''),
         note      = COALESCE(p_note, ''),
         method    = COALESCE(p_method, 'Tunai'),
         wallet_id = v_new_wallet,
         date      = COALESCE(p_date, v_tx.date),
         time      = COALESCE(p_time, v_tx.time)
  WHERE  id = v_tx.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_transaction(uuid, numeric, text, uuid, text, text, text, date, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_transaction(uuid, numeric, text, uuid, text, text, text, date, text) TO authenticated;

COMMENT ON FUNCTION public.update_transaction(uuid, numeric, text, uuid, text, text, text, date, text) IS
  'Mengubah transaksi milik pemanggil DAN memindahkan efeknya di saldo (tarik amount lama dari dompet asal, terapkan amount baru ke dompet tujuan) dalam satu transaksi Postgres. Akses baris = user_id pemanggil. Dompet tujuan wajib owner/editor aktif (cerminan WITH CHECK policy UPDATE); penarikan dari dompet asal tidak mensyaratkan peran. p_date/p_time NULL = nilai lama dipertahankan. Mengembalikan baris hasil update.';
