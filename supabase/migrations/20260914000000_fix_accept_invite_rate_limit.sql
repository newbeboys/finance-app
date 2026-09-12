-- ════════════════════════════════════════════════════
--  FinanceApp — PERBAIKAN BUG: rate limiter accept_wallet_invite tidak pernah
--  menyala karena increment-nya ikut ter-rollback.
--
--  BUG YANG DIPERBAIKI (terverifikasi di produksi 11 Sep 2026):
--    accept_wallet_invite versi 20260913000000 menaikkan attempt_count lalu,
--    beberapa baris kemudian, memanggil RAISE EXCEPTION saat kode salah.
--    PostgREST membungkus tiap panggilan RPC dalam SATU transaksi, jadi
--    RAISE membatalkan seluruh transaksi — TERMASUK UPDATE counter yang baru
--    saja dilakukan. Akibatnya setiap tebakan salah menghapus hitungannya
--    sendiri, dan counter hanya naik pada percobaan yang BERHASIL — justru
--    yang tidak perlu dibatasi.
--
--    Dibuktikan: 12 percobaan kode salah berturut-turut → attempt_count tetap
--    1. Lockout tidak pernah menyala. Saat attempt_count di-set manual ke 10,
--    pesan lockout muncul normal — jadi logika ambangnya benar sejak awal,
--    yang rusak murni persistensinya.
--
--  KENAPA check_chat_rate_limit (20260716000000) TIDAK kena bug ini:
--    dia RETURN jsonb {allowed:false, …} dan TIDAK PERNAH RAISE di jalur
--    penolakan, sehingga transaksinya commit dan increment-nya bertahan.
--    Migrasi ini menyelaraskan accept_wallet_invite ke pola yang sama.
--
--  ┌─ ATURAN YANG WAJIB DIPEGANG SETERUSNYA ────────────────────────────────┐
--  │ Di fungsi mana pun yang menulis penghitung/jejak audit lalu menolak    │
--  │ request: JANGAN RAISE setelah menulis. RAISE = rollback = tulisan itu  │
--  │ hilang. Pakai RETURN dengan nilai status. RAISE hanya boleh untuk      │
--  │ kondisi yang memang tidak menyisakan apa pun untuk disimpan (mis.      │
--  │ tidak ada sesi login) — atau ketika rollback memang yang diinginkan.   │
--  └────────────────────────────────────────────────────────────────────────┘
--
--  PERUBAHAN KONTRAK — PENTING UNTUK KLIEN (Task 4):
--    RETURNS uuid  →  RETURNS jsonb. Fungsi ini TIDAK LAGI melempar exception
--    untuk kegagalan yang diantisipasi; dia mengembalikan objek status.
--    Pemanggil WAJIB memeriksa field `ok`, bukan mengandalkan error HTTP.
--      { "ok": true,  "wallet_id": "...", "role": "editor" }
--      { "ok": false, "reason": "invalid_code" }
--      { "ok": false, "reason": "already_member" }
--      { "ok": false, "reason": "rate_limited", "reset_at": "..." }
--    Satu-satunya yang masih RAISE: tidak ada sesi login.
--
--    Aman diubah sekarang: belum ada kode klien yang memanggil fungsi ini
--    (UI Task 4 belum dibuat). Menunda perubahan ini sampai setelah Task 4
--    berarti harus mengubah RPC DAN pemanggilnya.
-- ════════════════════════════════════════════════════

-- Tipe kembalian berubah (uuid → jsonb), jadi CREATE OR REPLACE akan ditolak
-- Postgres dengan "cannot change return type of existing function". Harus DROP.
DROP FUNCTION IF EXISTS public.accept_wallet_invite(text, integer, integer);

CREATE OR REPLACE FUNCTION public.accept_wallet_invite(
  p_code            text,
  p_max_attempts    integer DEFAULT 10,
  p_window_seconds  integer DEFAULT 900   -- 15 menit
)
RETURNS jsonb
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
  v_has_member_row   boolean;
