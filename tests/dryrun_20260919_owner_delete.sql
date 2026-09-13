-- ════════════════════════════════════════════════════════════════════
--  DRY-RUN migrasi 20260919000000_owner_can_delete_member_transactions
--  File: tests/dryrun_20260919_owner_delete.sql
--
--  CARA PAKAI: tempel SELURUH isi file ini ke Supabase SQL Editor → Run.
--
--  AMAN: script SENGAJA diakhiri RAISE EXCEPTION. Semua statement dalam satu
--  kali Run berjalan dalam SATU transaksi implisit, jadi error di akhir
--  membatalkan SEMUANYA (policy, fungsi, user palsu, dompet, transaksi).
--  JANGAN tambahkan BEGIN/COMMIT. Hasil uji muncul sebagai PESAN ERROR
--  berjudul "HASIL DRY-RUN" — itu yang diharapkan, bukan kegagalan.
--  Kalau editor memunculkan peringatan "destructive operation" (karena ada
--  DROP POLICY), konfirmasi saja; semuanya ikut dibatalkan.
--  Kalau pesan error-nya BUKAN "HASIL DRY-RUN" (mis. syntax error atau
--  permission denied), script berhenti di situ dan tetap dibatalkan seluruhnya.
--
--  JUMLAH UJI: 19 — hasil yang diharapkan "LULUS 19/19".
--    BAGIAN C  UJI RPC     R1-R12  12 uji  delete_transaction (SECURITY DEFINER)
--    BAGIAN D  UJI POLICY  P0-P5    6 uji  policy RLS DELETE, role authenticated
--    BAGIAN E  UJI SKEMA   S1       1 uji  transactions.wallet_id NOT NULL
--
--  SESUDAH RUN (sebelum db push), pastikan tidak ada yang tersimpan — jalankan
--  sebagai query TERPISAH, hasilnya harus false:
--    SELECT pg_get_functiondef('public.delete_transaction(uuid)'::regprocedure) LIKE '%v_via%';
--
--  BAGIAN A adalah SALINAN file migrasi. Kalau migrasinya berubah, BAGIAN A
--  wajib disalin ulang. Cek kesamaan dari root worktree (Git Bash):
--    diff <(sed -n '/^-- >>> BAGIAN A MULAI/,/^-- <<< BAGIAN A SELESAI/p' tests/dryrun_20260919_owner_delete.sql | sed '1d;$d') supabase/migrations/20260919000000_owner_can_delete_member_transactions.sql && echo IDENTIK
-- ════════════════════════════════════════════════════════════════════

