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

There is no Redux/Zustand/Context-based data store. Each domain has a dedicated hook in `src/hooks/` (`useTransactions`, `useSavings`, `useWallets`, `useWalletMembers`, `useBudgets`, `useDebts`, `useCustomCategories`, `useSubscription`, `useNotifications`, `useRevenueCat`) that calls the Supabase client (`src/supabase.js`) directly, keeps its own `useState`, and is composed together in `app.jsx`. Every query is scoped client-side *and* by Postgres RLS server-side (defense in depth) — always constrain the query explicitly even though RLS would also block cross-user access. For most domains that constraint is `.eq('user_id', userId)`. **Exception: `wallets` and `transactions`**, which since the shared-wallet feature are scoped by "own rows **or** a wallet you're an active member of" — those two use `sharedOrFilter()` from `src/lib/walletAccess.js` instead (it falls back to a plain `.eq('user_id', …)` when the user has no shared wallets). Don't "fix" them back to a bare `user_id` filter; that silently hides shared-wallet data. Consequence: those arrays contain rows the user may **not** write. An UPDATE/DELETE that RLS rejects returns **0 rows, not an error** — so direct writes on `wallets` must `.select('id')` and treat an empty result as failure, and UI must gate with `canEditTransaction()`/`canDeleteTransaction()` and the `isShared`/`canWrite` flags from `useWallets` (use `writableAccounts` for any picker that records money). Since 12 Sep 2026 viewers and ex-members cannot update or delete *any* transaction in that wallet — not even rows they recorded themselves — so both gates require the wallet's `canWrite`; the resulting "nobody can delete it" rows are an accepted trade-off (see decision #6 in `teknis_arsitektur-database.md`). Transaction create/update/delete go **only** through the atomic RPCs `record_transaction`/`update_transaction`/`delete_transaction`, which write the row and the wallet balance together; the client never adjusts balances separately (`adjustBalance()` was removed — a "succeeded" 0-row delete followed by a separate balance adjustment corrupted balances once). Debt-linked transactions (`debt_id` set) are never shared: only their recorder can see them, even in a shared wallet.

`src/lib/` holds framework-agnostic business logic used by those hooks/components (`planLimits.js`, `planReconciliation.js`, `recurringHelper.js`, `widgetSync.js`, `strukParser.js`, `pin.js`, `biometric.js`, `sound.js`, `errorLogger.js`). `src/utils/` holds small pure helpers (`numberFormat.js`, `pinHash.js`, `sessionValidator.js`).

### Dates are local (WIB), never UTC

Transaction/date columns are Postgres `DATE` storing the user's local calendar date (`YYYY-MM-DD`, WIB/UTC+7) — not a UTC timestamp. Never derive date keys or comparisons with `new Date().toISOString()`; that shifts by the UTC offset and produces an off-by-one-day bug. Shift by the WIB offset first (see `computeDateRange` / `nowWIB` in `supabase/functions/financial-chat/query-builder.ts` for the reference pattern) when computing "today"/date ranges anywhere, client or server.

### Plan gating (Basic vs Pro)

`src/lib/planLimits.js` (`PLAN_LIMITS`) is the single source of truth for every feature limit and gate (max transactions/wallets/budgets/savings goals, feature flags like `receiptScanEnabled`, `aiInsightsEnabled`, available font themes, etc.). Never hardcode a limit elsewhere — always read it via `useSubscription(userId).limits`. `isPro` requires both `plan === 'pro'` **and** a non-expired `expires_at`; while subscription data is loading, gating fails closed to Basic limits so restrictions never briefly leak open. `user_subscriptions` is kept in sync with RevenueCat via the `revenuecat-webhook` edge function and mirrored live to the client over a Supabase Realtime channel.

### Supabase schema

Tables (all RLS-protected): `transactions`, `savings`, `budgets`, `wallets`, `debts`, `debt_payments`, `custom_categories`, `user_subscriptions`, `error_logs`, `wallet_members`. Most are scoped by `user_id`; `wallets` and `transactions` are scoped by "owner **or** active member" — see below. Base schema in `supabase/schema.sql`, `supabase/custom_categories.sql`, `supabase/subscriptions.sql`; incremental changes in `supabase/migrations/*.sql` (timestamp-prefixed, applied in order via `supabase db push`).

**Shared wallets & the RLS-recursion rule.** `wallet_members` (owner has *no* row there — `wallets.user_id` is the sole ownership truth) grants `editor`/`viewer` access to someone else's wallet. Access is resolved by `wallet_access_role(wallet_id) → 'owner' | 'editor' | 'viewer' | NULL`, a `SECURITY DEFINER` helper. **That indirection is mandatory, not stylistic:** a policy on `wallets` that reads `wallet_members` plus a policy on `wallet_members` that reads `wallets` makes Postgres throw `infinite recursion detected in policy for relation`, which kills *all* wallet access app-wide. `SECURITY DEFINER` bypasses RLS inside the function body and breaks that cycle. Any future table that needs membership-aware RLS (Task 3's invite flow included) must go through a helper like this rather than an inline `EXISTS(SELECT … FROM wallet_members)`. `wallet_members` and `wallet_invites` have **SELECT policies only** — all writes go through the `SECURITY DEFINER` RPCs (`generate_wallet_invite`, `accept_wallet_invite`, `leave_wallet`, `remove_wallet_member`); a write policy would let an owner bypass the RPCs' Pro gate and consent checks. Full policy matrix and product decisions: `teknis_arsitektur-database.md` → "Shared Wallet / Dompet Bersama".

