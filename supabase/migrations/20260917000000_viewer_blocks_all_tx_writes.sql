-- ════════════════════════════════════════════════════
--  FinanceApp — Shared Wallet: viewer & bekas anggota diblokir dari SEMUA
--  tulisan transaksi di dompet bersama (keputusan produk 12 Sep 2026, opsi d)
--
--  Keputusan ini MENGGANTIKAN (supersede, bukan regresi) dua keputusan lama:
--    - Task 2 #3 / 20260916000000 BAGIAN 2: "bekas anggota / viewer tetap
--      boleh menghapus transaksinya sendiri, pembalikan saldo tidak
--      mensyaratkan peran".
--    - update_transaction yang membebaskan dompet ASAL dari cek peran
--      (viewer/bekas anggota bisa memindahkan transaksinya keluar dari
--      dompet bersama, dan itu menggeser saldo owner).
--
--  Aturan baru, satu kalimat: menulis (insert/update/delete) transaksi di
--  sebuah dompet mensyaratkan wallet_access_role(dompet) IN ('owner','editor')
--  — untuk dompet ASAL maupun TUJUAN, siapa pun pencatat barisnya.
--
--  Transaksi di luar dompet bersama TIDAK berubah perilakunya: wallet_id
--  NOT NULL, dan untuk dompet milik sendiri wallet_access_role() selalu
--  'owner'. Satu-satunya baris yang terdampak adalah transaksi yang dicatat
--  di dompet ORANG LAIN, dan semuanya punya baris wallet_members (dicek
--  12 Sep 2026: 0 baris tanpa keanggotaan).
--
--  TRADE-OFF YANG DISENGAJA (keputusan 12 Sep 2026 #2): transaksi viewer /
--  bekas anggota di dompet owner tidak bisa dihapus SIAPA PUN — pencatatnya
--  ditolak karena peran, owner ditolak karena bukan miliknya (Task 2 #2).
--  Itu desain, bukan bug; tidak ada pengecualian tambahan. Pemulihan hanya
--  lewat owner menaikkan peran kembali ke editor (atau undang ulang).
--  Termasuk transaksi tertaut hutang/piutang: useDebts.deleteDebt membatalkan
--  soft-delete bila ada transaksi tertaut yang gagal dihapus.
--
--  BAGIAN 3 — policy DELETE DIPERSEMPIT, bukan dihapus (keputusan 12 Sep
--  2026, varian B). Build klien lama (main s/d ba03016 — termasuk yang
--  mungkin terpasang di device reviewer Google Play) masih menghapus lewat
--  .delete() langsung lalu adjustBalance terpisah. Kalau policy dihapus,
--  .delete() "berhasil" 0 baris tanpa error untuk transaksi milik sendiri
--  dan saldo tetap digeser → saldo korup (terverifikasi dry-run, uji T26).
--  Dengan policy dipersempit: kasus yang harus berhasil (baris sendiri di
--  dompet owner/editor) tetap 1 baris; viewer/bekas anggota tetap 0 baris.
--
--  Penghapusan total policy DELETE (hapus HANYA lewat delete_transaction)
--  DITUNDA ke migrasi lanjutan, SETELAH dikonfirmasi build berbasis RPC
--  terpasang di semua device yang relevan (lewat rilis Closed Testing baru,
--  bukan asumsi).
-- ════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — delete_transaction
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

  -- Penjaga 1 — kepemilikan baris (Task 2 #2: owner dompet pun tidak bisa
  -- menghapus transaksi anggota).
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

  -- Penjaga 2 — peran di dompetnya (keputusan 12 Sep 2026). Untuk dompet
  -- sendiri selalu 'owner', jadi transaksi non-bersama tidak terdampak.
  -- Pesan boleh spesifik: pemanggil sudah terbukti pemilik baris.
  IF COALESCE(public.wallet_access_role(v_tx.wallet_id), '') NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION 'delete_transaction: dompet ini hanya bisa dibaca atau sudah kamu tinggalkan'
      USING ERRCODE = '42501';
  END IF;

  -- wallet_id NOT NULL + FK ON DELETE CASCADE: dompetnya pasti ada selama
  -- barisnya ada. Besar pembalikan diambil dari baris, bukan argumen.
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
  'Menghapus transaksi milik pemanggil DAN membalik efeknya ke saldo dompet dalam satu transaksi Postgres. Syarat: user_id pemanggil (owner dompet pun tidak bisa menghapus transaksi anggota) DAN wallet_access_role(dompetnya) owner/editor — viewer & bekas anggota ditolak (keputusan 12 Sep 2026, menggantikan Task 2 #3). Jalur hapus resmi klien; policy DELETE mencerminkan syarat yang sama (dipertahankan sementara untuk build klien lama). Besar pembalikan diambil dari baris, bukan argumen. Mengembalikan {wallet_id, balance}.';

-- ════════════════════════════════════════════════════
--  BAGIAN 2 — update_transaction
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

  -- Cerminan policy UPDATE USING (bagian kepemilikan): hanya baris milik pemanggil.
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_transaction: transaksi tidak ditemukan atau bukan milikmu'
      USING ERRCODE = '42501';
  END IF;

  -- Cerminan policy UPDATE USING (bagian peran): dompet ASAL harus boleh
  -- ditulisi. Menarik efek lama dari dompet asal juga menulis saldonya —
  -- sejak 12 Sep 2026 tidak lagi dibebaskan dari cek peran, jadi viewer /
  -- bekas anggota tidak bisa memindahkan transaksinya keluar.
  IF COALESCE(public.wallet_access_role(v_tx.wallet_id), '') NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION 'update_transaction: dompet ini hanya bisa dibaca atau sudah kamu tinggalkan'
      USING ERRCODE = '42501';
  END IF;

  v_new_wallet := COALESCE(p_wallet_id, v_tx.wallet_id);

  -- Cerminan policy UPDATE WITH CHECK: dompet TUJUAN harus boleh ditulisi.
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
  'Mengubah transaksi milik pemanggil DAN memindahkan efeknya di saldo (tarik amount lama dari dompet asal, terapkan amount baru ke dompet tujuan) dalam satu transaksi Postgres. Akses baris = user_id pemanggil. Dompet ASAL dan TUJUAN keduanya wajib owner/editor aktif (keputusan 12 Sep 2026 — viewer & bekas anggota tidak bisa mengubah maupun memindahkan transaksinya). p_date/p_time NULL = nilai lama dipertahankan. Mengembalikan baris hasil update.';

-- ════════════════════════════════════════════════════
--  BAGIAN 3 — policy DELETE dipersempit ke peran owner/editor (varian B)
--  Cerminan persis delete_transaction. Nama policy dipertahankan.
-- ════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transactions: delete own row" ON public.transactions;
CREATE POLICY "transactions: delete own row"
  ON public.transactions FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    AND COALESCE(public.wallet_access_role(wallet_id), '') IN ('owner', 'editor')
  );

-- ════════════════════════════════════════════════════
--  BAGIAN 4 — policy UPDATE: USING ikut mengecek peran di dompet ASAL
--  (defense in depth; WITH CHECK tetap mengecek dompet TUJUAN).
--  wallet_access_role() SECURITY DEFINER — aman dari rekursi RLS.
-- ════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transactions: update own row" ON public.transactions;
CREATE POLICY "transactions: update own row"
  ON public.transactions FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND COALESCE(public.wallet_access_role(wallet_id), '') IN ('owner', 'editor')
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.wallet_access_role(wallet_id) IN ('owner', 'editor')
  );
