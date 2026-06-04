-- ════════════════════════════════════════════════════
--  FinanceApp — Supabase Schema
--  Jalankan seluruh file ini di Supabase SQL Editor
-- ════════════════════════════════════════════════════

-- ── transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('expense', 'income')),
  amount      numeric     NOT NULL,
  category    text        NOT NULL DEFAULT 'food',
  merchant    text        NOT NULL DEFAULT '',
  note        text                  DEFAULT '',
  date        date        NOT NULL  DEFAULT CURRENT_DATE,
  time        text                  DEFAULT '00:00',
  method      text                  DEFAULT 'Tunai',
  created_at  timestamptz NOT NULL  DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: own data only" ON public.transactions;
CREATE POLICY "transactions: own data only"
  ON public.transactions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── savings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.savings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  target      numeric     NOT NULL DEFAULT 0,
  current     numeric     NOT NULL DEFAULT 0,
  deadline    date,
  color       text        DEFAULT '#7A8A6E',
  icon        text        DEFAULT 'savings',
  created_at  timestamptz NOT NULL  DEFAULT now()
);

ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings: own data only" ON public.savings;
CREATE POLICY "savings: own data only"
  ON public.savings FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── budgets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  label       text        NOT NULL,
  "limit"     numeric     NOT NULL DEFAULT 0,
  spent       numeric     NOT NULL DEFAULT 0,
  color       text                  DEFAULT 'var(--sage)',
  enabled     boolean     NOT NULL  DEFAULT true,
  created_at  timestamptz NOT NULL  DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budgets: own data only" ON public.budgets;
CREATE POLICY "budgets: own data only"
  ON public.budgets FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── wallets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  bank        text,
  balance     numeric     NOT NULL DEFAULT 0,
  type        text        NOT NULL DEFAULT 'bank'
                CHECK (type IN ('bank', 'ewallet', 'cash', 'investment')),
  is_primary  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets: own data only" ON public.wallets;
CREATE POLICY "wallets: own data only"
  ON public.wallets FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
