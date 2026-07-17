-- ════════════════════════════════════════════════════
--  FinanceApp — Log pertanyaan chatbot yang GAGAL dijawab
--  (tabel chat_unanswered_log). Jalankan di Supabase Dashboard → SQL Editor
--  (atau `supabase db push`).
--
--  TUJUAN:
--    Mengumpulkan POLA kata/kalimat pertanyaan yang GAGAL dilayani chatbot,
--    sebagai referensi untuk memperbaiki keyword filter Level 1. INI BUKAN
--    error logging teknis/uang (itu tabel error_logs) — murni analitik pola
--    pertanyaan.
--
--  ⚠️ PRIVASI (KEPUTUSAN FINAL, BUKAN OPSIONAL):
--    Tabel ini SENGAJA TIDAK menyimpan user_id atau apa pun yang bisa
--    mengidentifikasi SIAPA yang bertanya. Yang dikumpulkan hanya TEKS
--    pertanyaan + alasan gagal + waktu. Jangan pernah menambah kolom user_id,
--    email, ip, atau identitas lain ke tabel ini.
--
--  SIAPA YANG MENULIS:
--    HANYA Edge Function financial-chat via service_role (bypass RLS), insert
--    langsung — BUKAN via RPC. Alasan: kita justru TIDAK mau auth.uid() ikut
--    tercatat, jadi tidak perlu (dan tidak boleh) memakai RPC SECURITY DEFINER
--    yang berbasis auth.uid() seperti log_error()/check_chat_rate_limit().
--
--  SIAPA YANG MEMBACA:
--    Hanya kamu (Boss Ali) lewat SQL Editor (service_role). Tidak ada user
--    biasa yang boleh membaca (tidak ada policy SELECT sama sekali).
--
--  Migration ini AMAN dijalankan berkali-kali (IF NOT EXISTS / DROP POLICY
--  IF EXISTS di semua bagian).
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Tabel chat_unanswered_log
--    TANPA user_id — lihat catatan privasi di atas. reason dibatasi CHECK ke
--    4 nilai yang mewakili di titik mana pertanyaan gagal:
--      level1_blocked  → diblok keyword filter Level 1
--      level2_blocked  → diklasifikasi OUT_OF_SCOPE di Level 2
--      level3_declined → lolos L1+L2 tapi DITOLAK model di L3 (out-of-scope
--                        via system prompt, mis. "kenapa market bitcoin turun")
--      data_kurang     → model jawab "Data kurang..." (finansial tapi data tak cukup)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_unanswered_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,                          -- teks pertanyaan asli user
  reason     text        NOT NULL CHECK (reason IN ('level1_blocked', 'level2_blocked', 'level3_declined', 'data_kurang')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1b. Sinkronkan CHECK constraint ke 4 nilai secara IDEMPOTEN.
--     Penting bila tabel SUDAH pernah dibuat dgn versi 3-nilai (CREATE TABLE
--     IF NOT EXISTS di atas akan dilewati sehingga constraint lama tidak ikut
--     ter-update). DROP + ADD ulang memastikan constraint selalu 4-nilai,
--     baik untuk tabel baru maupun yang sudah ada. Constraint inline di atas
--     otomatis dinamai "chat_unanswered_log_reason_check" oleh Postgres.
ALTER TABLE public.chat_unanswered_log
  DROP CONSTRAINT IF EXISTS chat_unanswered_log_reason_check;
ALTER TABLE public.chat_unanswered_log
  ADD CONSTRAINT chat_unanswered_log_reason_check
  CHECK (reason IN ('level1_blocked', 'level2_blocked', 'level3_declined', 'data_kurang'));

-- ────────────────────────────────────────────────────
-- 2. Index — query analitik paling umum: "pertanyaan gagal per-alasan,
--    terbaru dulu" dan filter rentang waktu (untuk retensi & review berkala).
-- ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_unanswered_reason_created
  ON public.chat_unanswered_log (reason, created_at DESC);

-- ────────────────────────────────────────────────────
-- 3. Row Level Security
--    RLS diaktifkan TAPI SENGAJA TANPA policy apa pun (tidak ada SELECT,
--    INSERT, UPDATE, maupun DELETE untuk authenticated/anon). Efeknya: dari
--    client (browser/app), tabel ini TIDAK bisa dibaca maupun ditulis sama
--    sekali. Satu-satunya jalur tulis adalah service_role dari Edge Function
--    yang bypass RLS. Ini disengaja — beda dgn error_logs yang punya policy
--    SELECT own (di sini tidak ada user_id, jadi tidak ada konsep "own").
-- ────────────────────────────────────────────────────
ALTER TABLE public.chat_unanswered_log ENABLE ROW LEVEL SECURITY;

-- (Tidak ada CREATE POLICY di sini — itu memang disengaja. Baris di bawah
--  hanya membersihkan policy lama bila migration pernah salah dijalankan.)
DROP POLICY IF EXISTS "chat_unanswered_select_own"   ON public.chat_unanswered_log;
DROP POLICY IF EXISTS "chat_unanswered_insert_own"   ON public.chat_unanswered_log;

-- ════════════════════════════════════════════════════
-- 4. RETENSI — MANUAL, BUKAN cron otomatis.
--    Jalankan query di bawah SECARA MANUAL & BERKALA (mis. sebulan sekali)
--    untuk menghapus baris yang lebih tua dari 30 hari. JANGAN dijadikan
--    scheduled job / pg_cron dulu — keputusan kapan menjalankan ada di tangan
--    Boss Ali.
--
--      DELETE FROM public.chat_unanswered_log
--      WHERE created_at < now() - interval '30 days';
--
-- ════════════════════════════════════════════════════
-- CONTOH QUERY REVIEW (jalankan di SQL Editor):
--
--   -- Pertanyaan yang lolos L1 tapi diblok L2 (kandidat utama untuk
--   -- ditambahkan ke keyword filter Level 1):
--   SELECT created_at, question
--   FROM public.chat_unanswered_log
--   WHERE reason = 'level2_blocked'
--   ORDER BY created_at DESC;
--
--   -- Frekuensi kegagalan per alasan (7 hari terakhir):
--   SELECT reason, count(*)
--   FROM public.chat_unanswered_log
--   WHERE created_at >= now() - interval '7 days'
--   GROUP BY reason
--   ORDER BY count(*) DESC;
-- ════════════════════════════════════════════════════
