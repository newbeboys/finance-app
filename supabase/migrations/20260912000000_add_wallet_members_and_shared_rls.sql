-- ════════════════════════════════════════════════════
--  FinanceApp — Fitur B (dompet bersama), Tahap 2:
--  tabel wallet_members + pelebaran RLS wallets/transactions + RPC saldo.
--
--  SENGAJA SATU FILE, bukan dipecah tiga. `supabase db push` menjalankan tiap
--  file migrasi dalam SATU transaksi, jadi satu file = semua-atau-tidak-sama-
--  sekali. Kalau dipecah, ada jendela di mana tabel sudah ada tapi policy belum
--  (atau RPC sudah menunjuk helper yang belum dibuat) — dan RPC saldo yang
--  menunjuk fungsi tidak-ada akan gagal di SETIAP panggilan, bukan saat migrasi.
--
--  KEPUTUSAN PRODUK YANG DIKODEKAN DI SINI (final, jangan diubah tanpa diskusi):
--    1. Owner TIDAK punya baris di wallet_members. wallets.user_id adalah
--       satu-satunya sumber kebenaran kepemilikan — dua sumber akan drift.
--    2. UPDATE/DELETE baris `wallets` (rename, warna, hapus) = OWNER SAJA.
--       Member tidak butuh itu: satu-satunya tulis yang mereka perlukan adalah
--       saldo, dan itu lewat RPC SECURITY DEFINER yang melewati RLS.
--    3. Ubah/hapus transaksi SIMETRIS: semua orang — termasuk owner — hanya
--       boleh menyentuh transaksi dengan user_id miliknya sendiri. Owner TIDAK
--       punya hak override atas transaksi yang dicatat member.
--    4. Transaksi yang dicatat member tetap user_id = member (riwayat harus
--       jelas siapa yang mencatat), dan TETAP ADA setelah member keluar.
-- ════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — Tabel keanggotaan
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wallet_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   uuid        NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'editor'
                            CHECK (role IN ('owner','editor','viewer')),
  status      text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','left')),
  invited_by  uuid                 REFERENCES auth.users(id)     ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  CONSTRAINT wallet_members_wallet_user_unique UNIQUE (wallet_id, user_id)
);

COMMENT ON TABLE public.wallet_members IS
  'Keanggotaan dompet bersama (Fitur B). Owner TIDAK punya baris di sini — kepemilikan hanya dari wallets.user_id. Nilai role=''owner'' dicadangkan dan belum dipakai.';
COMMENT ON COLUMN public.wallet_members.status IS
  'pending = diundang belum diterima; active = anggota aktif; left = sudah keluar (baris SENGAJA disimpan, bukan dihapus, supaya riwayat undangan terlacak dan transaksi lamanya tetap punya konteks).';

-- Pola query persis milik wallet_access_role(): wallet_id + user_id + status.
CREATE INDEX IF NOT EXISTS idx_wallet_members_lookup
  ON public.wallet_members (wallet_id, user_id, status);

-- Arah sebaliknya: "dompet apa saja yang saya ikuti" — dipakai klien untuk
-- menyusun daftar id dompet bersama (useWallets/useTransactions).
CREATE INDEX IF NOT EXISTS idx_wallet_members_user
  ON public.wallet_members (user_id, status);

-- WAJIB, bukan optimasi: setelah policy transactions melebar, setiap baris yang
-- BUKAN milik pemanggil dicek lewat wallet_id. Tanpa index ini tabel transactions
-- (tabel terbesar di app) jadi seq-scan penuh setiap kali dibaca. Tabel ini
-- sebelumnya sama sekali tidak punya index selain PK dan idx_transactions_debt_id.
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id
  ON public.transactions (wallet_id);

ALTER TABLE public.wallet_members ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════
--  BAGIAN 2 — Helper akses (pemutus rekursi RLS)
-- ════════════════════════════════════════════════════

