-- ════════════════════════════════════════════════════
--  FinanceApp — Sistem error logging terpusat (tabel error_logs)
--  Jalankan di Supabase Dashboard → SQL Editor.
--
--  TUJUAN:
--    Mencatat HANYA error penting yang melibatkan uang / data permanen
--    (mis. gagal update saldo dompet, gagal proses webhook langganan,
--    gagal eksekusi transaksi berulang, gagal orkestrasi hutang/piutang).
--    BUKAN untuk error UI biasa (buka/tutup modal, ganti tema, dsb).
--
--  SIAPA YANG MENULIS:
--    - Client (browser/app)  → lewat RPC public.log_error() SECURITY DEFINER
--                              (pola sama seperti update_category_edit_cooldown).
--    - Edge Function server  → pakai service_role (bypass RLS), insert langsung.
--
--  SIAPA YANG MEMBACA:
--    - User: hanya baris miliknya sendiri (RLS SELECT: user_id = auth.uid()).
--    - Kamu (Boss Ali): lewat SQL Editor (service_role, lihat semua baris).
--
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS / OR REPLACE /
--  DROP POLICY IF EXISTS di semua bagian).
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Tabel error_logs
--    user_id NULLABLE: error bisa terjadi sebelum user login (mis. saat
--    proses register, sesi belum aktif → auth.uid() = NULL). ON DELETE SET NULL
--    supaya log historis tetap ada meski akun user dihapus.
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.error_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,  -- nullable
  source     text        NOT NULL,                        -- nama fungsi/modul asal error
  message    text        NOT NULL,                        -- pesan error asli dari catch block
  metadata   jsonb                 DEFAULT NULL,          -- data tambahan (wallet_id, payload, dll)
  severity   text        NOT NULL  DEFAULT 'medium' CHECK (severity IN ('high', 'medium')),
  created_at timestamptz NOT NULL  DEFAULT now()
);

-- ────────────────────────────────────────────────────
-- 2. Indexes — mempercepat query yang paling sering kamu pakai di SQL Editor
-- ────────────────────────────────────────────────────
-- "Error terbaru milik user X" (RLS SELECT + urut waktu)
CREATE INDEX IF NOT EXISTS idx_error_logs_user_created
  ON public.error_logs (user_id, created_at DESC);

-- "Semua error severity 'high' dalam 24 jam terakhir"
CREATE INDEX IF NOT EXISTS idx_error_logs_severity_created
  ON public.error_logs (severity, created_at DESC);

-- ────────────────────────────────────────────────────
-- 3. Row Level Security
--    - SELECT: user hanya bisa membaca baris miliknya sendiri.
--    - TIDAK ADA policy INSERT/UPDATE/DELETE untuk authenticated/anon →
--      artinya user TIDAK bisa menulis langsung ke tabel dari client.
--      Penulisan hanya lewat:
--        (a) service_role  → bypass RLS (Edge Function webhook), atau
--        (b) RPC log_error → SECURITY DEFINER (client browser/app).
-- ────────────────────────────────────────────────────
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "error_logs_select_own" ON public.error_logs;
CREATE POLICY "error_logs_select_own"
  ON public.error_logs FOR SELECT
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────
-- 4. RPC log_error() — satu-satunya jalan client menulis ke error_logs.
--    SECURITY DEFINER = berjalan dengan hak pemilik fungsi, jadi bisa INSERT
--    meski tidak ada policy INSERT untuk user. user_id diisi otomatis dari
--    auth.uid() (NULL bila belum login) — client TIDAK bisa memalsukan user_id
--    milik orang lain. Mengembalikan id baris yang dibuat.
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_error(
  p_source   text,
  p_message  text,
  p_metadata jsonb DEFAULT NULL,
  p_severity text  DEFAULT 'medium'
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.error_logs (user_id, source, message, metadata, severity)
  VALUES (
    auth.uid(),                                              -- NULL bila belum login
    COALESCE(NULLIF(p_source, ''), 'unknown'),
    COALESCE(p_message, ''),
    p_metadata,
    CASE WHEN p_severity = 'high' THEN 'high' ELSE 'medium' END  -- normalisasi: hanya high/medium
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Izinkan authenticated (user login) DAN anon (error sebelum login, mis. register)
-- memanggil function ini — bukan INSERT tabel langsung.
GRANT EXECUTE ON FUNCTION public.log_error(text, text, jsonb, text) TO authenticated, anon;

-- ════════════════════════════════════════════════════
-- CONTOH QUERY (jalankan di SQL Editor):
--
--   -- Error severity 'high' dalam 24 jam terakhir:
--   SELECT created_at, source, message, metadata, user_id
--   FROM public.error_logs
--   WHERE severity = 'high'
--     AND created_at >= now() - interval '24 hours'
--   ORDER BY created_at DESC;
-- ════════════════════════════════════════════════════
