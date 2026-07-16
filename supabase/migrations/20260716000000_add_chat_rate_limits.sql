-- ════════════════════════════════════════════════════
--  FinanceApp — Rate limiter per-user untuk chatbot (financial-chat)
--  Jalankan di Supabase Dashboard → SQL Editor (atau `supabase db push`).
--
--  TUJUAN:
--    Batasi jumlah request chatbot per user (default 8 request / 60 detik)
--    supaya satu user tidak bisa menguras kuota Groq (L2 klasifikasi + L3
--    answering). Pengecekan dilakukan di AWAL edge function, SEBELUM Level 1
--    keyword filter — jadi request yang kena limit TIDAK memanggil Groq sama
--    sekali.
--
--  KENAPA RPC SECURITY DEFINER (bukan insert/update langsung dari client):
--    Counter WAJIB otoritatif di server. Kalau client bisa menulis langsung,
--    user bisa memalsukan/reset counter dirinya sendiri. Pola sama seperti
--    log_error() (lihat 20260706000000_add_error_logs.sql): user_id diambil
--    dari auth.uid() (JWT terverifikasi), BUKAN dari argumen yang bisa dipalsu.
--
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS / OR REPLACE /
--  DROP POLICY IF EXISTS di semua bagian).
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Tabel chat_rate_limits
--    Satu baris per user (PRIMARY KEY user_id). window_start menandai awal
--    jendela hitung berjalan; request_count jumlah request di jendela itu.
--    ON DELETE CASCADE: kalau akun user dihapus, baris limitnya ikut hilang
--    (tidak ada nilai historis yang perlu dipertahankan, beda dgn error_logs).
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count integer     NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────
-- 2. Row Level Security
--    - SELECT own: user boleh lihat barisnya sendiri (diagnostik), tapi TIDAK
--      ada policy INSERT/UPDATE/DELETE → user tak bisa mengubah counter dari
--      client. Penulisan HANYA lewat RPC check_chat_rate_limit() (SECURITY
--      DEFINER) atau service_role.
-- ────────────────────────────────────────────────────
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_rate_limits_select_own" ON public.chat_rate_limits;
CREATE POLICY "chat_rate_limits_select_own"
  ON public.chat_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────
-- 3. RPC check_chat_rate_limit() — cek + increment ATOMIK.
--    SECURITY DEFINER = berjalan dgn hak pemilik fungsi (bisa upsert/update
--    meski tak ada policy write untuk user). user_id diambil dari auth.uid()
--    (NULL bila belum login) — argumen p_* hanya mengatur ambang, BUKAN
--    identitas, jadi user tak bisa memalsukan counter user lain.
--
--    Return jsonb: { allowed: bool, remaining: int, reset_at: timestamptz }.
--    - allowed=false → sudah lebih dari p_max_requests di jendela ini.
--    - Counter hanya di-increment saat request DIIZINKAN (saat ditolak, tidak
--      naik — mencegah counter membengkak tak berguna; window tetap reset
--      otomatis begitu p_window_seconds terlewati).
--
--    Konkurensi: SELECT ... FOR UPDATE mengunci baris user ini sehingga
--    request paralel dari user yang sama diserialisasi (tak ada race pada
--    increment). Antar user berbeda → baris berbeda → tidak saling blok.
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit(
  p_max_requests  integer DEFAULT 8,
  p_window_seconds integer DEFAULT 60
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid        := auth.uid();
  v_now     timestamptz := now();
  v_count   integer;
  v_start   timestamptz;
  v_allowed boolean;
BEGIN
  -- Tak ada user (harusnya tak terjadi krn edge sudah auth via JWT) → tolak
  -- aman (fail-closed di level DB): jangan biarkan request anonim lolos.
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'reset_at', v_now);
  END IF;

  -- Pastikan baris user ada, lalu kunci utk update atomik.
  INSERT INTO public.chat_rate_limits (user_id, request_count, window_start)
  VALUES (v_user_id, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT request_count, window_start
    INTO v_count, v_start
  FROM public.chat_rate_limits
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Jendela sudah lewat? reset hitungan & mulai jendela baru.
  IF v_start + make_interval(secs => p_window_seconds) <= v_now THEN
    v_count := 0;
    v_start := v_now;
  END IF;

  IF v_count >= p_max_requests THEN
    v_allowed := false;               -- sudah mentok: JANGAN increment lagi.
  ELSE
    v_allowed := true;
    v_count   := v_count + 1;         -- request ini diizinkan → hitung.
  END IF;

  UPDATE public.chat_rate_limits
  SET request_count = v_count,
      window_start  = v_start
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'allowed',   v_allowed,
    'remaining', GREATEST(p_max_requests - v_count, 0),
    'reset_at',  v_start + make_interval(secs => p_window_seconds)
  );
END;
$$;

-- Hanya user login (role authenticated) yang boleh memanggil.
GRANT EXECUTE ON FUNCTION public.check_chat_rate_limit(integer, integer) TO authenticated;