-- ┌─ KENAPA HELPER SECURITY DEFINER, BUKAN EXISTS() LANGSUNG DI POLICY ─────┐
-- │ Policy `wallets` perlu membaca wallet_members, dan policy               │
-- │ `wallet_members` perlu tahu siapa owner dompetnya. Kalau keduanya       │
-- │ ditulis sebagai EXISTS() biasa, evaluasi policy saling memanggil dan    │
-- │ Postgres melempar:                                                     │
-- │     infinite recursion detected in policy for relation "wallets"        │
-- │ Itu mematikan SELURUH akses dompet aplikasi, bukan cuma fitur berbagi. │
-- │ SECURITY DEFINER melewati RLS di dalam badan fungsi, jadi rantai        │
-- │ evaluasinya putus.                                                     │
-- │                                                                        │
-- │ JANGAN pernah mengganti pemanggilan fungsi ini di policy di bawah       │
-- │ dengan EXISTS(SELECT ... FROM wallet_members) "supaya lebih eksplisit". │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- STABLE: hasilnya tetap sepanjang satu statement, jadi planner boleh
-- meng-cache-nya alih-alih memanggil ulang per baris.
--
-- Identitas SELALU dari auth.uid(), tidak pernah dari argumen — p_wallet_id
-- hanya menunjuk BARIS. Pola sama dgn adjust_wallet_balance/record_transaction.
CREATE OR REPLACE FUNCTION public.wallet_access_role(p_wallet_id uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_wallet_id IS NULL THEN NULL
    -- Keputusan produk #1: kepemilikan HANYA dari wallets.user_id.
    WHEN EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = p_wallet_id AND w.user_id = auth.uid()
    ) THEN 'owner'
    ELSE (
      SELECT m.role FROM public.wallet_members m
      WHERE m.wallet_id = p_wallet_id
        AND m.user_id   = auth.uid()
        AND m.status    = 'active'   -- 'pending'/'left' TIDAK memberi akses
      LIMIT 1
    )
  END;
$$;

-- Postgres memberi EXECUTE ke PUBLIC secara default saat fungsi dibuat, jadi
-- REVOKE ini WAJIB. Pola sama seperti BAGIAN 3 migrasi 20260723010000.
REVOKE EXECUTE ON FUNCTION public.wallet_access_role(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.wallet_access_role(uuid) TO authenticated;

COMMENT ON FUNCTION public.wallet_access_role(uuid) IS
  'Mengembalikan peran pemanggil (auth.uid()) atas sebuah dompet: ''owner'' (dari wallets.user_id), ''editor''/''viewer'' (dari wallet_members status=active), atau NULL bila tidak punya akses. SECURITY DEFINER supaya policy wallets dan wallet_members bisa saling merujuk tanpa rekursi RLS.';

-- ════════════════════════════════════════════════════
--  BAGIAN 3 — Policy wallet_members
-- ════════════════════════════════════════════════════

-- Baca: barisnya sendiri (supaya tahu diundang ke mana), atau semua baris
-- dompet yang dia miliki. CATATAN: member TIDAK bisa melihat daftar member
-- lain — dicatat sebagai keputusan Task 4, sengaja belum dilonggarkan.
DROP POLICY IF EXISTS "wallet_members: read own or owned wallet" ON public.wallet_members;
CREATE POLICY "wallet_members: read own or owned wallet"
  ON public.wallet_members FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.wallet_access_role(wallet_id) = 'owner'
  );

-- Tulis: owner saja. Undangan (kode 6 digit) dan terima/tolak akan lewat RPC
-- SECURITY DEFINER di Task 3, jadi member TIDAK perlu INSERT/UPDATE langsung —
-- calon member bahkan belum punya akses apa pun ke dompetnya saat diundang,
-- jadi policy berbasis wallet_access_role() memang tidak akan mengizinkannya.
DROP POLICY IF EXISTS "wallet_members: owner manages" ON public.wallet_members;
CREATE POLICY "wallet_members: owner manages"
  ON public.wallet_members FOR ALL
  USING      (public.wallet_access_role(wallet_id) = 'owner')
  WITH CHECK (public.wallet_access_role(wallet_id) = 'owner');

-- ════════════════════════════════════════════════════
--  BAGIAN 4 — Pelebaran policy wallets
-- ════════════════════════════════════════════════════

-- Policy FOR ALL yang lama TIDAK BISA menyatakan "boleh SELECT dompet bersama
-- tapi hanya boleh UPDATE milik sendiri" — satu policy FOR ALL memakai USING
-- yang sama untuk baca dan tulis. Karena itu dipecah per-perintah, mengikuti
-- pola yang sudah dipakai debts/debt_payments.
--
-- `(SELECT auth.uid())` bukan `auth.uid()` telanjang: bentuk subquery membuat
-- Postgres meng-evaluasinya sekali sebagai InitPlan, bukan sekali per baris.
DROP POLICY IF EXISTS "wallets: own data only" ON public.wallets;

