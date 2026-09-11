-- ════════════════════════════════════════════════════
--  FinanceApp — Fitur B (dompet bersama), Tahap 3: alur undangan.
--  Kode 6 digit (bukan email), generate/accept/leave/remove-member.
--
--  SATU FILE (sama alasannya dengan 20260912000000): supabase db push
--  menjalankan tiap file dalam satu transaksi — semua-atau-tidak-sama-sekali.
--
--  KEPUTUSAN PRODUK YANG DIKODEKAN DI SINI (final):
--    1. Berbagi dompet FITUR PRO-ONLY. generate_wallet_invite mengecek
--       plan Pro pemanggil DI DALAM RPC (bukan cuma client-side) — beda
--       dari limit transaksi/dompet Basic yang sengaja dicek client-side
--       saja, karena ini gerbang fitur yang kalau dilewati lewat panggilan
--       RPC langsung membuka data ke akun ketiga secara PERMANEN, bukan
--       sekadar kuota yang habis lalu bisa dipakai lagi bulan depan.
--    2. Kode expire 24 jam. Satu kode AKTIF per dompet — generate ulang
--       otomatis me-revoke kode lama (jadi tidak ada RPC "regenerate"
--       terpisah, generate_wallet_invite dipanggil ulang sudah cukup).
--    3. Kode SEKALI PAKAI — begitu diterima, status jadi 'accepted' dan
--       tidak bisa dipakai orang lain.
--    4. accept_wallet_invite MENOLAK bila pemanggil SUDAH jadi anggota
--       aktif — lihat "CATATAN KEAMANAN: UPSERT" di bawah.
-- ════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — Tabel wallet_invites
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wallet_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   uuid        NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  role        text        NOT NULL DEFAULT 'editor'
                            CHECK (role IN ('editor','viewer')),   -- TIDAK ada 'owner'
  status      text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','accepted','revoked')),
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wallet_invites IS
  'Kode undangan 6 digit dompet bersama (Fitur B, Task 3). Terpisah dari wallet_members karena siklus hidupnya beda: kode dibuat→ditebak→dipakai SEKALI/revoke/expired, sedangkan keanggotaan aktif→keluar. Satu kode status=active per wallet_id pada satu waktu (dijaga generate_wallet_invite, BUKAN oleh constraint DB).';

-- Unik HANYA di antara kode yang masih bisa ditebak (status='active'). Kode
-- yang sudah accepted/revoked boleh muncul lagi di kombinasi acak berikutnya
-- — 'active' adalah literal tetap jadi aman dipakai predikat index parsial
-- (beda dgn `expires_at > now()` yang tidak immutable, tidak bisa jadi predikat).
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_invites_active_code
  ON public.wallet_invites (code) WHERE status = 'active';

-- Lookup "kode aktif dompet ini" saat generate ulang (revoke yang lama).
CREATE INDEX IF NOT EXISTS idx_wallet_invites_wallet_active
  ON public.wallet_invites (wallet_id) WHERE status = 'active';

ALTER TABLE public.wallet_invites ENABLE ROW LEVEL SECURITY;

-- Baca: owner dompetnya saja (untuk UI Task 4 menampilkan status kode).
-- Sengaja TIDAK ada policy untuk penerima kode — dia tidak tahu row ini ada,
-- cuma tahu 6 digitnya. Tulis HANYA lewat RPC di bawah (tidak ada policy
-- INSERT/UPDATE/DELETE sama sekali, sejalan pola chat_rate_limits).
DROP POLICY IF EXISTS "wallet_invites: owner reads own wallet" ON public.wallet_invites;
CREATE POLICY "wallet_invites: owner reads own wallet"
  ON public.wallet_invites FOR SELECT
  USING (public.wallet_access_role(wallet_id) = 'owner');

