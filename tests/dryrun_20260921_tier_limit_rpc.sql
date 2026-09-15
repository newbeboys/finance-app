-- ════════════════════════════════════════════════════════════════════
--  DRY-RUN migrasi 20260921000000_add_tier_limit_rpcs
--  File: tests/dryrun_20260921_tier_limit_rpc.sql
--
--  CARA PAKAI: tempel SELURUH isi file ini ke Supabase SQL Editor → Run.
--
--  AMAN: script SENGAJA diakhiri RAISE EXCEPTION. Semua statement dalam satu
--  kali Run berjalan dalam SATU transaksi implisit, jadi error di akhir
--  membatalkan SEMUANYA (fungsi, user palsu, dompet, tabungan, kategori,
--  hutang). JANGAN tambahkan BEGIN/COMMIT. Hasil uji muncul sebagai PESAN
--  ERROR berjudul "HASIL DRY-RUN" — itu yang diharapkan, bukan kegagalan.
--  Kalau pesan error-nya BUKAN "HASIL DRY-RUN" (mis. syntax error atau
--  permission denied), script berhenti di situ dan tetap dibatalkan seluruhnya.
--
--  Untuk memastikan data palsu benar-benar ikut dibatalkan, jalankan sebagai
--  query TERPISAH sesudah Run — hasilnya harus 0:
--    SELECT count(*) FROM auth.users WHERE email LIKE '%@dryrun.invalid';
--
--  JUMLAH UJI: 28 — hasil yang diharapkan "LULUS 28/28".
--    BAGIAN C  create_wallet           W0-W6  7 uji
--    BAGIAN D  create_savings_goal     S1-S5  5 uji
--    BAGIAN E  create_custom_category  K1-K5  5 uji
--    BAGIAN F  create_debt             F1-F7  7 uji
--    BAGIAN G  struktur & izin         G1-G4  4 uji
--
--  ┌─ APA YANG UJI "(d) RACE" DI SINI BENAR-BENAR BUKTIKAN ────────────────┐
--  │ Pasangan uji W4/W5, S3/S4, K3/K4, F5/F6 adalah DUA PANGGILAN RPC      │
--  │ BERUNTUN dari sesi yang sama. Yang dibuktikannya: panggilan kedua     │
--  │ MELIHAT baris yang baru disisipkan panggilan pertama dan menolak —    │
--  │ yaitu cek-limit dan INSERT benar-benar satu kesatuan atomik, bukan    │
--  │ dua langkah yang bisa dibaca dari state basi. Itu separuh dari jaminan│
--  │ yang dicari, dan separuh yang bisa diuji dari satu koneksi.           │
--  │                                                                       │
--  │ Yang TIDAK bisa dibuktikan satu koneksi: bahwa FOR UPDATE benar-benar │
--  │ MEMBLOKIR sesi lain. Dua panggilan di transaksi yang sama memegang    │
--  │ kunci yang sama, jadi tidak pernah ada kontensi untuk diamati. Uji G  │
--  │ menutup sebagian sisanya secara STRUKTURAL (memastikan FOR UPDATE     │
--  │ atas user_subscriptions memang ada di definisi keempat fungsi), tapi  │
--  │ pembuktian perilakunya butuh DUA koneksi dan harus dilakukan manual:  │
--  │                                                                       │
--  │   Sesi 1:  BEGIN; SELECT public.create_wallet('A');   -- JANGAN commit│
--  │   Sesi 2:  BEGIN; SELECT public.create_wallet('B');   -- HARUS diam   │
--  │                                                       -- menggantung  │
--  │   Sesi 1:  COMMIT;                                                    │
--  │   Sesi 2:  langsung lanjut, hasilnya HARUS ok=false/limit_reached.    │
--  │                                                                       │
--  │ Kalau sesi 2 langsung menjawab tanpa menggantung, kuncinya tidak      │
--  │ kena dan racenya masih terbuka — apa pun hasil uji di file ini.       │
--  └───────────────────────────────────────────────────────────────────────┘
--
--  BAGIAN A adalah SALINAN file migrasi. Kalau migrasinya berubah, BAGIAN A
--  wajib disalin ulang. Cek kesamaan dari root worktree (Git Bash):
--    diff <(sed -n '/^-- >>> BAGIAN A MULAI/,/^-- <<< BAGIAN A SELESAI/p' tests/dryrun_20260921_tier_limit_rpc.sql | sed '1d;$d') supabase/migrations/20260921000000_add_tier_limit_rpcs.sql && echo IDENTIK
-- ════════════════════════════════════════════════════════════════════