-- >>> BAGIAN A MULAI — salinan persis supabase/migrations/20260919000000_owner_can_delete_member_transactions.sql
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
--  Tiga titik penolakan, semuanya 42501. Dua di antaranya (id tidak ada, dan
--  bukan pencatat maupun owner) memakai pesan yang identik dan sama persis
--  dengan versi sebelumnya: "tidak ditemukan" vs "tidak boleh" tidak
--  dibedakan, supaya keberadaan sebuah id tidak bocor (pola
--  adjust_wallet_balance). Yang ketiga — Penjaga 2 dari 20260917000000, di
--  dalam cabang pencatat — boleh memakai pesan spesifik karena pemanggilnya
--  sudah terbukti pencatat baris itu.
--
--  CATATAN REVIEW (13 Sep 2026): draft pertama migrasi ini (commit 0ddedc2)
--  kehilangan Penjaga 2 di cabang pencatat, sehingga viewer & bekas anggota
--  bisa lagi menghapus baris yang mereka catat sendiri lewat RPC ini. Policy
--  DELETE di BAGIAN 1 tetap benar, tapi fungsi SECURITY DEFINER tidak
--  melewatinya. Ditemukan sebelum db push dan diperbaiki di file yang sama.
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
    -- Cabang 1 — PENCATAT menghapus barisnya sendiri. Perilaku 20260917000000
    -- tidak berubah: penjaga peran di bawah (keputusan 12 Sep 2026) ADA dan
    -- tetap berlaku, jadi viewer & bekas anggota tidak bisa menghapus baris
    -- yang mereka catat sendiri. debt_id tidak dicek di cabang ini.
    --
    -- Penjaga itu SENGAJA BERSARANG di sini, tidak berdiri sendiri setelah
    -- SELECT seperti di 20260917000000. SELECT di atas tidak lagi memfilter
    -- user_id, jadi penjaga yang berdiri sendiri akan menjawab pesan spesifik
    -- untuk id yang ADA dan "tidak ditemukan" untuk id yang TIDAK ADA —
    -- membocorkan keberadaan id. Di dalam cabang ini pemanggil sudah terbukti
    -- pencatat barisnya, jadi pesan spesifik aman.
    --
    -- Blok di bawah identik dengan Penjaga 2 di 20260917000000 (komentar dan
    -- kode), hanya indentasinya bergeser.
    -- Penjaga 2 — peran di dompetnya (keputusan 12 Sep 2026). Untuk dompet
    -- sendiri selalu 'owner', jadi transaksi non-bersama tidak terdampak.
    -- Pesan boleh spesifik: pemanggil sudah terbukti pemilik baris.
    IF COALESCE(public.wallet_access_role(v_tx.wallet_id), '') NOT IN ('owner', 'editor') THEN
      RAISE EXCEPTION 'delete_transaction: dompet ini hanya bisa dibaca atau sudah kamu tinggalkan'
        USING ERRCODE = '42501';
    END IF;

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
  'Menghapus transaksi DAN membalik efeknya ke saldo dompet dalam satu transaksi Postgres. Dua cabang izin (13 Sep 2026): (1) pencatat baris itu sendiri — penjaga peran 20260917000000 tetap berlaku (wallet_access_role atas dompet baris itu harus owner/editor, jadi viewer & bekas anggota ditolak), tanpa cek debt_id; (2) OWNER dompet tempat baris berada, khusus baris debt_id IS NULL — mencakup baris anggota aktif maupun bekas anggota (status=left), karena wallet_access_role mengevaluasi peran PENGHAPUS, bukan pencatat. Mengubah transaksi TIDAK ikut dilonggarkan (update_transaction tetap hanya baris sendiri). Semua penolakan 42501; pesan "tidak ditemukan atau bukan milikmu" tidak membedakan "tidak ada" vs "tidak boleh", kecuali pencatat yang ditolak penjaga peran (pesan spesifik, karena dia sudah terbukti pencatat). Mengembalikan {wallet_id, balance, via}.';
-- <<< BAGIAN A SELESAI

-- ════════════════════════════════════════════════════════════════════
--  BAGIAN B — helper uji (fungsi pg_temp, ikut dibatalkan)
-- ════════════════════════════════════════════════════════════════════

-- starts_with(), bukan LIKE: pesan error mengandung '_' yang di LIKE berarti
-- "karakter apa pun", jadi LIKE bisa meloloskan hasil yang sebenarnya beda.
CREATE FUNCTION pg_temp.dr_line(p_label text, p_expect text, p_actual text)
RETURNS text LANGUAGE sql AS $f$
  SELECT CASE WHEN starts_with(COALESCE(p_actual, '<NULL>'), p_expect) THEN '[ OK  ] ' ELSE '[GAGAL] ' END
      || p_label
      || E'\n          harapan: ' || p_expect
      || E'\n          hasil  : ' || COALESCE(p_actual, '<NULL>') || E'\n';
$f$;

