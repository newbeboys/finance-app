-- ════════════════════════════════════════════════════
--  FinanceApp — Bug #6: GERBANG SERVER untuk limit tier Basic
--  (wallets, savings, custom_categories, debts)
--
--  Penutup "SATU KELUARGA" bug #4/#5/#6 (keputusan 15 Sep 2026):
--    #5  checkCreateAllowed fail-closed + logging   (klien, sudah commit)
--    #4  is_locked DIHITUNG, bukan disimpan         (klien, sudah commit)
--    #6  limit ditegakkan SERVER                    (file ini)
--
--  ┌─ MASALAH YANG DITUTUP ────────────────────────────────────────────────┐
--  │ Sampai sebelum file ini, SEMUA limit tier Basic hanya hidup di klien  │
--  │ (array.length >= limit di hook, checkCreateAllowed di useDebts).      │
--  │ RLS tidak pernah ikut menghitung apa pun: policy INSERT keempat tabel │
--  │ ini cuma `auth.uid() = user_id`. Artinya satu panggilan PostgREST     │
--  │ langsung — `supabase.from('wallets').insert(...)` dari console, atau  │
--  │ build klien lama — melewati seluruh gerbang tier tanpa perlawanan.    │
--  │ Kuota Basic praktis bersifat sukarela.                                │
--  │                                                                       │
--  │ Beda dengan gate Pro dompet bersama (20260913000000) yang sejak awal  │
--  │ ditegakkan di dalam RPC: yang itu membuka akses PERMANEN ke akun      │
--  │ ketiga, jadi diprioritaskan duluan. Yang ini "cuma" kuota, tapi kuota │
--  │ inilah alasan orang membayar Pro.                                     │
--  └───────────────────────────────────────────────────────────────────────┘
--
--  ════ KENAPA RPC SECURITY DEFINER, BUKAN SUBQUERY COUNT DI RLS ════
--
--  Bentuk "alami" untuk ini kelihatannya policy WITH CHECK ber-subquery:
--      WITH CHECK ((SELECT count(*) FROM wallets WHERE user_id = auth.uid()) < 1)
--  Sudah diinvestigasi (C9) dan DITOLAK karena dua alasan yang tidak bisa
--  diakali:
--
--    1. RLS TIDAK BISA MENGUNCI. Policy dievaluasi sebagai ekspresi biasa,
--       dan Postgres melarang FOR UPDATE di dalamnya (juga melarang FOR
--       UPDATE bersama fungsi agregat sama sekali — `SELECT count(*) ...
--       FOR UPDATE` adalah ERROR, bukan sekadar tidak efektif). Tanpa
--       kunci, dua INSERT paralel dari user yang sama sama-sama membaca
--       count lama dan LOLOS BERDUA: limit 1 dompet dilewati jadi 2 hanya
--       dengan dua klik cepat. Itu bukan skenario teoretis — dua device,
--       atau satu tombol yang di-double-tap, sudah cukup.
--
--    2. RLS TIDAK BISA MENJAWAB ALASAN. Policy yang gagal selalu memberi
--       pesan yang sama: "new row violates row-level security policy".
--       Klien tidak bisa membedakan "kuota habis" (→ paywall) dari
--       "cooldown 50 hari" (→ tanggal boleh-lagi) dari "sesi salah". Untuk
--       debts, satu-satunya jalan menegakkan DUA aturan berbeda dengan dua
--       pesan berbeda adalah fungsi yang bisa bercerita.
--
--  Jadi polanya mengikuti generate_wallet_invite (20260913000000) dan
--  check_chat_rate_limit (20260716000000): SECURITY DEFINER, identitas dari
--  auth.uid() (bukan argumen — argumen identitas bisa dipalsukan), gerbang
--  dan INSERT dalam SATU transaksi Postgres.
--
--  ════ CARA KUNCINYA BEKERJA (baca sebelum mengubah apa pun) ════
--
--  Yang dikunci adalah BARIS user_subscriptions MILIK PEMANGGIL, bukan baris
--  di tabel sumber daya. Alasannya: tidak ada baris yang bisa dikunci untuk
--  sesuatu yang BELUM ADA. `SELECT count(*) ... FOR UPDATE` dilarang
--  Postgres, dan mengunci baris-baris yang sudah ada pun tidak mencegah
--  INSERT baru masuk di antaranya (tidak ada predicate lock di READ
--  COMMITTED). Baris langganan adalah satu-satunya baris yang PASTI ada,
--  PASTI satu per user, dan memang sudah harus dibaca di sini (untuk tahu
--  Pro/Basic) — jadi satu SELECT ... FOR UPDATE mengerjakan dua hal:
--
--    a. menyerialisasi semua panggilan create_* dari user yang SAMA
--       (panggilan kedua menunggu di FOR UPDATE sampai yang pertama commit,
--       lalu menghitung ulang dan melihat baris yang baru masuk), dan
--    b. membaca plan-nya.
--
--  User yang BERBEDA mengunci baris berbeda → tidak pernah saling blokir.
--  Pola "INSERT ... ON CONFLICT DO NOTHING lalu SELECT ... FOR UPDATE"
--  diambil bulat-bulat dari check_chat_rate_limit: memastikan barisnya ada
--  dulu, karena baris yang tidak ada tidak bisa dikunci dan racenya akan
--  diam-diam terbuka lagi. Baris 'basic' yang disisipkan di situ identik
--  dengan yang dibuat trigger handle_new_user_subscription / backfill di
--  subscriptions.sql, dan DO NOTHING membuatnya tidak mungkin menurunkan
--  siapa pun dari Pro.
--
--  ════ LIMIT ADALAH KONSTANTA, BUKAN PARAMETER — JANGAN DIUBAH ════
--
--  check_chat_rate_limit menerima ambangnya sebagai argumen (p_max_requests).
--  Itu aman DI SANA karena yang memanggilnya edge function, dan memalsukan
--  angkanya dari klien tidak menguntungkan siapa pun. DI SINI TIDAK BOLEH:
--  keempat fungsi ini dipanggil LANGSUNG oleh klien, jadi ambang yang bisa
--  dikirim pemanggil = gerbang yang mematikan dirinya sendiri
--  (`rpc('create_wallet', { p_max: 999 })`). Semua limit di bawah adalah
--  `constant` di dalam body. Kalau suatu saat perlu dinamis, sumbernya harus
--  tabel di server, BUKAN argumen fungsi.
--
--  ════ KONTRAK RETURN ════
--
--  Semua mengembalikan jsonb { ok boolean, reason text, data jsonb }:
--    { ok: true,  reason: null,     data: <baris yang baru di-INSERT> }
--    { ok: false, reason: '<kode>', data: <konteks tambahan / null> }
--  `data` pada kasus sukses berisi baris utuh hasil RETURNING supaya hook
--  bisa menambal state lokalnya tanpa query susulan.
--
--  DUA HAL SENGAJA TETAP DILEMPAR SEBAGAI EXCEPTION, bukan {ok:false}:
--    1. Tidak ada sesi (42501) — konvensi seluruh RPC di repo ini, dan tidak
--       mungkin terjadi lewat aplikasi (hook memanggil requireUserId dulu).
--    2. Pelanggaran constraint, khususnya unique_violation 23505 pada
--       custom_categories (user_id, lower(name)). Itu BUKAN keputusan
--       gerbang, dan klien sudah punya penanganan 23505 yang teruji (ambil
--       baris yang sudah ada, perlakukan sebagai duplikat). PostgREST
--       meneruskan SQLSTATE apa adanya ke error.code, jadi cabang itu tetap
--       jalan persis seperti saat masih `.insert()` langsung.
--
--  ════ YANG SENGAJA TIDAK IKUT DIUBAH DI SINI ════
--
--  - Policy INSERT keempat tabel TIDAK dipersempit/dihapus. Alasannya sama
--    dengan varian B di 20260917000000: build klien lama yang masih
--    `.insert()` langsung harus tetap bisa mencatat, dan mematikannya lewat
--    policy akan merusak aplikasi yang sudah terpasang di HP orang. Fungsi
--    ini gerbang yang DIPAKAI jalur resmi; mempersempit policy adalah
--    langkah terpisah setelah semua klien lama habis. TODO tersendiri.
--  - `debts.wallet_id` TIDAK divalidasi kepemilikannya di sini. Hari ini
--    INSERT langsung pun tidak memvalidasinya (RLS debts hanya mengecek
--    user_id), jadi menambahkannya di sini bukan menutup celah melainkan
--    mengubah perilaku di luar cakupan bug #6. Dicatat sebagai celah yang
--    sudah ada sebelumnya, bukan yang dibuat file ini.
--  - Transaksi pokok tertaut hutang TETAP dibuat klien lewat RPC
--    record_transaction (useDebts langkah 2), tidak dipindah ke sini.
--    Menggabungkannya akan menduplikasi logika saldo yang sudah punya satu
--    pemilik.
-- ════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════
--  BAGIAN 1 — create_wallet
--
--  ┌─ PALING PENTING DI SELURUH FILE INI ──────────────────────────────────┐
--  │ COUNT-nya `WHERE user_id = auth.uid()` — HANYA DOMPET MILIK SENDIRI.  │
--  │ Dompet bersama tempat user menjadi ANGGOTA (wallet_members) TIDAK     │
--  │ boleh ikut terhitung.                                                 │
--  │                                                                       │
--  │ Kalau salah dan ikut menghitung keanggotaan, seorang Basic yang       │
--  │ diundang ke satu dompet teman langsung kehabisan kuota dan TIDAK BISA │
--  │ MEMBUAT DOMPET PERTAMANYA SENDIRI — diblokir gara-gara dompet orang   │
--  │ lain. Itu persis bug yang sudah pernah terjadi dan sudah diperbaiki   │
--  │ di sisi klien (keputusan Q4 Task 4: `accounts` vs `visibleAccounts`   │
--  │ di useWallets.createAccount). Gerbang server ini WAJIB memakai aturan │
--  │ hitung yang sama, kalau tidak kita memasang ulang bug yang sama satu  │
--  │ lapis di bawahnya.                                                    │
--  │                                                                       │
--  │ `wallets` adalah SATU-SATUNYA dari empat tabel ini yang punya konsep  │
--  │ kepemilikan bersama. savings/custom_categories/debts tidak punya      │
--  │ analoginya sama sekali, jadi jebakan ini tidak ada di tiga fungsi     │
--  │ lain. JANGAN "menyeragamkan" keempatnya dengan menyalin COUNT dari    │
--  │ sini ke sana atau sebaliknya tanpa membaca catatan ini.               │
--  └───────────────────────────────────────────────────────────────────────┘
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_wallet(
  p_name       text,
  p_bank       text    DEFAULT '',
  p_type       text    DEFAULT 'bank',
  p_balance    numeric DEFAULT 0,
  p_is_primary boolean DEFAULT false
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  -- SINKRON MANUAL, ubah juga di planLimits.js kalau ini berubah
  -- (PLAN_LIMITS.basic.maxWallets).
  c_max_basic constant integer := 1;

  v_user_id uuid := auth.uid();
  v_is_pro  boolean;
  v_count   integer;
  v_row     public.wallets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_wallet: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- Kunci + baca plan. Lihat "CARA KUNCINYA BEKERJA" di header.
  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (v_user_id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT (s.plan = 'pro' AND (s.expires_at IS NULL OR s.expires_at > now()))
    INTO v_is_pro
  FROM public.user_subscriptions s
  WHERE s.user_id = v_user_id
  FOR UPDATE;

  -- COALESCE: kalau baris langganan entah bagaimana tetap tidak ada,
  -- perlakukan sebagai Basic (fail-closed, sama seperti klien saat loading).
  IF NOT COALESCE(v_is_pro, false) THEN
    -- HANYA dompet milik sendiri — lihat kotak di atas.
    SELECT count(*) INTO v_count
    FROM public.wallets w
    WHERE w.user_id = v_user_id;

    IF v_count >= c_max_basic THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached', 'data', NULL);
    END IF;
  END IF;

  -- Hanya kolom base schema. `color`/`last4` sengaja tidak disentuh: klien
  -- menulisnya lewat UPDATE susulan yang toleran kalau kolomnya belum ada
  -- (schema drift lama), dan memindahkannya ke sini akan membuat fungsi ini
  -- gagal total di database yang belum punya kolom itu.
  INSERT INTO public.wallets (user_id, name, bank, type, balance, is_primary)
  VALUES (
    v_user_id,
    COALESCE(p_name, ''),
    COALESCE(p_bank, ''),
    COALESCE(p_type, 'bank'),
    COALESCE(p_balance, 0),
    COALESCE(p_is_primary, false)
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'reason', NULL, 'data', to_jsonb(v_row));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_wallet(text, text, text, numeric, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_wallet(text, text, text, numeric, boolean) TO authenticated;

COMMENT ON FUNCTION public.create_wallet(text, text, text, numeric, boolean) IS
  'Gerbang SERVER limit dompet Basic (maks 1, sinkron manual dengan PLAN_LIMITS.basic.maxWallets) + INSERT dalam satu transaksi. COUNT hanya menghitung dompet MILIK SENDIRI (user_id = auth.uid()); dompet bersama tempat pemanggil jadi anggota TIDAK ikut dihitung — kalau ikut, user Basic yang diundang ke dompet teman tidak bisa membuat dompet pertamanya sendiri. Race ditutup dengan mengunci baris user_subscriptions pemanggil (SELECT ... FOR UPDATE), bukan baris wallets — sesuatu yang belum ada tidak bisa dikunci. Mengembalikan {ok, reason, data}; reason "limit_reached" saat kuota habis. Kolom color/last4 tidak ditulis di sini (klien menulisnya lewat UPDATE susulan).';


-- ════════════════════════════════════════════════════
--  BAGIAN 2 — create_savings_goal
--
--  Paling sederhana dari keempatnya: tabel savings TIDAK punya soft delete
--  sama sekali (tidak ada kolom is_deleted), jadi COUNT-nya apa adanya tanpa
--  filter apa pun. Ini sengaja disebut eksplisit karena dua tetangganya
--  (custom_categories dan debts) justru WAJIB memfilter, dan menyalin salah
--  satu dari mereka ke sini akan menambahkan filter atas kolom yang tidak ada
--  (error 42703) — atau sebaliknya, menyalin dari sini ke sana membuka celah.
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_savings_goal(
  p_name     text,
  p_target   numeric DEFAULT 0,
  p_current  numeric DEFAULT 0,
  p_deadline date    DEFAULT NULL,
  p_color    text    DEFAULT '#5C6B4C',
  p_icon     text    DEFAULT 'star'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  -- SINKRON MANUAL, ubah juga di planLimits.js kalau ini berubah
  -- (PLAN_LIMITS.basic.maxSavingsGoals).
  c_max_basic constant integer := 2;

  v_user_id uuid := auth.uid();
  v_is_pro  boolean;
  v_count   integer;
  v_row     public.savings%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_savings_goal: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (v_user_id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT (s.plan = 'pro' AND (s.expires_at IS NULL OR s.expires_at > now()))
    INTO v_is_pro
  FROM public.user_subscriptions s
  WHERE s.user_id = v_user_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_pro, false) THEN
    -- Semua baris memakan kuota: tidak ada soft delete di tabel ini.
    SELECT count(*) INTO v_count
    FROM public.savings g
    WHERE g.user_id = v_user_id;

    IF v_count >= c_max_basic THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached', 'data', NULL);
    END IF;
  END IF;

  -- deadline_label / deadline_date sengaja tidak ditulis di sini — sama
  -- alasannya dengan color/last4 di create_wallet: klien mengisinya lewat
  -- UPDATE susulan yang toleran terhadap kolom yang belum ada.
  INSERT INTO public.savings (user_id, name, target, current, deadline, color, icon)
  VALUES (
    v_user_id,
    COALESCE(p_name, ''),
    COALESCE(p_target, 0),
    COALESCE(p_current, 0),
    p_deadline,                              -- NULL = tanpa tenggat (kolom nullable)
    COALESCE(NULLIF(p_color, ''), '#5C6B4C'),
    COALESCE(NULLIF(p_icon, ''), 'star')
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'reason', NULL, 'data', to_jsonb(v_row));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_savings_goal(text, numeric, numeric, date, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_savings_goal(text, numeric, numeric, date, text, text) TO authenticated;

COMMENT ON FUNCTION public.create_savings_goal(text, numeric, numeric, date, text, text) IS
  'Gerbang SERVER limit target tabungan Basic (maks 2, sinkron manual dengan PLAN_LIMITS.basic.maxSavingsGoals) + INSERT dalam satu transaksi. COUNT menghitung SEMUA baris savings milik pemanggil tanpa filter — tabel ini tidak punya soft delete. Race ditutup dengan mengunci baris user_subscriptions pemanggil (SELECT ... FOR UPDATE). Mengembalikan {ok, reason, data}; reason "limit_reached" saat kuota habis. Kolom deadline_label/deadline_date tidak ditulis di sini (klien menulisnya lewat UPDATE susulan).';


-- ════════════════════════════════════════════════════
--  BAGIAN 3 — create_custom_category
--
--  COUNT WAJIB `is_deleted = false`: kategori yang sudah di-soft-delete tidak
--  memakan kuota (baris itu dipertahankan HANYA supaya transaksi lama masih
--  bisa me-resolve nama/warnanya). Aturannya sama persis dengan yang dipakai
--  klien di useCustomCategories.addCustomCategory dan di memo
--  categoriesWithLock.
--
--  Duplikat nama TIDAK ditangani di sini — lihat "KONTRAK RETURN" poin 2 di
--  header: unique_violation dibiarkan naik apa adanya supaya cabang 23505 di
--  klien tetap jalan.
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_custom_category(
  p_name  text,
  p_color text DEFAULT 'var(--sage)',
  p_type  text DEFAULT 'expense',
  p_icon  text DEFAULT 'other'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  -- SINKRON MANUAL, ubah juga di planLimits.js kalau ini berubah
  -- (PLAN_LIMITS.basic.maxCustomCategories).
  c_max_basic constant integer := 3;

  v_user_id uuid := auth.uid();
  v_is_pro  boolean;
  v_count   integer;
  v_row     public.custom_categories%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_custom_category: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (v_user_id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT (s.plan = 'pro' AND (s.expires_at IS NULL OR s.expires_at > now()))
    INTO v_is_pro
  FROM public.user_subscriptions s
  WHERE s.user_id = v_user_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_pro, false) THEN
    -- HANYA yang belum di-soft-delete.
    SELECT count(*) INTO v_count
    FROM public.custom_categories c
    WHERE c.user_id = v_user_id
      AND c.is_deleted = false;

    IF v_count >= c_max_basic THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached', 'data', NULL);
    END IF;
  END IF;

  INSERT INTO public.custom_categories (user_id, name, color, type, icon)
  VALUES (
    v_user_id,
    COALESCE(p_name, ''),
    COALESCE(NULLIF(p_color, ''), 'var(--sage)'),
    COALESCE(NULLIF(p_type,  ''), 'expense'),
    COALESCE(NULLIF(p_icon,  ''), 'other')
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'reason', NULL, 'data', to_jsonb(v_row));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_custom_category(text, text, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_custom_category(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.create_custom_category(text, text, text, text) IS
  'Gerbang SERVER limit kategori kustom Basic (maks 3, sinkron manual dengan PLAN_LIMITS.basic.maxCustomCategories) + INSERT dalam satu transaksi. COUNT hanya menghitung baris is_deleted = false — kategori yang sudah di-soft-delete tidak memakan kuota. Race ditutup dengan mengunci baris user_subscriptions pemanggil (SELECT ... FOR UPDATE). Mengembalikan {ok, reason, data}; reason "limit_reached" saat kuota habis. Duplikat nama TIDAK ditangani di sini: unique_violation (23505) dibiarkan naik apa adanya supaya penanganan duplikat di klien tetap berlaku.';


-- ════════════════════════════════════════════════════
--  BAGIAN 4 — create_debt
--
--  SATU-SATUNYA yang menegakkan DUA aturan sekaligus, dan itu alasan utama
--  kenapa keluarga ini berbentuk fungsi dan bukan policy (lihat alasan #2 di
--  header — policy hanya punya satu pesan untuk semua kegagalan):
--
--    (1) MAKS 5 CATATAN AKTIF sekaligus  → status='active' AND is_deleted=false
--    (2) MAKS 5 PEMBUATAN / 50 HARI rolling → SEMUA baris created_at dalam
--        jendela, TERMASUK yang sudah lunas maupun soft-deleted.
--
--  Aturan (2) itulah yang membuat "hapus lalu buat lagi" tidak menghasilkan
--  slot gratis — karena itu filternya sengaja TIDAK memakai is_deleted sama
--  sekali. Replikasi persis checkCreateAllowed di src/hooks/useDebts.js
--  (baris 219-239): ambang jendela memakai angka yang SAMA dengan batas
--  aktif (maxActive), bukan konstanta tersendiri.
--
--  Keduanya digabung di SATU fungsi bersama INSERT-nya, bukan dua fungsi yang
--  dipanggil berurutan: dua panggilan terpisah berarti dua transaksi, dan
--  jendela di antaranya adalah race yang persis ingin ditutup file ini.
--
--  TANGGAL "boleh lagi" DIHITUNG DALAM WIB, bukan UTC. now() dan created_at
--  bertipe timestamptz (instant, tidak ambigu), tapi yang dikembalikan ke UI
--  adalah TANGGAL KALENDER — dan kalender di aplikasi ini selalu WIB (lihat
--  CLAUDE.md "Dates are local (WIB), never UTC"). Tanpa `AT TIME ZONE
--  'Asia/Jakarta'`, setiap perhitungan antara 00:00-07:00 WIB akan meleset
--  satu hari dari yang dihitung klien untuk data yang sama.
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_debt(
  p_type           text,
  p_person_name    text,
  p_amount         numeric,
  p_wallet_id      uuid    DEFAULT NULL,
  p_date           date    DEFAULT NULL,
  p_due_date       date    DEFAULT NULL,
  p_note           text    DEFAULT NULL,
  p_cash_disbursed boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  -- SINKRON MANUAL, ubah juga di planLimits.js kalau ini berubah
  -- (PLAN_LIMITS.basic.maxActiveDebts dan .debtCooldownDays).
  c_max_active    constant integer := 5;
  c_cooldown_days constant integer := 50;
  -- Ambang jendela rolling. SENGAJA sama dengan c_max_active dan bukan
  -- konstanta ketiga: klien memakai `maxActive` untuk kedua ambang
  -- (useDebts.js, `(count ?? 0) >= maxActive`). Kalau di sini dipisah jadi
  -- angka lain, server dan klien akan menolak pada titik yang berbeda dan
  -- user melihat gerbang yang "pindah-pindah".
  c_max_per_window constant integer := c_max_active;

  v_user_id      uuid := auth.uid();
  v_is_pro       boolean;
  v_active_count integer;
  v_window_start timestamptz;
  v_window_count integer;
  v_oldest       timestamptz;
  v_until        date;
  v_amount       numeric;
  v_person       text;
  v_cash         boolean;
  v_row          public.debts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_debt: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- ── Validasi bentuk. Sama dengan yang sudah dilakukan klien; diulang di
  -- sini karena fungsi ini adalah gerbang terakhir sebelum baris masuk.
  IF COALESCE(p_type, '') NOT IN ('receivable', 'payable') THEN
    RAISE EXCEPTION 'create_debt: type harus receivable atau payable' USING ERRCODE = '22023';
  END IF;

  v_amount := abs(COALESCE(p_amount, 0));
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'create_debt: nominal harus lebih dari nol' USING ERRCODE = '22023';
  END IF;

  v_person := btrim(COALESCE(p_person_name, ''));
  IF v_person = '' THEN
    RAISE EXCEPTION 'create_debt: nama orang wajib diisi' USING ERRCODE = '22023';
  END IF;

  -- Hutang (payable) selalu dianggap uangnya sudah berpindah saat dibuat —
  -- tidak ada opsi untuk itu di UI, jadi dipaksa true apa pun yang dikirim.
  -- Cerminan persis logika cashDisbursedAtCreation di useDebts.createDebt.
  v_cash := CASE WHEN p_type = 'payable' THEN true ELSE COALESCE(p_cash_disbursed, true) END;

  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (v_user_id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT (s.plan = 'pro' AND (s.expires_at IS NULL OR s.expires_at > now()))
    INTO v_is_pro
  FROM public.user_subscriptions s
  WHERE s.user_id = v_user_id
  FOR UPDATE;

  IF NOT COALESCE(v_is_pro, false) THEN
    -- ── Aturan (1): maks catatan AKTIF sekaligus.
    SELECT count(*) INTO v_active_count
    FROM public.debts d
    WHERE d.user_id    = v_user_id
      AND d.status     = 'active'
      AND d.is_deleted = false;

    IF v_active_count >= c_max_active THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'limit_active', 'data', NULL);
    END IF;

    -- ── Aturan (2): jendela rolling. TANPA filter is_deleted/status —
    -- pembuatan yang sudah dihapus atau sudah lunas tetap menghabiskan slot.
    v_window_start := now() - make_interval(days => c_cooldown_days);

    SELECT count(*) INTO v_window_count
    FROM public.debts d
    WHERE d.user_id = v_user_id
      AND d.created_at >= v_window_start;

    IF v_window_count >= c_max_per_window THEN
      -- Pembuatan TERTUA di dalam jendela + cooldown = kapan boleh lagi.
      SELECT min(d.created_at) INTO v_oldest
      FROM public.debts d
      WHERE d.user_id = v_user_id
        AND d.created_at >= v_window_start;

      -- Tanggal kalender WIB — lihat catatan zona waktu di header bagian ini.
      v_until := ((v_oldest + make_interval(days => c_cooldown_days))
                    AT TIME ZONE 'Asia/Jakarta')::date;

      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'cooldown',
        'data', jsonb_build_object('cooldown_until', v_until)
      );
    END IF;
  END IF;

  INSERT INTO public.debts (
    user_id, type, person_name, note, amount, paid,
    wallet_id, date, due_date, status, cash_disbursed_at_creation
  )
  VALUES (
    v_user_id,
    p_type,
    v_person,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    v_amount,
    0,
    p_wallet_id,
    -- Tanggal hari ini dalam WIB, BUKAN CURRENT_DATE. CURRENT_DATE di server
    -- adalah tanggal UTC: antara 00:00-07:00 WIB dia masih menunjuk hari
    -- kemarin, dan catatan akan tercatat mundur satu hari dari yang dilihat
    -- user. Kolomnya memang ber-DEFAULT CURRENT_DATE, tapi jalur ini tidak
    -- memakai default itu.
    COALESCE(p_date, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    p_due_date,
    'active',
    v_cash
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'reason', NULL, 'data', to_jsonb(v_row));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_debt(text, text, numeric, uuid, date, date, text, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_debt(text, text, numeric, uuid, date, date, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.create_debt(text, text, numeric, uuid, date, date, text, boolean) IS
  'Gerbang SERVER limit hutang/piutang Basic + INSERT dalam satu transaksi. Menegakkan DUA aturan sekaligus (sinkron manual dengan PLAN_LIMITS.basic.maxActiveDebts dan .debtCooldownDays): (1) maks 5 catatan AKTIF sekaligus (status=active AND is_deleted=false) → reason "limit_active"; (2) maks 5 PEMBUATAN per 50 hari rolling, menghitung SEMUA baris created_at dalam jendela termasuk yang lunas maupun soft-deleted → reason "cooldown", dengan data.cooldown_until = tanggal kalender WIB saat boleh membuat lagi. Aturan (2) itu yang membuat hapus-lalu-buat-ulang tidak memberi slot gratis. Race ditutup dengan mengunci baris user_subscriptions pemanggil (SELECT ... FOR UPDATE). Transaksi pokok tertaut TIDAK dibuat di sini — tetap lewat record_transaction dari klien. wallet_id tidak divalidasi kepemilikannya (celah yang sudah ada sebelumnya di INSERT langsung, di luar cakupan).';