-- >>> BAGIAN A MULAI — salinan persis supabase/migrations/20260921000000_add_tier_limit_rpcs.sql
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
-- <<< BAGIAN A SELESAI

-- ════════════════════════════════════════════════════════════════════
--  BAGIAN B — helper uji (fungsi pg_temp, ikut dibatalkan)
-- ════════════════════════════════════════════════════════════════════

-- starts_with(), bukan LIKE: pesan/hasil bisa mengandung '_' yang di LIKE
-- berarti "karakter apa pun", jadi LIKE bisa meloloskan hasil yang beda.
CREATE FUNCTION pg_temp.dr_line(p_label text, p_expect text, p_actual text)
RETURNS text LANGUAGE sql AS $f$
  SELECT CASE WHEN starts_with(COALESCE(p_actual, '<NULL>'), p_expect) THEN '[ OK  ] ' ELSE '[GAGAL] ' END
      || p_label
      || E'\n          harapan: ' || p_expect
      || E'\n          hasil  : ' || COALESCE(p_actual, '<NULL>') || E'\n';
$f$;

-- ────────────────────────────────────────────────────────────────────
--  Helper pemanggil RPC — satu per fungsi.
--
--  Keempat fungsi yang diuji adalah SECURITY DEFINER: RLS tidak berlaku di
--  dalamnya dan role pemanggil tidak memengaruhi keputusannya. Yang
--  menentukan hanya auth.uid(), jadi yang diset cukup request.jwt.claims —
--  role SENGAJA tidak diganti (sama seperti helper dr_rpc di
--  tests/dryrun_20260919_owner_delete.sql).
--
--  BEDA PENTING dari dryrun owner-delete: helper di sini TIDAK membatalkan
--  efeknya sendiri. Baris yang berhasil dibuat HARUS tetap ada, karena
--  justru itu yang dilihat panggilan berikutnya pada uji race (W4→W5 dst).
--  Supaya uji tidak saling mencemari, tiap skenario memakai USER PALSU
--  SENDIRI dengan data yang di-seed persis untuk skenario itu.
--
--  Blok EXCEPTION tetap ada untuk menangkap RAISE dari dalam fungsi (mis.
--  42501 sesi kosong). Konsekuensi yang disengaja: kalau sebuah panggilan
--  melempar, subtransaksinya rollback — persis perilaku yang diinginkan
--  untuk kasus error.
-- ────────────────────────────────────────────────────────────────────

