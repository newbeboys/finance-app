-- ════════════════════════════════════════════════════
--  FinanceApp — Tutup dua jalur yang merusak invariant Task 2
--  "owner TIDAK punya baris di wallet_members".
--
--  Invariant itu diasumsikan oleh RPC lain: leave_wallet (owner selalu jatuh
--  ke NOT FOUND), wallet_access_role (kepemilikan HANYA dari wallets.user_id),
--  dan klien (fetchSharedWalletIds menganggap setiap baris = dompet ORANG LAIN).
--
--  1) accept_wallet_invite tidak menolak OWNER yang memasukkan kode dompetnya
--     sendiri → owner ter-INSERT sebagai editor, kodenya ikut terbakar.
--     Diperbaiki: RETURN {ok:false, reason:'own_wallet'} — RETURN, bukan
--     RAISE, karena counter percobaan sudah di-increment di atasnya (aturan
--     migrasi 20260914000000: jangan RAISE setelah menulis).
--
--  2) Policy "wallet_members: owner manages" (FOR ALL, dari 20260912000000)
--     membuat owner bisa INSERT/UPDATE/DELETE wallet_members LANGSUNG lewat
--     PostgREST, melewati semua RPC Task 3:
--       - gate Pro di generate_wallet_invite bisa dilewati: user Basic cukup
--         INSERT baris anggota sendiri → berbagi dompet tanpa bayar;
--       - owner bisa memasukkan user MANA PUN sebagai anggota aktif tanpa
--         persetujuan orangnya (tidak pernah menerima kode apa pun);
--       - owner bisa memasukkan dirinya sendiri (jalur yang sama dengan #1);
--       - role 'owner' (nilai cadangan) bisa ditulis — dan wallet_access_role
--         mengembalikan m.role apa adanya, jadi anggota itu mendapat hak
--         setara owner di wallet_members/wallet_invites/generate/remove.
--     Tidak ada kode klien yang menulis wallet_members (hanya SELECT), dan
--     keempat RPC Task 3 SECURITY DEFINER (melewati RLS). Jadi policy ini
--     dihapus tanpa pengganti: tulis murni lewat RPC, pola yang sama dengan
--     wallet_invites. SELECT tetap dilayani policy
--     "wallet_members: read own or owned wallet".
-- ════════════════════════════════════════════════════

-- ── Pengaman: migrasi ini mengasumsikan belum ada data yang melanggar
-- invariant (dicek di server 11 Sep 2026: 0 baris). Kalau ternyata ada,
-- GAGAL keras daripada diam-diam menghapus data keanggotaan.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.wallet_members m
    JOIN public.wallets w ON w.id = m.wallet_id
    WHERE w.user_id = m.user_id OR m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'wallet_members berisi baris owner/role=owner — bersihkan manual dulu sebelum migrasi ini';
  END IF;
END $$;

-- ════════════════════════════════════════════════════
--  BAGIAN 1 — wallet_members: tulis hanya lewat RPC
-- ════════════════════════════════════════════════════
DROP POLICY IF EXISTS "wallet_members: owner manages" ON public.wallet_members;

-- ════════════════════════════════════════════════════
--  BAGIAN 2 — accept_wallet_invite menolak owner dompetnya sendiri
-- ════════════════════════════════════════════════════
-- Tipe kembalian tetap jsonb (sama dengan 20260914000000), jadi CREATE OR
-- REPLACE cukup — tidak perlu DROP, dan GRANT yang ada tetap berlaku.
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
  -- 20260914000000. Termasuk 'already_member' dan 'own_wallet': sengaja TETAP
  -- dihitung, supaya jalur rate-limit hanya punya satu bentuk tanpa cabang
  -- "refund" yang rawan salah-urut di kemudian hari.
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

  -- ── Owner memasukkan kode dompetnya sendiri → tolak. Dicek SEBELUM
  -- menyentuh wallet_members supaya invariant "owner tidak punya baris di
  -- wallet_members" (keputusan Task 2 #1) tidak pernah dilanggar, dan kode
  -- TIDAK ikut terbakar (status tetap 'active', masih bisa dipakai orang
  -- yang dituju). Tidak membocorkan apa pun ke penebak: satu-satunya yang
  -- bisa sampai ke cabang ini adalah owner dompet itu sendiri.
  IF EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = v_invite.wallet_id AND w.user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'own_wallet');
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
  'Menerima kode undangan 6 digit dan bergabung ke dompet bersama. MENGEMBALIKAN jsonb {ok, wallet_id?, role?, reason?}, TIDAK melempar exception untuk kegagalan yang diantisipasi (invalid_code / own_wallet / already_member / rate_limited) — pemanggil WAJIB memeriksa field ok. RAISE hanya untuk "tidak ada sesi login". Bentuk ini WAJIB: versi sebelumnya memakai RAISE setelah menaikkan counter rate limit, dan rollback transaksi menghapus increment itu sehingga lockout tidak pernah menyala. own_wallet: owner memasukkan kode dompetnya sendiri — ditolak supaya owner tidak pernah punya baris di wallet_members; kode tetap active. Rate limit default 10 percobaan/15 menit per user.';