BEGIN
  -- SATU-SATUNYA RAISE yang tersisa. Tidak apa-apa: belum ada apa pun yang
  -- ditulis pada titik ini, jadi tidak ada yang hilang karena rollback.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'accept_wallet_invite: tidak ada sesi login' USING ERRCODE = '42501';
  END IF;

  -- ── Rate limit — dicek DULU, sebelum menyentuh wallet_invites sama sekali.
  -- FOR UPDATE mengunci baris user ini sehingga percobaan paralel dari akun
  -- yang sama diserialisasi (pola check_chat_rate_limit).
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
    -- RETURN, bukan RAISE. Sudah mentok → sengaja TIDAK di-increment lagi
    -- supaya counter tidak membengkak tanpa guna; window tetap reset sendiri
    -- begitu p_window_seconds terlewati (pola sama check_chat_rate_limit).
    RETURN jsonb_build_object(
      'ok',       false,
      'reason',   'rate_limited',
      'reset_at', v_window_start + make_interval(secs => p_window_seconds)
    );
  END IF;

  -- Increment SEKARANG, sebelum tahu kode benar atau salah. Tidak ada cabang
  -- mana pun di bawah yang boleh membatalkan ini — itu inti perbaikan migrasi
  -- ini. Termasuk 'already_member': sengaja TETAP dihitung, supaya jalur
  -- rate-limit hanya punya satu bentuk tanpa cabang "refund" yang rawan
  -- salah-urut di kemudian hari.
  UPDATE public.wallet_invite_attempts
  SET    attempt_count = v_attempt_count + 1,
         window_start  = v_window_start
  WHERE  user_id = v_user_id;

  -- ── Cari kode. Satu `reason` yang sama ('invalid_code') untuk "tidak ada",
  -- "sudah dipakai", dan "kedaluwarsa" — tidak boleh membocorkan mana yang
  -- benar ke penebak.
  SELECT * INTO v_invite
  FROM public.wallet_invites
  WHERE code = p_code AND status = 'active' AND expires_at > v_now
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- ┌─ CATATAN KEAMANAN: KENAPA TIDAK PAKAI ON CONFLICT DO UPDATE ─────────┐
  -- │ UPSERT buta (INSERT ... ON CONFLICT (wallet_id,user_id) DO UPDATE    │
  -- │ SET role=...) akan MENGUBAH ROLE ANGGOTA YANG SUDAH AKTIF secara     │
  -- │ senyap. Karena hanya ada SATU kode aktif per dompet, seorang viewer   │
  -- │ yang sudah jadi anggota bisa menaikkan perannya sendiri ke editor     │
  -- │ hanya dengan submit kode yang beredar untuk orang lain — privilege    │
  -- │ escalation. Karena itu status='active' ditolak eksplisit di bawah.    │
  -- └────────────────────────────────────────────────────────────────────┘
  SELECT status INTO v_existing_status
  FROM public.wallet_members
  WHERE wallet_id = v_invite.wallet_id AND user_id = v_user_id
  FOR UPDATE;

  -- FOUND disimpan ke variabel sendiri: nilainya berubah setiap kali ada
  -- SELECT/UPDATE/INSERT berikutnya, jadi jangan diandalkan beberapa baris
  -- di bawah setelah percabangan.
  v_has_member_row := FOUND;

  IF v_has_member_row AND v_existing_status = 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member');
  END IF;

  IF v_has_member_row THEN
    -- v_existing_status = 'left' → rejoin. Role diambil dari kode yang BARU
    -- dipakai (boleh beda dari role sebelum dia keluar dulu).
    UPDATE public.wallet_members
    SET    role = v_invite.role, status = 'active',
           joined_at = v_now, invited_by = v_invite.created_by
    WHERE  wallet_id = v_invite.wallet_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.wallet_members (wallet_id, user_id, role, status, invited_by, joined_at)
    VALUES (v_invite.wallet_id, v_user_id, v_invite.role, 'active', v_invite.created_by, v_now);
  END IF;

  -- Kode sekali pakai.
  UPDATE public.wallet_invites
  SET    status = 'accepted', accepted_by = v_user_id, accepted_at = v_now
  WHERE  id = v_invite.id;

  RETURN jsonb_build_object(
    'ok',        true,
    'wallet_id', v_invite.wallet_id,
    'role',      v_invite.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_wallet_invite(text, integer, integer) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.accept_wallet_invite(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.accept_wallet_invite(text, integer, integer) IS
  'Menerima kode undangan 6 digit dan bergabung ke dompet bersama. MENGEMBALIKAN jsonb {ok, wallet_id?, role?, reason?}, TIDAK melempar exception untuk kegagalan yang diantisipasi (invalid_code / already_member / rate_limited) — pemanggil WAJIB memeriksa field ok. RAISE hanya untuk "tidak ada sesi login". Bentuk ini WAJIB: versi sebelumnya memakai RAISE setelah menaikkan counter rate limit, dan rollback transaksi menghapus increment itu sehingga lockout tidak pernah menyala. Rate limit default 10 percobaan/15 menit per user.';