CREATE FUNCTION pg_temp.dr_wallet(p_actor uuid, p_name text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_res jsonb; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    v_res := public.create_wallet(p_name);
    v_out := CASE WHEN (v_res->>'ok')::boolean
                  THEN format('LOLOS nama=%s', v_res->'data'->>'name')
                  ELSE format('DITOLAK %s', v_res->>'reason') END;
  EXCEPTION WHEN OTHERS THEN
    v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
  END;
  RETURN v_out;
END $f$;

CREATE FUNCTION pg_temp.dr_savings(p_actor uuid, p_name text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_res jsonb; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    v_res := public.create_savings_goal(p_name);
    v_out := CASE WHEN (v_res->>'ok')::boolean
                  THEN format('LOLOS nama=%s', v_res->'data'->>'name')
                  ELSE format('DITOLAK %s', v_res->>'reason') END;
  EXCEPTION WHEN OTHERS THEN
    v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
  END;
  RETURN v_out;
END $f$;

CREATE FUNCTION pg_temp.dr_cat(p_actor uuid, p_name text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_res jsonb; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    v_res := public.create_custom_category(p_name);
    v_out := CASE WHEN (v_res->>'ok')::boolean
                  THEN format('LOLOS nama=%s', v_res->'data'->>'name')
                  ELSE format('DITOLAK %s', v_res->>'reason') END;
  EXCEPTION WHEN OTHERS THEN
    v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
  END;
  RETURN v_out;
END $f$;

-- Menampilkan `cooldown_until` pada penolakan cooldown — itu nilai yang
-- diperiksa uji F3 (dan satu-satunya tempat zona waktu WIB bisa meleset).
CREATE FUNCTION pg_temp.dr_debt(p_actor uuid, p_person text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_res jsonb; v_out text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
    v_res := public.create_debt('payable', p_person, 10000);
    v_out := CASE WHEN (v_res->>'ok')::boolean
                  THEN format('LOLOS nama=%s', v_res->'data'->>'person_name')
                  ELSE format('DITOLAK %s%s', v_res->>'reason',
                         COALESCE(' until=' || (v_res->'data'->>'cooldown_until'), '')) END;
  EXCEPTION WHEN OTHERS THEN
    v_out := format('ERROR %s "%s"', SQLSTATE, SQLERRM);
  END;
  RETURN v_out;
END $f$;

-- ────────────────────────────────────────────────────────────────────
--  Helper UJI STRUKTUR & IZIN (BAGIAN G)
--
--  `public` BUKAN role sungguhan di pg_roles, jadi has_function_privilege
--  tidak bisa ditanyai soal PUBLIC. Dibaca langsung dari proacl:
--  aclexplode() memberi grantee = 0 untuk PUBLIC. proacl NULL berarti ACL
--  DEFAULT — dan default untuk fungsi adalah EXECUTE TO PUBLIC — jadi NULL
--  harus dibaca sebagai "PUBLIC MASIH PUNYA AKSES", bukan sebaliknya.
-- ────────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.dr_struct(p_signature text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_oid oid; v_def text; v_public boolean;
BEGIN
  v_oid := p_signature::regprocedure;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  SELECT (p.proacl IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0))
    INTO v_public
  FROM pg_proc p WHERE p.oid = v_oid;

  RETURN format('forupdate=%s secdef=%s searchpath=%s publicdicabut=%s anon=%s auth=%s',
    (v_def ~* 'FROM public\.user_subscriptions[^;]*FOR UPDATE'),
    (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_oid),
    (SELECT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, array[]::text[])) c
                    WHERE c LIKE 'search_path=%') FROM pg_proc p WHERE p.oid = v_oid),
    v_public,
    has_function_privilege('anon', v_oid, 'EXECUTE'),
    has_function_privilege('authenticated', v_oid, 'EXECUTE'));
END $f$;

-- ════════════════════════════════════════════════════════════════════
--  Data palsu + BAGIAN C, D, E, F, G
-- ════════════════════════════════════════════════════════════════════
DO $dr$
DECLARE
  -- ── Pelaku uji create_wallet
  wa   uuid := gen_random_uuid();  -- Basic, SUDAH punya 1 dompet (pas di limit)
  wb   uuid := gen_random_uuid();  -- Basic, 0 dompet
  wc   uuid := gen_random_uuid();  -- Basic, 0 dompet SENDIRI tapi anggota dompet bersama
  wd   uuid := gen_random_uuid();  -- Basic, 0 dompet (uji race)
  wp   uuid := gen_random_uuid();  -- PRO, 3 dompet
  wown uuid := gen_random_uuid();  -- pemilik dompet bersama yang mengundang `wc`
  wsh  uuid := gen_random_uuid();  -- dompet bersama milik `wown`

  -- ── Pelaku uji create_savings_goal
  sa uuid := gen_random_uuid();    -- Basic, 2 target (pas di limit)
  sb uuid := gen_random_uuid();    -- Basic, 1 target
  sd uuid := gen_random_uuid();    -- Basic, 1 target (uji race)
  sp uuid := gen_random_uuid();    -- PRO, 5 target

  -- ── Pelaku uji create_custom_category
  ka uuid := gen_random_uuid();    -- Basic, 3 kategori aktif (pas di limit)
  kb uuid := gen_random_uuid();    -- Basic, 2 aktif + 1 SOFT-DELETED
  kd uuid := gen_random_uuid();    -- Basic, 2 aktif (uji race)
  kp uuid := gen_random_uuid();    -- PRO, 5 kategori aktif

  -- ── Pelaku uji create_debt
  fa uuid := gen_random_uuid();    -- Basic, 5 catatan AKTIF (pas di limit)
  fb uuid := gen_random_uuid();    -- Basic, 4 catatan aktif
  fc uuid := gen_random_uuid();    -- Basic, 0 aktif tapi 5 pembuatan DI DALAM jendela
  fe uuid := gen_random_uuid();    -- Basic, 0 aktif, 5 pembuatan DI LUAR jendela
  fd uuid := gen_random_uuid();    -- Basic, 4 catatan aktif (uji race)
  fp uuid := gen_random_uuid();    -- PRO, 10 catatan aktif

  -- Instan seed untuk uji cooldown: 10 hari lalu, pukul 01:00 WIB.
  -- Jam 01:00 WIB = 18:00 UTC HARI SEBELUMNYA — dipilih sengaja supaya
  -- tanggal UTC dan tanggal WIB dari instan yang sama SELALU berbeda, kapan
  -- pun skrip ini dijalankan. Akibatnya uji F3 di bawah akan GAGAL kalau
  -- create_debt menghitung cooldown_until dalam UTC (hasilnya akan mundur
  -- satu hari), dan LULUS hanya kalau perhitungannya WIB.
  v_seed  timestamptz := (((now() AT TIME ZONE 'Asia/Jakarta')::date - 10) + time '01:00')
                           AT TIME ZONE 'Asia/Jakarta';
  -- Harapan F3, dirakit dengan cara BERBEDA dari yang dipakai fungsi
  -- (tanggal WIB hari ini + 40 hari) supaya bukan sekadar mengulang rumus
  -- yang sama: seed 10 hari lalu + cooldown 50 hari = 40 hari ke depan.
  v_expect_until text := (((now() AT TIME ZONE 'Asia/Jakarta')::date + 40))::text;

  r       text := '';
  v_ok    int;
  v_gagal int;
BEGIN
  -- ══════════════════════════════════════════════════════════════════
  --  SEED
  --  Trigger on_auth_user_created_subscription otomatis membuat baris
  --  user_subscriptions 'basic' untuk tiap user baru di bawah, jadi yang
  --  perlu ditulis manual hanya yang PRO.
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO auth.users (id, aud, role, email)
  SELECT u, 'authenticated', 'authenticated', 'dr-' || u || '@dryrun.invalid'
  FROM unnest(ARRAY[wa, wb, wc, wd, wp, wown, sa, sb, sd, sp,
                    ka, kb, kd, kp, fa, fb, fc, fe, fd, fp]) AS u;

  UPDATE public.user_subscriptions
  SET    plan = 'pro', expires_at = now() + interval '30 days'
  WHERE  user_id IN (wp, sp, kp, fp);

  -- ── Dompet
  INSERT INTO public.wallets (user_id, name, type, balance) VALUES
    (wa,   'DR seed wa',   'cash', 0),
    (wown, 'DR bersama',   'cash', 0);
  -- Dompet bersama `wsh` disisipkan terpisah supaya id-nya diketahui.
  INSERT INTO public.wallets (id, user_id, name, type, balance)
  VALUES (wsh, wown, 'DR dompet bersama', 'cash', 0);

  INSERT INTO public.wallets (user_id, name, type, balance)
  SELECT wp, 'DR seed wp ' || i, 'cash', 0 FROM generate_series(1, 3) AS i;

  -- `wc` jadi ANGGOTA AKTIF dompet milik `wown` — dan TIDAK punya dompet
  -- sendiri satu pun. Inilah bahan uji W0/W3.
  INSERT INTO public.wallet_members (wallet_id, user_id, role, status, invited_by, joined_at)
  VALUES (wsh, wc, 'editor', 'active', wown, now());

  -- ── Tabungan
  INSERT INTO public.savings (user_id, name, target, current)
  SELECT sa, 'DR seed sa ' || i, 100000, 0 FROM generate_series(1, 2) AS i;
  INSERT INTO public.savings (user_id, name, target, current) VALUES (sb, 'DR seed sb', 100000, 0);
  INSERT INTO public.savings (user_id, name, target, current) VALUES (sd, 'DR seed sd', 100000, 0);
  INSERT INTO public.savings (user_id, name, target, current)
  SELECT sp, 'DR seed sp ' || i, 100000, 0 FROM generate_series(1, 5) AS i;

  -- ── Kategori kustom
  INSERT INTO public.custom_categories (user_id, name, type)
  SELECT ka, 'DR seed ka ' || i, 'expense' FROM generate_series(1, 3) AS i;
  -- `kb`: 2 aktif + 1 soft-deleted. Yang soft-deleted TIDAK boleh memakan
  -- kuota — kalau ikut terhitung, kb dianggap 3/3 dan uji K2 gagal.
  INSERT INTO public.custom_categories (user_id, name, type, is_deleted) VALUES
    (kb, 'DR seed kb 1', 'expense', false),
    (kb, 'DR seed kb 2', 'expense', false),
    (kb, 'DR seed kb 3', 'expense', true);
  INSERT INTO public.custom_categories (user_id, name, type)
  SELECT kd, 'DR seed kd ' || i, 'expense' FROM generate_series(1, 2) AS i;
  INSERT INTO public.custom_categories (user_id, name, type)
  SELECT kp, 'DR seed kp ' || i, 'expense' FROM generate_series(1, 5) AS i;

  -- ── Hutang/piutang
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted)
  SELECT fa, 'payable', 'DR seed fa ' || i, 10000, 'active', false FROM generate_series(1, 5) AS i;
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted)
  SELECT fb, 'payable', 'DR seed fb ' || i, 10000, 'active', false FROM generate_series(1, 4) AS i;
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted)
  SELECT fd, 'payable', 'DR seed fd ' || i, 10000, 'active', false FROM generate_series(1, 4) AS i;
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted)
  SELECT fp, 'payable', 'DR seed fp ' || i, 10000, 'active', false FROM generate_series(1, 10) AS i;

  -- `fc`: NOL catatan aktif (3 soft-deleted + 2 lunas) tapi kelimanya DIBUAT
  -- di dalam jendela 50 hari. Aturan (1) lolos, aturan (2) yang menolak —
  -- inilah yang membuat hapus-lalu-buat-ulang tidak memberi slot gratis.
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted, created_at)
  SELECT fc, 'payable', 'DR seed fc hapus ' || i, 10000, 'active', true, v_seed FROM generate_series(1, 3) AS i;
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted, created_at)
  SELECT fc, 'payable', 'DR seed fc lunas ' || i, 10000, 'paid', false, v_seed FROM generate_series(1, 2) AS i;

  -- `fe`: sama persis dengan `fc` TAPI dibuat 60 hari lalu — DI LUAR jendela.
  -- Membuktikan jendelanya benar-benar rolling, bukan "seumur akun".
  INSERT INTO public.debts (user_id, type, person_name, amount, status, is_deleted, created_at)
  SELECT fe, 'payable', 'DR seed fe ' || i, 10000, 'paid', false,
         now() - interval '60 days' FROM generate_series(1, 5) AS i;

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN C — create_wallet  (7 uji)
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN C: create_wallet ---\n';

  -- W0 menjaga W3 tidak lulus secara semu: kalau seed keanggotaannya gagal,
  -- W3 hanya membuktikan "user tanpa dompet boleh bikin dompet" — pernyataan
  -- yang benar tapi sama sekali bukan yang sedang diuji.
  r := r || pg_temp.dr_line('W0  seed `wc` benar: 0 dompet sendiri, 1 keanggotaan aktif',
    'own=0 shared=1',
    format('own=%s shared=%s',
      (SELECT count(*) FROM public.wallets w WHERE w.user_id = wc),
      (SELECT count(*) FROM public.wallet_members m WHERE m.user_id = wc AND m.status = 'active')));

  r := r || pg_temp.dr_line('W1  [a] Basic PAS di limit (1 dompet) → ditolak',
    'DITOLAK limit_reached', pg_temp.dr_wallet(wa, 'DR w-a'));
  r := r || pg_temp.dr_line('W2  [b] Basic di BAWAH limit (0 dompet) → lolos',
    'LOLOS nama=DR w-b', pg_temp.dr_wallet(wb, 'DR w-b'));
  r := r || pg_temp.dr_line('W3  [c] Basic anggota dompet BERSAMA, 0 dompet sendiri → TETAP LOLOS',
    'LOLOS nama=DR w-c', pg_temp.dr_wallet(wc, 'DR w-c'));
  r := r || pg_temp.dr_line('W4  [d] race panggilan KE-1 (0 dompet) → lolos',
    'LOLOS nama=DR w-d1', pg_temp.dr_wallet(wd, 'DR w-d1'));
  r := r || pg_temp.dr_line('W5  [d] race panggilan KE-2 beruntun → DITOLAK (bukan dua-duanya lolos)',
    'DITOLAK limit_reached', pg_temp.dr_wallet(wd, 'DR w-d2'));
  r := r || pg_temp.dr_line('W6  Pro dengan 3 dompet → lolos (limit tidak berlaku)',
    'LOLOS nama=DR w-p', pg_temp.dr_wallet(wp, 'DR w-p'));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN D — create_savings_goal  (5 uji)
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN D: create_savings_goal ---\n';
  r := r || pg_temp.dr_line('S1  [a] Basic PAS di limit (2 target) → ditolak',
    'DITOLAK limit_reached', pg_temp.dr_savings(sa, 'DR s-a'));
  r := r || pg_temp.dr_line('S2  [b] Basic di BAWAH limit (1 target) → lolos',
    'LOLOS nama=DR s-b', pg_temp.dr_savings(sb, 'DR s-b'));
  r := r || pg_temp.dr_line('S3  [d] race panggilan KE-1 (1 target) → lolos',
    'LOLOS nama=DR s-d1', pg_temp.dr_savings(sd, 'DR s-d1'));
  r := r || pg_temp.dr_line('S4  [d] race panggilan KE-2 beruntun → DITOLAK',
    'DITOLAK limit_reached', pg_temp.dr_savings(sd, 'DR s-d2'));
  r := r || pg_temp.dr_line('S5  Pro dengan 5 target → lolos',
    'LOLOS nama=DR s-p', pg_temp.dr_savings(sp, 'DR s-p'));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN E — create_custom_category  (5 uji)
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN E: create_custom_category ---\n';
  r := r || pg_temp.dr_line('K1  [a] Basic PAS di limit (3 aktif) → ditolak',
    'DITOLAK limit_reached', pg_temp.dr_cat(ka, 'DR k-a'));
  r := r || pg_temp.dr_line('K2  [b] 2 aktif + 1 SOFT-DELETED → lolos (soft-deleted tak makan kuota)',
    'LOLOS nama=DR k-b', pg_temp.dr_cat(kb, 'DR k-b'));
  r := r || pg_temp.dr_line('K3  [d] race panggilan KE-1 (2 aktif) → lolos',
    'LOLOS nama=DR k-d1', pg_temp.dr_cat(kd, 'DR k-d1'));
  r := r || pg_temp.dr_line('K4  [d] race panggilan KE-2 beruntun → DITOLAK',
    'DITOLAK limit_reached', pg_temp.dr_cat(kd, 'DR k-d2'));
  r := r || pg_temp.dr_line('K5  Pro dengan 5 kategori → lolos',
    'LOLOS nama=DR k-p', pg_temp.dr_cat(kp, 'DR k-p'));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN F — create_debt  (7 uji)
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN F: create_debt ---\n';
  r := r || pg_temp.dr_line('F1  [a] Basic PAS di limit aktif (5) → ditolak limit_active',
    'DITOLAK limit_active', pg_temp.dr_debt(fa, 'DR f-a'));
  r := r || pg_temp.dr_line('F2  [b] Basic 4 aktif (jendela juga 4) → lolos',
    'LOLOS nama=DR f-b', pg_temp.dr_debt(fb, 'DR f-b'));
  r := r || pg_temp.dr_line('F3  0 aktif tapi 5 pembuatan DALAM jendela → cooldown, tanggal WIB',
    'DITOLAK cooldown until=' || v_expect_until, pg_temp.dr_debt(fc, 'DR f-c'));
  r := r || pg_temp.dr_line('F4  0 aktif, 5 pembuatan DI LUAR jendela (60 hari) → lolos',
    'LOLOS nama=DR f-e', pg_temp.dr_debt(fe, 'DR f-e'));
  r := r || pg_temp.dr_line('F5  [d] race panggilan KE-1 (4 aktif) → lolos',
    'LOLOS nama=DR f-d1', pg_temp.dr_debt(fd, 'DR f-d1'));
  r := r || pg_temp.dr_line('F6  [d] race panggilan KE-2 beruntun → DITOLAK',
    'DITOLAK limit_active', pg_temp.dr_debt(fd, 'DR f-d2'));
  r := r || pg_temp.dr_line('F7  Pro dengan 10 catatan aktif → lolos (tanpa cooldown)',
    'LOLOS nama=DR f-p', pg_temp.dr_debt(fp, 'DR f-p'));

  -- ══════════════════════════════════════════════════════════════════
  --  BAGIAN G — struktur & izin  (4 uji)
  --
  --  Bukan uji perilaku: yang diperiksa bentuk fungsinya. `forupdate`
  --  memastikan kunci atas user_subscriptions tidak pernah hilang saat
  --  fungsi ini diedit kemudian (lihat kotak "APA YANG UJI RACE BUKTIKAN"
  --  di kepala file — perilakunya sendiri hanya bisa diamati dua koneksi).
  --  Sisanya mengunci pola grant 20260723010000: PUBLIC & anon dicabut,
  --  authenticated saja yang boleh.
  -- ══════════════════════════════════════════════════════════════════
  r := r || E'\n--- BAGIAN G: struktur & izin ---\n';
  r := r || pg_temp.dr_line('G1  create_wallet',
    'forupdate=true secdef=true searchpath=true publicdicabut=true anon=false auth=true',
    pg_temp.dr_struct('public.create_wallet(text, text, text, numeric, boolean)'));
  r := r || pg_temp.dr_line('G2  create_savings_goal',
    'forupdate=true secdef=true searchpath=true publicdicabut=true anon=false auth=true',
    pg_temp.dr_struct('public.create_savings_goal(text, numeric, numeric, date, text, text)'));
  r := r || pg_temp.dr_line('G3  create_custom_category',
    'forupdate=true secdef=true searchpath=true publicdicabut=true anon=false auth=true',
    pg_temp.dr_struct('public.create_custom_category(text, text, text, text)'));
  r := r || pg_temp.dr_line('G4  create_debt',
    'forupdate=true secdef=true searchpath=true publicdicabut=true anon=false auth=true',
    pg_temp.dr_struct('public.create_debt(text, text, numeric, uuid, date, date, text, boolean)'));

  v_ok    := (length(r) - length(replace(r, '[ OK  ]', ''))) / length('[ OK  ]');
  v_gagal := (length(r) - length(replace(r, '[GAGAL]', ''))) / length('[GAGAL]');

  RAISE EXCEPTION E'\n==== HASIL DRY-RUN (SEMUA SUDAH DIBATALKAN) — LULUS %/% (harapan 28/28) ====\n%',
    v_ok, v_ok + v_gagal, r;
END $dr$;
