-- ════════════════════════════════════════════════════
--  FinanceApp — Perbaikan celah keamanan RLS pada tabel user_subscriptions
--
--  MASALAH:
--    Policy "Users can update own subscription" (UPDATE) terlalu luas — user
--    bisa update kolom apapun di baris mereka sendiri, termasuk `plan`,
--    `revenuecat_app_user_id`, `product_id`, dll. dari browser console.
--    Contoh serangan: supabase.from('user_subscriptions').update({ plan: 'pro' })...
--
--  SOLUSI:
--    1. Hapus policy UPDATE generik.
--    2. Ganti dengan RPC function SECURITY DEFINER yang HANYA mengizinkan
--       update kolom `last_custom_category_edit_at` (untuk cooldown edit kategori).
--    3. Policy SELECT tetap utuh — dibutuhkan untuk membaca status plan dan cooldown.
--
--  KOLOM SENSITIF YANG KINI TERLINDUNGI DARI UPDATE LANGSUNG OLEH USER:
--    plan, revenuecat_app_user_id, product_id, latest_event_type,
--    latest_event_at, raw_event, expires_at, billing_cycle, dll.
--    Kolom-kolom ini hanya bisa diupdate oleh:
--      - Edge Function revenuecat-webhook (pakai service_role, bypass RLS)
--      - Database trigger (server-side)
--
--  FITUR YANG TETAP BERJALAN:
--    - src/components/EditCategoryModal.jsx — cooldown 30 hari edit kategori
--      (kini via RPC, bukan UPDATE langsung)
--    - useSubscription.js — SELECT tetap diizinkan oleh policy yang tidak disentuh
--
--  JANGAN jalankan migration ini sebelum frontend sudah diupdate untuk
--  menggunakan supabase.rpc('update_category_edit_cooldown', ...) —
--  lihat perubahan di src/components/EditCategoryModal.jsx.
-- ════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Hapus policy UPDATE generik yang menjadi celah keamanan
-- ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- ────────────────────────────────────────────────────
-- 2. RPC function pengganti: hanya izinkan update last_custom_category_edit_at
--    SECURITY DEFINER = berjalan dengan hak pemilik fungsi (bukan hak user),
--    sehingga bisa update tabel meski tidak ada policy UPDATE untuk user.
-- ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_category_edit_cooldown(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Pastikan hanya user yang login bisa update barisnya sendiri
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Tidak diizinkan: user_id tidak cocok dengan sesi login';
  END IF;

  UPDATE public.user_subscriptions
  SET last_custom_category_edit_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Izinkan authenticated users memanggil function ini (bukan UPDATE tabel langsung)
GRANT EXECUTE ON FUNCTION public.update_category_edit_cooldown(uuid) TO authenticated;

-- ────────────────────────────────────────────────────
-- CATATAN: Policy SELECT "Users can view own subscription" TIDAK disentuh.
-- Policy tersebut tetap diperlukan untuk:
--   - useSubscription.js membaca kolom `plan` (menentukan tier Basic/Pro)
--   - EditCategoryModal.jsx membaca `last_custom_category_edit_at` (cek cooldown)
-- ────────────────────────────────────────────────────