-- ────────────────────────────────────────────────────────────────────
--  helper UJI RPC (dipakai BAGIAN C)
--
--  delete_transaction adalah SECURITY DEFINER: RLS tidak berlaku di dalamnya
--  dan role pemanggil tidak memengaruhi keputusannya. Yang menentukan hanya
--  auth.uid(), jadi yang diset cukup request.jwt.claims — role SENGAJA tidak
--  diganti di helper ini. Efek tiap uji dibatalkan (subtransaksi) supaya semua
--  uji mulai dari data yang sama.
-- ────────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.dr_rpc(p_actor uuid, p_tx uuid, p_wallet uuid)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_before numeric; v_after numeric; v_res jsonb; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    SELECT balance INTO v_before FROM public.wallets WHERE id = p_wallet;
    v_res := public.delete_transaction(p_tx);
    SELECT balance INTO v_after FROM public.wallets WHERE id = p_wallet;
    v_out := format('LOLOS via=%s saldo %s -> %s', v_res->>'via', v_before, v_after);
    RAISE EXCEPTION '__dr_undo__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__dr_undo__' THEN
      v_out := format('DITOLAK %s "%s"', SQLSTATE, SQLERRM);
    END IF;
  END;
  RETURN v_out;
END $f$;

-- ────────────────────────────────────────────────────────────────────
--  helper UJI POLICY (dipakai BAGIAN D)
--
--  SQL Editor berjalan sebagai `postgres`, yang di Supabase ber-BYPASSRLS
--  (pg_roles.rolbypassrls = true). Tanpa berganti role, DELETE di bawah
--  selalu berhasil dan uji policy TIDAK MEMBUKTIKAN APA PUN. Karena itu dua
--  set_config ini WAJIB di setiap uji policy:
--    set_config('request.jwt.claims', …, true)  → auth.uid() = pelaku
--    set_config('role', 'authenticated', true)   → RLS benar-benar aktif
--  Keduanya is_local=true dan ikut dibatalkan bersama subtransaksinya, jadi
--  role kembali ke postgres setelah tiap uji. P0 membuktikan pergantian role
--  benar-benar terjadi; P1-P5 mencantumkan role aktif di hasilnya.
-- ────────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.dr_whoami(p_actor uuid)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    SELECT format('role=%s bypassrls=%s uid_cocok=%s', current_user, r.rolbypassrls, (auth.uid() = p_actor))
      INTO v_out
      FROM pg_roles r WHERE r.rolname = current_user;
    RAISE EXCEPTION '__dr_undo__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__dr_undo__' THEN
      v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
    END IF;
  END;
  RETURN v_out;
END $f$;

CREATE FUNCTION pg_temp.dr_policy(p_actor uuid, p_tx uuid)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_n int; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    DELETE FROM public.transactions WHERE id = p_tx;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_out := format('%s baris (role=%s)', v_n, current_user);
    RAISE EXCEPTION '__dr_undo__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__dr_undo__' THEN
      v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
    END IF;
  END;
  RETURN v_out;
END $f$;

-- ────────────────────────────────────────────────────────────────────
--  helper UJI SKEMA (dipakai BAGIAN E)
--
--  Berjalan sebagai postgres tanpa ganti role: constraint NOT NULL berlaku
--  untuk semua role (BYPASSRLS hanya melewati RLS, bukan constraint).
-- ────────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.dr_insert_null_wallet(p_actor uuid)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_out text;
BEGIN
  BEGIN
    INSERT INTO public.transactions (user_id, wallet_id, type, amount, merchant)
    VALUES (p_actor, NULL, 'expense', -1000, 'DR tanpa dompet');
    v_out := 'TERSIMPAN — wallet_id NULL DITERIMA';
    RAISE EXCEPTION '__dr_undo__';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__dr_undo__' THEN
      v_out := format('DITOLAK %s "%s"', SQLSTATE, SQLERRM);
    END IF;
  END;
  RETURN v_out;
END $f$;