DROP POLICY IF EXISTS "wallets: read own or member" ON public.wallets;
CREATE POLICY "wallets: read own or member"
  ON public.wallets FOR SELECT
  USING (public.wallet_access_role(id) IS NOT NULL);

DROP POLICY IF EXISTS "wallets: insert own" ON public.wallets;
CREATE POLICY "wallets: insert own"
  ON public.wallets FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Keputusan produk #2: rename/warna/is_primary = owner saja. Editor & viewer
-- tidak dapat policy UPDATE sama sekali di sini. Penyesuaian SALDO tidak lewat
-- jalur ini — adjust_wallet_balance/record_transaction SECURITY DEFINER dan
-- melewati RLS, jadi member tetap bisa mencatat transaksi tanpa hak UPDATE.
DROP POLICY IF EXISTS "wallets: update own" ON public.wallets;
CREATE POLICY "wallets: update own"
  ON public.wallets FOR UPDATE
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "wallets: delete own" ON public.wallets;
CREATE POLICY "wallets: delete own"
  ON public.wallets FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ════════════════════════════════════════════════════
--  BAGIAN 5 — Pelebaran policy transactions
-- ════════════════════════════════════════════════════

DROP POLICY IF EXISTS "transactions: own data only" ON public.transactions;

-- `user_id = auth.uid()` DIPERTAHANKAN sebagai cabang pertama, bukan diganti:
--   (a) Keputusan produk #4 — setelah member keluar (status 'left'), dia harus
--       tetap bisa melihat transaksi yang dulu dia catat, walau akses dompetnya
--       sudah hilang. Tanpa cabang ini riwayatnya lenyap dari layarnya sendiri.
--   (b) Performa — mayoritas mutlak baris adalah milik pemanggil sendiri dan
--       selesai di perbandingan murah ini, tanpa pernah memanggil helper.
DROP POLICY IF EXISTS "transactions: read own or wallet" ON public.transactions;
CREATE POLICY "transactions: read own or wallet"
  ON public.transactions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.wallet_access_role(wallet_id) IS NOT NULL
  );

-- Mencatat transaksi: hanya atas nama diri sendiri (user_id dikunci ke pemanggil
-- — keputusan produk #4), dan hanya di dompet yang boleh ditulisi. Peran
-- 'viewer' TIDAK lolos di sini: IN (...) menghasilkan NULL saat helper
-- mengembalikan NULL, dan NULL di WITH CHECK = ditolak (fail-closed).
DROP POLICY IF EXISTS "transactions: insert as self" ON public.transactions;
CREATE POLICY "transactions: insert as self"
  ON public.transactions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.wallet_access_role(wallet_id) IN ('owner','editor')
  );

-- Keputusan produk #3 — SIMETRIS: owner pun tidak bisa menyentuh transaksi yang
-- dicatat member. USING hanya `user_id = auth.uid()`, tanpa cabang owner.
-- WITH CHECK mengunci user_id juga supaya baris tidak bisa "dioper" ke orang
-- lain lewat UPDATE, dan memastikan hasil editnya tetap mendarat di dompet yang
-- boleh ditulisi (mis. memindahkan transaksi ke dompet yang aksesnya sudah
-- dicabut harus ditolak).
DROP POLICY IF EXISTS "transactions: update own row" ON public.transactions;
CREATE POLICY "transactions: update own row"
  ON public.transactions FOR UPDATE
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.wallet_access_role(wallet_id) IN ('owner','editor')
  );

DROP POLICY IF EXISTS "transactions: delete own row" ON public.transactions;
CREATE POLICY "transactions: delete own row"
  ON public.transactions FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ════════════════════════════════════════════════════