-- ════════════════════════════════════════════════════
--  BAGIAN 2 — Tabel wallet_invite_attempts (rate limit)
-- ════════════════════════════════════════════════════
--  Pola identik chat_rate_limits (20260716000000): satu baris per user,
--  dikunci FOR UPDATE di dalam RPC untuk cek+increment atomik.
--
--  KENAPA PER-USER, BUKAN PER-KODE: kode salah tidak match baris manapun di
--  wallet_invites, jadi tidak ada baris invite untuk ditempeli penalti —
--  beda dari brute force PIN yang mengunci satu target spesifik. Satu-
--  satunya pertahanan RPC yang benar-benar berfungsi di sini adalah
--  membatasi kecepatan tebak SATU akun penyerang; melawan banyak akun sybil
--  paralel ada di luar cakupan lapisan SQL (domain WAF/captcha).
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wallet_invite_attempts (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count integer     NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_invite_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_invite_attempts_select_own" ON public.wallet_invite_attempts;
CREATE POLICY "wallet_invite_attempts_select_own"
  ON public.wallet_invite_attempts FOR SELECT
  USING (auth.uid() = user_id);
-- Tidak ada policy INSERT/UPDATE/DELETE — penulisan HANYA lewat
-- accept_wallet_invite() (SECURITY DEFINER).

-- ════════════════════════════════════════════════════
--  BAGIAN 3 — generate_wallet_invite
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_wallet_invite(
  p_wallet_id         uuid,
  p_role              text    DEFAULT 'editor',
  p_expires_in_hours  integer DEFAULT 24
)
RETURNS TABLE(code text, expires_at timestamptz)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_code       text;
  v_expires_at timestamptz := now() + make_interval(hours => p_expires_in_hours);
  v_attempt    integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'generate_wallet_invite: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('editor','viewer') THEN
    RAISE EXCEPTION 'generate_wallet_invite: role harus editor atau viewer' USING ERRCODE = '22023';
  END IF;

  -- Hanya OWNER dompet ini yang boleh mengundang. wallet_access_role()
  -- melewati RLS by design (SECURITY DEFINER) — lihat catatan di
  -- 20260912000000 soal kenapa helper ini wajib dipakai, bukan EXISTS() inline.
  IF public.wallet_access_role(p_wallet_id) <> 'owner' THEN
    RAISE EXCEPTION 'generate_wallet_invite: dompet tidak ditemukan atau bukan milikmu' USING ERRCODE = '42501';
  END IF;

  -- Keputusan produk #1: FITUR PRO-ONLY. Dicek DI DALAM RPC (bukan cuma
  -- client), karena ini gerbang fitur — kalau dilewati lewat panggilan RPC
  -- langsung, akun ketiga permanen mendapat akses, bukan sekadar kuota
  -- transient seperti limit transaksi/bulan Basic.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions s
    WHERE s.user_id = v_user_id
      AND s.plan = 'pro'
      AND (s.expires_at IS NULL OR s.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'generate_wallet_invite: berbagi dompet khusus pengguna Pro' USING ERRCODE = '42501';
  END IF;

  -- Keputusan produk #2: satu kode aktif per dompet. Revoke yang lama dulu
  -- supaya "generate ulang karena kode hilang" tidak menyisakan dua kode
  -- valid sekaligus (kode lama yang "hilang" itu tetap bisa dipakai orang
  -- yang kebetulan melihatnya kalau tidak di-revoke).
  UPDATE public.wallet_invites
  SET    status = 'revoked'
  WHERE  wallet_id = p_wallet_id
    AND  status    = 'active';

  -- Generate kode unik di antara yang masih 'active' (partial unique index
  -- BAGIAN 1). Retry dibungkus EXCEPTION karena partial unique index tidak
  -- bisa dipakai di ON CONFLICT (predikat WHERE tidak didukung di situ).
  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');

    BEGIN
      INSERT INTO public.wallet_invites (wallet_id, code, role, created_by, expires_at)
      VALUES (p_wallet_id, v_code, p_role, v_user_id, v_expires_at);
      EXIT;   -- berhasil, keluar loop
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 20 THEN
        RAISE EXCEPTION 'generate_wallet_invite: gagal membuat kode unik, coba lagi' USING ERRCODE = '40001';
      END IF;
      -- tabrakan kode aktif lain (kemungkinan sangat kecil, 1 dari ~1 juta) → retry
    END;
  END LOOP;

  RETURN QUERY SELECT v_code, v_expires_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_wallet_invite(uuid, text, integer) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.generate_wallet_invite(uuid, text, integer) TO authenticated;

COMMENT ON FUNCTION public.generate_wallet_invite(uuid, text, integer) IS
  'Membuat kode undangan 6 digit untuk dompet bersama. Hanya owner Pro yang boleh memanggil (dicek di dalam RPC). Otomatis me-revoke kode active lama milik dompet yang sama — satu kode aktif per dompet. Default expire 24 jam.';


-- ════════════════════════════════════════════════════
--  BAGIAN 4 — accept_wallet_invite
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_wallet_invite(
  p_code            text,
  p_max_attempts    integer DEFAULT 10,
  p_window_seconds  integer DEFAULT 900   -- 15 menit
)
RETURNS uuid   -- wallet_id yang berhasil diikuti
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_now              timestamptz := now();
  v_attempt_count    integer;
  v_window_start     timestamptz;
  v_invite           public.wallet_invites%ROWTYPE;
  v_existing_status  text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'accept_wallet_invite: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- ── Rate limit — CEK DULU, sebelum menyentuh wallet_invites sama sekali.
  -- Pola identik check_chat_rate_limit (20260716000000): FOR UPDATE mengunci
  -- baris user ini, menyerialisasi percobaan paralel dari akun yang sama.
  INSERT INTO public.wallet_invite_attempts (user_id, attempt_count, window_start)
  VALUES (v_user_id, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT attempt_count, window_start INTO v_attempt_count, v_window_start
  FROM public.wallet_invite_attempts
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_window_start + make_interval(secs => p_window_seconds) <= v_now THEN
    v_attempt_count := 0;
    v_window_start  := v_now;
  END IF;

  IF v_attempt_count >= p_max_attempts THEN
    RAISE EXCEPTION 'accept_wallet_invite: terlalu banyak percobaan, coba lagi nanti' USING ERRCODE = '42501';
  END IF;

  -- Increment SEKARANG (sebelum tahu kode benar/salah) — percobaan gagal
  -- tetap harus menghabiskan jatah, itu esensi rate limit brute-force.
  UPDATE public.wallet_invite_attempts
  SET    attempt_count = v_attempt_count + 1,
         window_start  = v_window_start
  WHERE  user_id = v_user_id;

  -- ── Cari kode. Pesan error SAMA PERSIS untuk "tidak ada", "sudah dipakai",
  -- dan "expired" — tidak boleh membocorkan mana yang benar ke penebak.
  SELECT * INTO v_invite
  FROM public.wallet_invites
  WHERE code = p_code AND status = 'active' AND expires_at > v_now
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accept_wallet_invite: kode tidak valid atau sudah kedaluwarsa' USING ERRCODE = '42501';
  END IF;

  -- ┌─ CATATAN KEAMANAN: KENAPA TIDAK PAKAI ON CONFLICT DO UPDATE ─────────┐
  -- │ UPSERT buta (INSERT ... ON CONFLICT (wallet_id,user_id) DO UPDATE    │
  -- │ SET role=...) akan MENGUBAH ROLE ANGGOTA YANG SUDAH AKTIF secara     │
  -- │ senyap kalau dia menemukan/memakai kode yang beredar. Karena hanya   │
  -- │ ada SATU kode aktif per dompet, seorang viewer yang sudah jadi       │
  -- │ anggota bisa menaikkan perannya sendiri ke editor hanya dengan       │
  -- │ submit ulang kode yang beredar untuk orang lain — privilege          │
  -- │ escalation. Karena itu status='active' WAJIB ditolak eksplisit di    │
  -- │ bawah, bukan diperbarui diam-diam. Perubahan role anggota aktif      │
  -- │ (kalau dibutuhkan) harus lewat RPC terpisah yang jelas niatnya,      │
  -- │ bukan ditumpangkan ke jalur invite.                                  │
  -- └────────────────────────────────────────────────────────────────────┘
  SELECT status INTO v_existing_status
  FROM public.wallet_members
  WHERE wallet_id = v_invite.wallet_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_existing_status = 'active' THEN
    RAISE EXCEPTION 'accept_wallet_invite: kamu sudah menjadi anggota dompet ini' USING ERRCODE = '23505';
  END IF;

  IF NOT FOUND THEN
    -- Belum pernah jadi anggota sama sekali → INSERT baru.
    INSERT INTO public.wallet_members (wallet_id, user_id, role, status, invited_by, joined_at)
    VALUES (v_invite.wallet_id, v_user_id, v_invite.role, 'active', v_invite.created_by, v_now);
  ELSE
    -- v_existing_status = 'left' → rejoin. Role diambil dari kode yang
    -- BARU dipakai (bisa beda dari role sebelum dia keluar dulu).
    UPDATE public.wallet_members
    SET    role = v_invite.role, status = 'active', joined_at = v_now, invited_by = v_invite.created_by
    WHERE  wallet_id = v_invite.wallet_id AND user_id = v_user_id;
  END IF;

  -- Keputusan produk #3: sekali pakai.
  UPDATE public.wallet_invites
  SET    status = 'accepted', accepted_by = v_user_id, accepted_at = v_now
  WHERE  id = v_invite.id;

  RETURN v_invite.wallet_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_wallet_invite(text, integer, integer) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.accept_wallet_invite(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.accept_wallet_invite(text, integer, integer) IS
  'Menerima kode undangan 6 digit dan bergabung ke dompet bersama. Rate-limited per user (default 10 percobaan/15 menit, tabel wallet_invite_attempts) untuk memperlambat brute force ruang kode 1 juta kombinasi. Kode sekali pakai. MENOLAK bila pemanggil sudah anggota aktif — lihat komentar body soal risiko privilege escalation via UPSERT buta.';


-- ════════════════════════════════════════════════════
--  BAGIAN 5 — leave_wallet & remove_wallet_member
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.leave_wallet(p_wallet_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'leave_wallet: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  UPDATE public.wallet_members
  SET    status = 'left'
  WHERE  wallet_id = p_wallet_id
    AND  user_id   = v_user_id
    AND  status    = 'active';

  IF NOT FOUND THEN
    -- Sama untuk "bukan anggota" maupun "sudah left" — tidak membocorkan status.
    -- Owner yang memanggil ini juga jatuh ke sini: dia tidak punya baris di
    -- wallet_members (keputusan produk #1 di 20260912000000), jadi NOT FOUND.
    RAISE EXCEPTION 'leave_wallet: kamu bukan anggota aktif dompet ini' USING ERRCODE = '42501';
  END IF;
  -- Transaksi yang sudah dicatat member TIDAK disentuh — tetap ada
  -- (keputusan produk #3 di migrasi sebelumnya).
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_wallet(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.leave_wallet(uuid) TO authenticated;

COMMENT ON FUNCTION public.leave_wallet(uuid) IS
  'Anggota aktif keluar dari dompet bersama atas inisiatif sendiri (status → left). Owner tidak bisa memanggil ini untuk dompetnya sendiri (tidak punya baris wallet_members). Transaksi yang sudah dicatat tetap ada.';


CREATE OR REPLACE FUNCTION public.remove_wallet_member(p_wallet_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'remove_wallet_member: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  IF public.wallet_access_role(p_wallet_id) <> 'owner' THEN
    RAISE EXCEPTION 'remove_wallet_member: hanya owner yang boleh mengeluarkan anggota' USING ERRCODE = '42501';
  END IF;

  UPDATE public.wallet_members
  SET    status = 'left'
  WHERE  wallet_id = p_wallet_id
    AND  user_id   = p_user_id
    AND  status    = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'remove_wallet_member: anggota tidak ditemukan atau sudah tidak aktif' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_wallet_member(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.remove_wallet_member(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.remove_wallet_member(uuid, uuid) IS
  'Owner mengeluarkan anggota tertentu dari dompet bersama (status → left). Transaksi yang sudah dicatat anggota itu TIDAK ikut terhapus.';
