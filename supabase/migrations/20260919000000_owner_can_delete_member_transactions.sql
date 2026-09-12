-- ════════════════════════════════════════════════════
--  FinanceApp — Shared Wallet: OWNER boleh MENGHAPUS transaksi anggotanya
--  (keputusan produk 13 Sep 2026)
--
--  Keputusan ini MEMBALIK Task 2 #2 ("owner pun tidak bisa menghapus
--  transaksi anggota") dan mencabut trade-off yang dicatat di header
--  20260917000000 baris 23-29 ("transaksi viewer / bekas anggota di dompet
--  owner tidak bisa dihapus SIAPA PUN ... Itu desain, bukan bug").
--
--  PENDORONGNYA: transaksi yang pencatatnya sudah keluar dari dompet
--  (wallet_members.status='left') terkunci PERMANEN. Pencatatnya ditolak
--  karena wallet_access_role() mengembalikan NULL untuknya, dan owner ditolak
--  karena barisnya bukan miliknya. Dompetnya jadi menyimpan baris yang
--  membebani saldo owner tanpa ada satu pun pihak yang bisa membereskannya.
--  Pemulihan lewat "owner menaikkan peran kembali ke editor" tidak berlaku
--  untuk bekas anggota yang sudah tidak mau/bisa diundang lagi.
--
--  ATURAN BARU, satu kalimat: sebuah transaksi boleh dihapus oleh
--  PENCATATNYA (syarat peran lama tetap berlaku) ATAU oleh OWNER dompet
--  tempat baris itu berada.
--
--  DUA HAL YANG SENGAJA **TIDAK** IKUT DILONGGARKAN:
--
--  1. MENGUBAH (update_transaction & policy UPDATE) tetap "hanya baris
--     sendiri". Menghapus itu pembersihan yang efeknya persis membatalkan
--     baris + mengembalikan saldo; mengedit berarti menulis ulang catatan
--     keuangan atas nama orang lain, dan owner tidak punya alasan sah untuk
--     itu. Klien mencerminkannya: canEditTransaction TIDAK lagi memanggil
--     canDeleteTransaction (lib/walletAccess.js).
--
--  2. Baris ber-`debt_id` (transaksi dari fitur Hutang/Piutang) DIKECUALIKAN
--     dari cabang owner. Baris itu tidak pernah terlihat owner sejak
--     20260916000000 (policy SELECT + filter excludeDebt di klien), jadi
--     mengizinkannya berarti memberi hak atas baris yang bahkan tidak bisa
--     dia lihat, dan menghapusnya di luar useDebts.deleteDebt membuat catatan
--     hutangnya tidak konsisten. Pencatatnya sendiri TIDAK terdampak — dia
--     lewat cabang 1, yang tidak menyentuh debt_id sama sekali.
--
--  Peran yang dievaluasi wallet_access_role() di sini adalah peran
--  PENGHAPUS (auth.uid()), bukan peran pencatat baris. Fungsi itu memang
--  tidak pernah menerima identitas pencatat. Karena itu aturan baru ini
--  otomatis mencakup baris milik anggota aktif MAUPUN bekas anggota
--  (status='left') tanpa perlu klausa status tambahan.
-- ════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — policy DELETE: tambah DISJUNCT terpisah
--
--  Bentuknya DUA disjunct yang masing-masing dikurung penuh, BUKAN satu OR
--  yang diselipkan ke dalam AND yang sudah ada. Kalau `OR wallet_access_role
--  (wallet_id) = 'owner'` ditempel di dalam conjunct yang sama, presedensi
--  AND/OR membuat cek `user_id` ikut hilang untuk seluruh ekspresi — yaitu
--  melonggarkan jauh lebih banyak daripada yang dimaksud. Dikurung begini,
--  cabang lama tetap utuh apa adanya dan cabang baru berdiri sendiri.
--
--  Policy ini tetap DIPERSEMPIT, bukan dihapus — alasan varian B di header
--  20260917000000 (build klien lama yang masih .delete() langsung) belum
--  berubah. TODO lamanya masih berlaku.
-- ════════════════════════════════════════════════════
DROP POLICY IF EXISTS "transactions: delete own row" ON public.transactions;
CREATE POLICY "transactions: delete own row"
  ON public.transactions FOR DELETE
  USING (
    (
      user_id = (SELECT auth.uid())
      AND COALESCE(public.wallet_access_role(wallet_id), '') IN ('owner', 'editor')
    )
    OR
    (
      public.wallet_access_role(wallet_id) = 'owner'
      AND debt_id IS NULL
    )
  );

-- ════════════════════════════════════════════════════
--  BAGIAN 2 — delete_transaction: otorisasi direstrukturisasi
--
--  Perubahan bentuk, bukan tempelan: klausa `user_id = v_user_id` DICABUT
--  dari WHERE pengambilan baris, lalu otorisasi dievaluasi eksplisit sebagai
--  percabangan atas baris yang sudah terkunci. Alasannya sama dengan BAGIAN 1
--  — menyelipkan `OR ...` ke dalam WHERE yang sama akan mencampur "baris mana
--  yang diambil" dengan "siapa yang boleh", dan cabang mana yang meloloskan
--  permintaan jadi tidak bisa dibaca lagi dari kodenya.
--
--  Konsekuensi yang disengaja dari mencabut filter itu: baris dikunci
--  (FOR UPDATE) SEBELUM otorisasi diputuskan. Aman — fungsi ini SECURITY
--  DEFINER (RLS memang tidak berlaku di dalamnya sejak awal), belum ada satu
--  pun tulisan yang terjadi saat RAISE, dan kunci dilepas saat transaksi
--  di-rollback.
--
--  Pesan error KEDUA cabang penolakan sengaja identik dan tetap sama persis
--  dengan versi sebelumnya: "tidak ditemukan" vs "tidak boleh" tidak
--  dibedakan, supaya keberadaan sebuah id tidak bocor (pola
--  adjust_wallet_balance). Kode error tetap 42501.
--
--  Badan penghapusan (pembalikan saldo + DELETE) DITULIS SEKALI setelah
--  percabangan — dua cabang izin, satu jalur efek, jadi tidak mungkin ada
--  cabang yang lupa membalik saldo.
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
  v_via     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_transaction: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- Tanpa filter user_id: otorisasinya di percabangan di bawah, bukan di sini.
  SELECT * INTO v_tx
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  -- RAISE aman: belum ada yang ditulis.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delete_transaction: transaksi tidak ditemukan atau bukan milikmu'
      USING ERRCODE = '42501';
  END IF;

  IF v_tx.user_id = v_user_id THEN
    -- Cabang 1 — PENCATAT menghapus barisnya sendiri. Perilaku lama, tidak
    -- berubah sedikit pun: tidak ada cek peran di sini (pembalikan saldo
    -- untuk baris sendiri sengaja tidak mensyaratkan peran aktif — lihat
    -- header BAGIAN 2 migrasi 20260916000000) dan tidak ada cek debt_id.
    v_via := 'pencatat';

  ELSIF v_tx.debt_id IS NULL
    AND public.wallet_access_role(v_tx.wallet_id) = 'owner' THEN
    -- Cabang 2 — OWNER membersihkan baris anggotanya (13 Sep 2026).
    -- debt_id IS NULL: lihat pengecualian #2 di header file ini.
    -- Status keanggotaan PENCATAT tidak diperiksa, dan itu memang intinya —
    -- baris bekas anggota (status='left') justru kasus utama fitur ini.
    v_via := 'owner';

  ELSE
    -- Pesan identik dengan cabang NOT FOUND di atas: jangan bocorkan apakah
    -- id-nya ada.
    RAISE EXCEPTION 'delete_transaction: transaksi tidak ditemukan atau bukan milikmu'
      USING ERRCODE = '42501';
  END IF;

  -- Pembalikan saldo diambil dari BARIS, bukan argumen. wallet_id NOT NULL +
  -- FK ON DELETE CASCADE: dompetnya pasti ada selama barisnya ada.
  UPDATE public.wallets
  SET    balance = balance - v_tx.amount
  WHERE  id = v_tx.wallet_id
  RETURNING balance INTO v_balance;

  DELETE FROM public.transactions WHERE id = v_tx.id;

  -- `via` aditif (klien mengabaikan isi data, hanya membaca error) — dipakai
  -- saat menelusuri: cabang mana yang meloloskan sebuah penghapusan.
  RETURN jsonb_build_object('wallet_id', v_tx.wallet_id, 'balance', v_balance, 'via', v_via);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_transaction(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.delete_transaction(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_transaction(uuid) IS
  'Menghapus transaksi DAN membalik efeknya ke saldo dompet dalam satu transaksi Postgres. Dua cabang izin (13 Sep 2026): (1) pencatat baris itu sendiri — tanpa cek peran maupun debt_id, perilaku lama; (2) OWNER dompet tempat baris berada, khusus baris debt_id IS NULL — mencakup baris anggota aktif maupun bekas anggota (status=left), karena wallet_access_role mengevaluasi peran PENGHAPUS, bukan pencatat. Mengubah transaksi TIDAK ikut dilonggarkan (update_transaction tetap hanya baris sendiri). Penolakan selalu 42501 dengan pesan yang tidak membedakan "tidak ada" vs "tidak boleh". Mengembalikan {wallet_id, balance, via}.';