--  BAGIAN 6 — RPC saldo: buka titik perluasan Fitur B
-- ════════════════════════════════════════════════════
--  Kedua fungsi di bawah SUDAH ADA (migrasi 20260911000000 & 20260911010000)
--  dan ditulis ulang utuh di sini dengan SATU perubahan masing-masing: klausa
--  `AND w.user_id = v_user_id` diganti cek peran. Ini persis "TITIK PERLUASAN
--  FITUR B" yang ditandai di komentar kedua migrasi itu — sekarang tabel
--  wallet_members sudah ada, jadi aman dipasang.
--
--  KOREKSI: komentar di 20260911000000 menyebut kolom `m.member_user_id`.
--  Nama kolom finalnya adalah `user_id` (lihat BAGIAN 1).
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

  -- INTI ATOMIK: cek akses + kunci baris + hitung + tulis dalam SATU statement.
  -- `balance + COALESCE(p_delta, 0)` dihitung Postgres terhadap baris terkunci,
  -- BUKAN oleh klien terhadap angka basi.
  --
  -- SECURITY DEFINER melewati RLS, jadi klausa WHERE ini adalah SATU-SATUNYA
  -- penjaga akses. wallet_access_role() mengembalikan NULL bila tidak punya
  -- akses, dan NULL IN (...) = NULL = baris tidak cocok → fail-closed.
  -- 'viewer' sengaja TIDAK termasuk: boleh melihat, tidak boleh menggerakkan uang.
  UPDATE public.wallets w
  SET    balance = w.balance + COALESCE(p_delta, 0)
  WHERE  w.id = p_wallet_id
    AND  public.wallet_access_role(w.id) IN ('owner','editor')
  RETURNING w.balance INTO v_new_balance;

  -- Tidak ada baris tersentuh = dompet tidak ada ATAU pemanggil tidak berhak.
  -- Sengaja TIDAK dibedakan pesannya: membedakan "tidak ada" vs "bukan hakmu"
  -- membocorkan keberadaan dompet user lain kepada penebak UUID.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'adjust_wallet_balance: dompet tidak ditemukan atau tidak dapat diakses'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.adjust_wallet_balance(uuid, numeric) IS
  'Menambah/mengurangi saldo dompet secara atomik (balance = balance + delta dalam satu UPDATE terkunci). Mengembalikan saldo baru. Identitas dari auth.uid(), bukan argumen. SECURITY DEFINER: melewati RLS, klausa WHERE di dalamnya adalah satu-satunya cek akses — owner atau anggota aktif ber-role editor (viewer ditolak).';


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

  -- Lihat "KONVENSI TANGGAL" di migrasi 20260911010000: tidak ada fallback UTC.
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'record_transaction: p_date wajib diisi klien (tanggal lokal WIB)'
      USING ERRCODE = '22004';
  END IF;

  -- CATATAN: transactions.wallet_id di database adalah NOT NULL (FK ke wallets,
  -- ON DELETE CASCADE), jadi cabang "transaksi tanpa dompet" di bawah praktis
  -- tidak terpakai — INSERT dgn p_wallet_id NULL akan ditolak constraint, bukan
  -- tersimpan sebagai transaksi lepas. Dipertahankan apa adanya supaya perubahan
  -- di migrasi ini tetap terbatas pada cek akses saja.
  --
  -- SECURITY DEFINER melewati RLS: klausa WHERE ini satu-satunya penjaga akses.
  -- 'viewer' ditolak — boleh melihat, tidak boleh menggerakkan uang.
  IF p_wallet_id IS NOT NULL THEN
    UPDATE public.wallets w
    SET    balance = w.balance + p_amount
    WHERE  w.id = p_wallet_id
      AND  public.wallet_access_role(w.id) IN ('owner','editor');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'record_transaction: dompet tidak ditemukan atau tidak dapat diakses'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- debt_id ikut diverifikasi kepemilikannya: RLS dilewati di sini, jadi tanpa
  -- cek ini sebuah transaksi bisa ditautkan ke catatan hutang milik user lain
  -- kalau uuid-nya tertebak.
  --
  -- SENGAJA tetap `d.user_id = v_user_id` (bukan cek peran dompet): hutang/
  -- piutang adalah catatan PRIBADI dan tidak ikut dibagikan lewat Fitur B.
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
    -- Keputusan produk #4: transaksi yang dicatat member tetap atas nama MEMBER,
    -- bukan owner dompet — riwayat harus jelas siapa yang mencatat.
    v_user_id,
    -- Diturunkan dari tanda amount, bukan parameter terpisah.
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

REVOKE EXECUTE ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_transaction(numeric, text, date, uuid, text, text, text, text, uuid) IS
  'Mencatat satu transaksi DAN menyesuaikan saldo dompetnya dalam satu transaksi Postgres (atomik). amount bertanda: negatif=pengeluaran; kolom type diturunkan dari tandanya. p_date wajib tanggal lokal WIB dari klien. Identitas dari auth.uid(): transaksi yang dicatat anggota dompet bersama tetap tersimpan atas nama anggota itu. Akses dompet = owner atau anggota aktif ber-role editor. CATATAN: kuota transaksi/bulan plan Basic TIDAK dicek di sini — gating tetap di useTransactions.createTransaction (src/lib/planLimits.js sebagai sumber tunggal).';
