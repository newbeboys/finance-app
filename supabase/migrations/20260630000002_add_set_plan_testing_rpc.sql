-- ============================================================
-- DEVELOPER TESTING ONLY — bukan bagian dari production flow.
-- RPC ini menggantikan UPDATE langsung ke user_subscriptions yang
-- tidak bisa dilakukan lagi setelah policy UPDATE generik dihapus
-- pada migration 20260630000001_secure_user_subscriptions_rls.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_plan_for_testing(
  p_user_id uuid,
  p_plan text,
  p_billing_cycle text DEFAULT NULL,
  p_started_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
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

  -- Validasi nilai plan yang diizinkan
  IF p_plan NOT IN ('basic', 'pro') THEN
    RAISE EXCEPTION 'Nilai plan tidak valid: %', p_plan;
  END IF;

  UPDATE public.user_subscriptions
  SET
    plan = p_plan,
    billing_cycle = p_billing_cycle,
    started_at = p_started_at,
    expires_at = p_expires_at,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_plan_for_testing(uuid, text, text, timestamptz, timestamptz) TO authenticated;