-- ════════════════════════════════════════════════════════════════════
--  Data palsu + BAGIAN C, D, E
-- ════════════════════════════════════════════════════════════════════
DO $dr$
DECLARE
  O  uuid := gen_random_uuid();  -- owner dompet W
  E  uuid := gen_random_uuid();  -- editor aktif
  V  uuid := gen_random_uuid();  -- viewer aktif
  X  uuid := gen_random_uuid();  -- bekas anggota (status=left)
  S  uuid := gen_random_uuid();  -- orang asing, bukan anggota
  W  uuid := gen_random_uuid();  -- dompet bersama milik O, saldo 1.000.000
  D  uuid := gen_random_uuid();  -- hutang milik E
  tO uuid := gen_random_uuid();  -- -50.000 dicatat O
  tE uuid := gen_random_uuid();  -- -100.000 dicatat E
  tV uuid := gen_random_uuid();  -- -20.000 dicatat V
  tX uuid := gen_random_uuid();  -- -30.000 dicatat X (sebelum keluar)
  tD uuid := gen_random_uuid();  -- +40.000 ber-debt_id, dicatat E
  msg_umum  constant text := 'DITOLAK 42501 "delete_transaction: transaksi tidak ditemukan atau bukan milikmu"';
  msg_peran constant text := 'DITOLAK 42501 "delete_transaction: dompet ini hanya bisa dibaca atau sudah kamu tinggalkan"';
  r       text := '';
  v_ok    int;
  v_gagal int;
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (O, 'authenticated', 'authenticated', 'dr-o-' || O || '@dryrun.invalid'),
    (E, 'authenticated', 'authenticated', 'dr-e-' || E || '@dryrun.invalid'),
    (V, 'authenticated', 'authenticated', 'dr-v-' || V || '@dryrun.invalid'),
    (X, 'authenticated', 'authenticated', 'dr-x-' || X || '@dryrun.invalid'),
    (S, 'authenticated', 'authenticated', 'dr-s-' || S || '@dryrun.invalid');

  INSERT INTO public.wallets (id, user_id, name, type, balance)
  VALUES (W, O, 'DRYRUN', 'cash', 1000000);

  INSERT INTO public.wallet_members (wallet_id, user_id, role, status, invited_by, joined_at) VALUES
    (W, E, 'editor', 'active', O, now()),
    (W, V, 'viewer', 'active', O, now()),
    (W, X, 'editor', 'left',   O, now());

  INSERT INTO public.debts (id, user_id, wallet_id, type, person_name, amount)
  VALUES (D, E, W, 'payable', 'DRYRUN', 40000);

  INSERT INTO public.transactions (id, user_id, wallet_id, type, amount, merchant, debt_id) VALUES
    (tO, O, W, 'expense', -50000,  'DR owner',  NULL),
    (tE, E, W, 'expense', -100000, 'DR editor', NULL),
    (tV, V, W, 'expense', -20000,  'DR viewer', NULL),
    (tX, X, W, 'expense', -30000,  'DR ex',     NULL),
    (tD, E, W, 'income',  40000,   'DR hutang', D);

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN C — UJI RPC delete_transaction  (12 uji)
  --  Identitas lewat request.jwt.claims; role TIDAK diganti (SECURITY DEFINER).
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN C: UJI RPC delete_transaction ---\n';
  r := r || pg_temp.dr_line('R1  owner hapus transaksi SENDIRI (regresi normal)',             'LOLOS via=pencatat saldo 1000000 -> 1050000', pg_temp.dr_rpc(O, tO, W));
  r := r || pg_temp.dr_line('R2  owner hapus transaksi EDITOR aktif (saldo kembali 100000)',  'LOLOS via=owner saldo 1000000 -> 1100000',    pg_temp.dr_rpc(O, tE, W));
  r := r || pg_temp.dr_line('R3  owner hapus transaksi BEKAS anggota (left)',                 'LOLOS via=owner saldo 1000000 -> 1030000',    pg_temp.dr_rpc(O, tX, W));
  r := r || pg_temp.dr_line('R4  owner hapus transaksi ber-debt_id milik editor',             msg_umum,  pg_temp.dr_rpc(O, tD, W));
  r := r || pg_temp.dr_line('R5  editor hapus transaksi OWNER',                               msg_umum,  pg_temp.dr_rpc(E, tO, W));
  r := r || pg_temp.dr_line('R6  viewer hapus transaksi EDITOR',                              msg_umum,  pg_temp.dr_rpc(V, tE, W));
  r := r || pg_temp.dr_line('R7  [a] viewer hapus transaksinya SENDIRI → ditolak Penjaga 2',  msg_peran, pg_temp.dr_rpc(V, tV, W));
  r := r || pg_temp.dr_line('R8  [b] bekas anggota hapus transaksinya SENDIRI → ditolak Penjaga 2', msg_peran, pg_temp.dr_rpc(X, tX, W));
  r := r || pg_temp.dr_line('R9  [c] editor hapus transaksinya sendiri → boleh',              'LOLOS via=pencatat saldo 1000000 -> 1100000', pg_temp.dr_rpc(E, tE, W));
  r := r || pg_temp.dr_line('R10 editor hapus transaksi ber-debt_id sendiri (regresi hutang)', 'LOLOS via=pencatat saldo 1000000 -> 960000', pg_temp.dr_rpc(E, tD, W));
  r := r || pg_temp.dr_line('R11 orang asing hapus id yang ADA → pesan sama dengan id tak ada', msg_umum, pg_temp.dr_rpc(S, tE, W));
  r := r || pg_temp.dr_line('R12 owner hapus id yang TIDAK ADA',                              msg_umum,  pg_temp.dr_rpc(O, gen_random_uuid(), W));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN D — UJI POLICY RLS DELETE  (6 uji)
  --  Role DIGANTI ke authenticated di setiap uji (lihat helper UJI POLICY).
  --  Jalur build klien lama yang masih .delete() langsung.
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN D: UJI POLICY RLS DELETE (role authenticated) ---\n';
  r := r || pg_temp.dr_line('P0  pergantian role benar-benar terjadi (RLS aktif)',   'role=authenticated bypassrls=false uid_cocok=true', pg_temp.dr_whoami(E));
  r := r || pg_temp.dr_line('P1  [policy] owner hapus transaksi editor',             '1 baris (role=authenticated)', pg_temp.dr_policy(O, tE));
  r := r || pg_temp.dr_line('P2  [policy] owner hapus transaksi ber-debt_id editor', '0 baris (role=authenticated)', pg_temp.dr_policy(O, tD));
  r := r || pg_temp.dr_line('P3  [policy] viewer hapus transaksinya sendiri',        '0 baris (role=authenticated)', pg_temp.dr_policy(V, tV));
  r := r || pg_temp.dr_line('P4  [policy] editor hapus transaksi owner',             '0 baris (role=authenticated)', pg_temp.dr_policy(E, tO));
  r := r || pg_temp.dr_line('P5  [policy] editor hapus transaksinya sendiri',        '1 baris (role=authenticated)', pg_temp.dr_policy(E, tE));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN E — UJI SKEMA  (1 uji)
  --  [d] versi server: transaksi tanpa dompet tidak mungkin ada di tabel.
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN E: UJI SKEMA ---\n';
  r := r || pg_temp.dr_line('S1  [d] INSERT transaksi dengan wallet_id NULL ditolak NOT NULL', 'DITOLAK 23502', pg_temp.dr_insert_null_wallet(O));

  v_ok    := (length(r) - length(replace(r, '[ OK  ]', ''))) / length('[ OK  ]');
  v_gagal := (length(r) - length(replace(r, '[GAGAL]', ''))) / length('[GAGAL]');

  RAISE EXCEPTION E'\n==== HASIL DRY-RUN (SEMUA SUDAH DIBATALKAN) — LULUS %/% (harapan 19/19) ====\n%',
    v_ok, v_ok + v_gagal, r;
END $dr$;