Category values on `transactions`/`budgets` rows are either a built-in code (`food`, `transport`, `salary`, …, not UUIDs) or a `custom_categories.id` UUID. `custom_categories.id` is a Postgres `uuid` column — a `.in("id", categoryIds)` query fails entirely (not a partial skip) if any non-UUID string is mixed into the id list, so any code resolving category names must filter to UUID-shaped strings first (see `UUID_PATTERN` / `resolveCategoryNames` in `supabase/functions/financial-chat/query-builder.ts`).

### Edge Functions (`supabase/functions/`, Deno)

- **`financial-chat`** — AI chatbot answering questions about the logged-in user's own financial data. `index.ts` authenticates via the request's JWT (never trusts a `user_id` from the request body — IDOR protection) and runs a 3-level guardrail pipeline: **L1** `keywordFilter` (`guardrail.ts`, instant, no API call) → **L2** `classifyWithGroq` (`guardrail.ts`, Groq call, FINANCIAL vs OUT_OF_SCOPE) → **L3** `parseIntent` (`intent-parser.ts`) → `fetchFinancialData` (`query-builder.ts`, builds the right Supabase query per intent type, using the user's authenticated/RLS-scoped client) → `answerFinancialQuestion` (`groq-client.ts`) composes the final natural-language answer. Errors are logged to the `error_logs` table (service-role client) rather than surfaced raw to the user.
- **`revenuecat-webhook`** — server-to-server webhook receiving RevenueCat purchase events, updates `user_subscriptions` using the service-role client. No CORS handling needed (unlike `financial-chat`, which is called from the browser/app and requires it).

### i18n

`react-i18next` (`src/i18n.js`), locale strings in `src/locales/{en,id}/translation.json`, Bahasa Indonesia is the default/primary language. The 4-cluster full-migration effort (branch `chore/i18n-full-migration`) is **complete (4/4)**:

1. ✅ Hutang/Piutang — `debts-page.jsx`, `components/debts/AddDebtModal.jsx`, `components/debts/DebtDetailSheet.jsx`, `hooks/useDebts.js`.
2. ✅ Paywall & Subscription — `components/PaywallModal.jsx`, `components/subscription/*` (`FeatureComparison.jsx`, `SubscriptionStatus.jsx`, `UpgradeModal.jsx`, `RestorePurchaseButton.jsx`), plus every `openPaywall()` call site (feature-name/message args) across `app.jsx`, `widgets.jsx`, `settings-page.jsx`, `savings-page.jsx`, `reports.jsx`, and the `useWallets`/`useTransactions`/`useSavings`/`useCustomCategories`/`useBudgets` hooks.
3. ✅ Category modals — `components/EditCategoryModal.jsx`, `components/DeleteCategoryModal.jsx`, `components/IconColorPicker.jsx`. Also fixed a mixed-language bug found during this migration: `EditCategoryModal.jsx`'s confirm button hardcoded the English string `'Confirm Edit'` inside an otherwise-Indonesian sentence; it now reads `category.edit.confirmButton`, which is a full Indonesian translation ("Konfirmasi Edit") in the `id` locale.
4. ✅ Report content — `reports.jsx` (`buildPayload()`, `buildReportDoc()` PDF template, `downloadPdf()` native autotable pass, `ExcelPreviewRenderer`, `ReportPreview`, `FormatPicker`) and `report-excel.js` (worksheet names, column headers, row labels, canvas chart titles/legends). Both files are module-level (not React components), so labels resolve via `i18n.t()` directly — same pattern as `useDebts.js` — collected into one local `T = { … }` const per function rather than inline `t()` calls inside template literals. Month names (`laporan.doc.monthsFull`/`monthsAbbr`) and dates follow the UI language; `monthsIndex()` therefore takes `i18n.language` as a `useMemo` dependency in `ReportsPage`.

   In `report-excel.js`, worksheet names and the `Pemasukan`/`Pengeluaran` type labels are resolved **once** into `refs.sheetNames` / `refs.typeLabels` in `buildWorkbook()`, then reused for `addWorksheet()`, the cross-sheet formula references, the `SUMIFS` criteria, and the sheet-order array. Never write those literals anywhere else: a translated sheet name or type label that does not match its formula's string silently produces `#REF!` or a 0 total instead of an error. `sheetName()` enforces Excel's 31-char / illegal-character limits on the final name, and `sheetRef()`/`crit()` quote them for formulas.

5. ✅ Built-in category & wallet-type labels (follow-up di luar rencana 4 klaster). Label di `data.jsx` (`CATEGORIES`, `INCOME_CATEGORIES`, `DEBT_TX_CATEGORIES`, `ACCOUNT_TYPES`) **tetap hardcode Bahasa Indonesia dan sengaja tidak diubah** — dia sekarang berfungsi sebagai `defaultValue` fallback. Yang berubah adalah titik render: semuanya lewat resolver.
   - Kategori: `categoryLabel(cat, t)` di `category-field.jsx` → key `kategori.<id>` (terjemahan id/en sudah ada sejak klaster 3). Dipakai di `transactions.jsx`, `transactions-page.jsx`, `wallets.jsx`, `widgets.jsx`, `category-field.jsx`, dan (baru) `analytics.jsx`. `charts.jsx` (label tengah donut) dan `reports.jsx` memakai key yang sama secara inline.
   - `reports.jsx`: helper `catLabelOf()` di `aggregate()`/`withLabels()` adalah **satu-satunya** sumber label kategori untuk PDF, file .xlsx, dan pratinjau Excel sekaligus — jadi ketiganya dijamin identik. Ini wajib: label kategori dipakai sebagai kriteria SUMIFS lintas-sheet di `report-excel.js` (kolom A sheet kategori harus sama persis dengan kolom C sheet Detail).
   - **Kategori kustom milik user tidak pernah diterjemahkan** — id-nya UUID, tidak punya key `kategori.<uuid>`, jadi `defaultValue` mengembalikan nama simpanan apa adanya.
   - Dompet: `typeLabelI18n(id, t)` di `wallets.jsx` (key `dompet.rekeningBank`/`eWallet`/`tunai`/`investasi`). `typeLabel()` yang lama **sengaja dipertahankan** khusus untuk `institution: institution.trim() || typeLabel(type)` — nilai itu ditulis ke DB, jadi tidak boleh ikut bahasa UI (kalau ikut, dompet yang dibuat saat UI English tersimpan "Bank Account" dan saat UI Indonesia "Rekening Bank" → data tidak konsisten antar-baris).

Outside this plan, `components/MonthYearPicker.jsx`, `components/SplashScreen.jsx`, `tweaks-panel.jsx`, and the text `lib/widgetSync.js` pushes to the Android home-screen widget (its own `MONTHS_FULL`/`MONTHS_SHORT` plus category names read from `data.jsx`) are still hardcoded Bahasa Indonesia and not currently scheduled.

Don't assume a page is translated because most of the app is; check for `useTranslation`/`t()` in that specific file before relying on it.

### Currency: single-currency by design — never follows the UI language

This app is **deliberately single-currency**. Money is always rendered as Rupiah with `id-ID` grouping (`Rp 1.234.567`) in **every** context, including when the UI language is English. This is a settled decision, not unfinished i18n work — do not "fix" it, and do not re-open it without the user explicitly asking.

Locked, intentionally, and not to be migrated: `fmt`, `fmtSigned`, `formatNominal`, `fmtShort` in `data.jsx` (used across 22+ files); the local `rupiah()` helpers in `reports.jsx` (`buildReportDoc`, `downloadPdf`, `ExcelPreviewRenderer`) and `report-excel.js`; `rupiahShort()` and its `rb`/`jt`/`M` suffixes; and the `RP_FMT`/`PCT_FMT` Excel number formats (the literal `"Rp"` inside `RP_FMT` included). The rationale: those four `data.jsx` helpers are already locked to `id-ID` everywhere, so switching only the report money would mix two currency renderings on one screen — worse than the inconsistency it would try to fix.

What *does* follow the UI language is separate from currency: text labels, and **dates** (including month names) via `toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'id-ID', …)` — see `SubscriptionStatus.jsx` and `dateLocale()`/`longDate()` in `reports.jsx`.

## Documentation maintenance

Whenever you change architecture, the database schema, or add/change a feature — or discover a fact that contradicts what's written in this file or in a `teknis_*.md` file — update the relevant doc(s) before ending that work session, without waiting to be asked again:

- Database/migration changes → update `teknis_arsitektur-database.md`.
- Feature/tier/gating changes → update `teknis_fitur-dan-tier.md`.
- Infrastructure/roadmap decisions → update `teknis_keputusan-infrastruktur-roadmap.md`.
- If you find this CLAUDE.md itself stating something inaccurate (e.g. an overgeneralized claim that actually has exceptions), fix the sentence immediately — don't leave a false claim standing.
- Keep it terse: 1-3 sentences per change, not a long report.
