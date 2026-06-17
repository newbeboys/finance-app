---
name: subscription-plans
description: Basic vs Pro account tiers — Phase 1 (no real payment); Phase 2 will add Google Play Billing.
metadata:
  type: project
---

FinanceApp has two account tiers, **Basic** (free, limited) and **Pro** (unlimited). Implemented in two phases:

- **Phase 1 (done):** plan status in Supabase table `public.user_subscriptions` + feature gating only. No real payment. Plan is switched MANUALLY for testing via dev-only buttons in Settings → "Akun & Paket" (wrapped in `import.meta.env.DEV`, auto-stripped from the APK). All limits live in one config: [src/lib/planLimits.js](../src/lib/planLimits.js) — never hardcode limits elsewhere.
- **Phase 2 (future, NOT started):** integrate Google Play Billing for real monthly/yearly subscriptions. The PaywallModal deliberately has NO "Upgrade Sekarang" button yet.

Key pieces: `useSubscription` hook (exposes `isPro`, `limits`, `setPlanForTesting`), `PaywallProvider`/`usePaywall` ([src/components/PaywallModal.jsx](../src/components/PaywallModal.jsx)) triggered from data hooks + page guards. Run [supabase/subscriptions.sql](../supabase/subscriptions.sql) in the Supabase SQL Editor before testing (creates table, RLS, signup trigger, backfill). Gated features: custom categories (max 3), wallets (max 1), savings goals (max 2), receipt scan/OCR, recurring transactions, report PDF/Excel export, 3 of 5 font themes.

**Why:** the tiering and the "manual switch now, billing later" split is a deliberate project plan from the owner, not visible from code alone.
