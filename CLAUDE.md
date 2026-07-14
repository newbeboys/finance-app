# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

FinanceApp — a personal finance tracker (transactions, budgets, savings, debts/receivables, wallets, an AI finance chatbot) built as a React SPA, packaged for Android via Capacitor. Backend is entirely Supabase (Postgres + Auth + Edge Functions). Subscriptions/paywall are handled via RevenueCat. UI text and most code comments are in Bahasa Indonesia; keep that convention when editing existing files.

## Commands

```bash
npm run dev        # Vite dev server
npm run build       # Production build (bumps Node heap via cross-env NODE_OPTIONS — large app)
npm run preview     # Preview the production build
```

There is no lint script and no automated test suite configured (`playwright` is a devDependency but no config/spec files exist in the repo). Verify changes by running the app and exercising the affected flow manually.

### Android / Capacitor

```bash
npx cap sync android          # after npm run build, syncs web assets + plugins into the native project
cd android && ./gradlew bundleRelease   # produces a signed AAB (needs keystore + signing env vars)
```

CI (`.github/workflows/build-apk.yml`) builds the AAB automatically on push to `main`/`master`: `npm ci` → `npm run build` (with `VITE_REVENUECAT_API_KEY_ANDROID` secret) → `cap sync android` → `gradlew bundleRelease` (signed with keystore secrets).

### Supabase (backend)

```bash
supabase login
supabase link --project-ref ykyzgaztfbvwsjdcdpwk
supabase db push                              # apply supabase/migrations/*.sql
supabase functions deploy <function-name>     # e.g. financial-chat, revenuecat-webhook
supabase secrets set KEY=value                # e.g. REVENUECAT_WEBHOOK_AUTH
```

Full setup steps (env vars, RevenueCat webhook wiring, testing checklist before a production build) are in `docs/SETUP.md`.

### Environment variables

Copy `.env.example` to `.env`. Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key — safe for client, protected by RLS; never put the `service_role` key in client code). Optional: `VITE_REVENUECAT_API_KEY_ANDROID`.

## Architecture

### No router — one big state machine

There is no client-side router. `src/app.jsx` (`App` component) owns a single large state tree and switches views by rendering conditionally: auth session (via Supabase `onAuthStateChange`) → device security gate (PIN and biometric lock, mutually exclusive, checked in `src/lib/pin.js` / `src/lib/biometric.js`) → splash screen → onboarding (first login/register only, not persisted) → product tour → main tabbed content. Tab/page switching within the authenticated app is also local state in `app.jsx`, not routes.

### Data layer: one hook per domain, no global store

There is no Redux/Zustand/Context-based data store. Each domain has a dedicated hook in `src/hooks/` (`useTransactions`, `useSavings`, `useWallets`, `useBudgets`, `useDebts`, `useCustomCategories`, `useSubscription`, `useNotifications`, `useRevenueCat`) that calls the Supabase client (`src/supabase.js`) directly, keeps its own `useState`, and is composed together in `app.jsx`. Every query is scoped by `user_id` client-side *and* by Postgres RLS server-side (defense in depth) — always filter by `user_id` explicitly even though RLS would also block cross-user access.

`src/lib/` holds framework-agnostic business logic used by those hooks/components (`planLimits.js`, `planReconciliation.js`, `recurringHelper.js`, `widgetSync.js`, `strukParser.js`, `pin.js`, `biometric.js`, `sound.js`, `errorLogger.js`). `src/utils/` holds small pure helpers (`numberFormat.js`, `pinHash.js`, `sessionValidator.js`).

### Dates are local (WIB), never UTC

Transaction/date columns are Postgres `DATE` storing the user's local calendar date (`YYYY-MM-DD`, WIB/UTC+7) — not a UTC timestamp. Never derive date keys or comparisons with `new Date().toISOString()`; that shifts by the UTC offset and produces an off-by-one-day bug. Shift by the WIB offset first (see `computeDateRange` / `nowWIB` in `supabase/functions/financial-chat/query-builder.ts` for the reference pattern) when computing "today"/date ranges anywhere, client or server.

### Plan gating (Basic vs Pro)

`src/lib/planLimits.js` (`PLAN_LIMITS`) is the single source of truth for every feature limit and gate (max transactions/wallets/budgets/savings goals, feature flags like `receiptScanEnabled`, `aiInsightsEnabled`, available font themes, etc.). Never hardcode a limit elsewhere — always read it via `useSubscription(userId).limits`. `isPro` requires both `plan === 'pro'` **and** a non-expired `expires_at`; while subscription data is loading, gating fails closed to Basic limits so restrictions never briefly leak open. `user_subscriptions` is kept in sync with RevenueCat via the `revenuecat-webhook` edge function and mirrored live to the client over a Supabase Realtime channel.

### Supabase schema

Tables (all RLS-protected, scoped by `user_id`): `transactions`, `savings`, `budgets`, `wallets`, `debts`, `debt_payments`, `custom_categories`, `user_subscriptions`, `error_logs`. Base schema in `supabase/schema.sql`, `supabase/custom_categories.sql`, `supabase/subscriptions.sql`; incremental changes in `supabase/migrations/*.sql` (timestamp-prefixed, applied in order via `supabase db push`).

Category values on `transactions`/`budgets` rows are either a built-in code (`food`, `transport`, `salary`, …, not UUIDs) or a `custom_categories.id` UUID. `custom_categories.id` is a Postgres `uuid` column — a `.in("id", categoryIds)` query fails entirely (not a partial skip) if any non-UUID string is mixed into the id list, so any code resolving category names must filter to UUID-shaped strings first (see `UUID_PATTERN` / `resolveCategoryNames` in `supabase/functions/financial-chat/query-builder.ts`).

### Edge Functions (`supabase/functions/`, Deno)

- **`financial-chat`** — AI chatbot answering questions about the logged-in user's own financial data. `index.ts` authenticates via the request's JWT (never trusts a `user_id` from the request body — IDOR protection) and runs a 3-level guardrail pipeline: **L1** `keywordFilter` (`guardrail.ts`, instant, no API call) → **L2** `classifyWithGroq` (`guardrail.ts`, Groq call, FINANCIAL vs OUT_OF_SCOPE) → **L3** `parseIntent` (`intent-parser.ts`) → `fetchFinancialData` (`query-builder.ts`, builds the right Supabase query per intent type, using the user's authenticated/RLS-scoped client) → `answerFinancialQuestion` (`groq-client.ts`) composes the final natural-language answer. Errors are logged to the `error_logs` table (service-role client) rather than surfaced raw to the user.
- **`revenuecat-webhook`** — server-to-server webhook receiving RevenueCat purchase events, updates `user_subscriptions` using the service-role client. No CORS handling needed (unlike `financial-chat`, which is called from the browser/app and requires it).

### i18n

`react-i18next`, locale strings in `src/locales/{en,id}/translation.json`. Bahasa Indonesia is the default/primary language throughout the app.
