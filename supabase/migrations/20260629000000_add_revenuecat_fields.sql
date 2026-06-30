-- ════════════════════════════════════════════════════
--  FinanceApp — Tambah kolom RevenueCat ke tabel
--  user_subscriptions yang sudah ada.
--  Jalankan di Supabase Dashboard → SQL Editor, atau via
--  `supabase db push`.
-- ════════════════════════════════════════════════════

-- Tambah kolom RevenueCat tanpa menghapus kolom lama.
-- Kolom lama (plan, billing_cycle, started_at, expires_at, updated_at)
-- tetap digunakan oleh useSubscription.js.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS product_id             TEXT,
  ADD COLUMN IF NOT EXISTS original_purchase_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_event_type      TEXT,
  ADD COLUMN IF NOT EXISTS latest_event_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_event              JSONB;

-- Index untuk lookup cepat via revenuecat_app_user_id
-- (dipakai webhook untuk menemukan user berdasarkan RC app_user_id)
CREATE INDEX IF NOT EXISTS idx_user_sub_rc_app_user_id
  ON public.user_subscriptions (revenuecat_app_user_id);

-- Trigger updated_at (kalau belum ada)
CREATE OR REPLACE FUNCTION public.update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trigger_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_subscriptions_updated_at();
