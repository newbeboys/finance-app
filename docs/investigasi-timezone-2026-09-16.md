# Investigasi: Asumsi WIB (+7) Hardcoded di Seluruh Codebase

**Tanggal:** 16 September 2026
**Sifat:** Investigasi murni — TIDAK ADA perubahan kode, TIDAK ADA migration baru. Laporan ini adalah dasar keputusan desain sebelum implementasi dukungan timezone selain WIB (jika nanti diputuskan).

**Ringkasan temuan utama:** Tidak ada satu pun titik di client (`src/`) yang melakukan aritmetika `+7` literal pada `Date`. Sebaliknya, seluruh aplikasi bergantung pada **asumsi sistemik**: setiap perhitungan "hari ini"/"bulan ini"/rentang tanggal memanggil `new Date()` lalu membaca dengan getter **lokal** (`getFullYear()`, `getMonth()`, `getDate()`, `getDay()`) — ini hanya benar karena kode berasumsi timezone OS/browser device adalah WIB. Di sisi server, hardcoding WIB eksplisit ditemukan di **dua lapisan berbeda**: edge function `financial-chat/query-builder.ts` (konstanta `WIB_OFFSET_MS = 7 * 60 * 60 * 1000`) dan — baru ditemukan di sesi ini, belum tercatat di CLAUDE.md — migration RPC `20260921000000_add_tier_limit_rpcs.sql` (literal `AT TIME ZONE 'Asia/Jakarta'`). Edge function `financial-chat` **tidak punya cara apa pun** untuk mengetahui timezone pemanggil (dikonfirmasi dengan membaca kode auth penuh). Tidak ada kolom timezone di skema database mana pun.

---

## BAGIAN A — Client (`src/`)

Tidak ditemukan hit literal `+7`, `7*60`, `420`, atau `25200` pada objek `Date` di `src/`. Pola yang dipakai di seluruh 18 file di bawah adalah `new Date()` + getter lokal (bukan `toISOString()`), dan pola ini didokumentasikan eksplisit lewat komentar Bahasa Indonesia yang memperingatkan developer untuk TIDAK memakai `toISOString()` karena akan menggeser tanggal WIB (mis. `useNotifications.js:25-27`, `widgets.jsx:617-618`, `useDebts.js:364-365`).

### A.1 — Titik yang MENULIS tanggal ke database

| File | Baris | Fungsi pemanggil | Kutipan |
|---|---|---|---|
| `src/hooks/useTransactions.js` | 252-255 | `createTransactionInner(tx)` ← `AddTransactionModal.submit` | `const now = new Date(); const todayISO = \`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}\`;` — fallback `date` yang dikirim ke RPC `record_transaction` bila `tx.dateRaw` kosong. |
| `src/transactions.jsx` | 169-171, 287, 375-378 | `AddTransactionModal.submit()` | `const dateToISO = d => ...; const todayISO = () => dateToISO(new Date());` dipakai sebagai default state `dateRaw` (L287) dan dibentuk ulang di `submit()` (L375-378) sebelum dikirim ke `createTransaction`/`updateTransaction`. |
| `src/hooks/useDebts.js` | 573-575 | `markPaid(debtId)` ← tombol "Mark as paid" di `DebtDetailSheet` | `const today = new Date(); const todayISO = ...; return addPayment(debtId, { amount: remaining, date: todayISO, ... });` — ditulis ke `debt_payments.date` dan diteruskan ke `transactions.date`. |
| `src/components/debts/AddDebtModal.jsx` | 10-13, 38, 53, 66-77 | `submit()` ← tombol simpan modal hutang | `todayISO()` jadi default `dateISO`; dikirim sebagai `debts.date` ke `onCreate` (`createDebt`). |
| `src/components/debts/DebtDetailSheet.jsx` | 10-13, 31, 62 | `submitPayment()` ← form "Tambah pembayaran" | `todayISO()` (duplikasi helper yang sama) jadi default `payDate`; ditulis ke `debt_payments.date`. |
| `src/lib/recurringHelper.js` | 17, 41, 89, 151-221 (khususnya 155, 175) | `checkRecurringTransactions(createTransaction, wallets)` ← dipanggil `app.jsx` saat aplikasi dibuka | **Temuan paling berisiko di seluruh audit.** `const today = todayISO(); ... while (item.nextDueDate && item.nextDueDate <= today && guard < MAX) { ... const res = await createTransaction(tx); ... }` — mesin eksekusi otomatis transaksi berulang. Perbandingan `nextDueDate <= today` memakai "hari ini" versi device-local-WIB untuk memutuskan apakah transaksi harus di-insert ke Supabase. Default `mulaiDari` (L89, dipakai `normalize()` saat user menyimpan jadwal) juga `todayISO()`. |
| `src/components/RecurringTransactionForm.jsx` | 127, 147 | Form buat/edit jadwal berulang | `React.useState(todayISO())` — default tanggal mulai jadwal, yang kemudian dibandingkan terhadap "hari ini" di `checkRecurringTransactions` (baris di atas) untuk memutuskan eksekusi. |

**Catatan bug terbalik (bukan hardcode WIB, tapi kebalikannya):** `src/lib/debtProof.js:133` — `generatedOn: i18n.t('debts.proof.generatedOn', { tanggal: fmtDateLong(new Date().toISOString().slice(0, 10)) })`. Ini satu-satunya tempat di `src/` yang memakai `toISOString()` (UTC) padahal pola di seluruh file lain sengaja menghindarinya. Dampak: teks "Dibuat pada" di PDF bukti hutang akan menunjukkan tanggal **kemarin** untuk generate yang terjadi antara 00:00–06:59 WIB. Tergolong READ/FILTER (teks tampilan, bukan tulis ke DB), tapi dicatat di sini karena berlawanan arah dengan pola dominan — perlu diperbaiki terpisah dari keputusan desain timezone (bug murni, bukan masalah desain).

### A.2 — Titik yang hanya MEMBACA/FILTER (tidak menulis ke DB)

Semua berikut memakai `new Date()` + getter lokal untuk menentukan batas "hari ini"/"bulan ini"/"minggu ini" pada saat menampilkan atau memfilter data yang sudah ada:

- **`src/hooks/useNotifications.js`** — L25-30 (`localISO()`, dengan komentar eksplisit soal WIB), L33-39 (`thisWeekKey`), L44 (`budgetNotifs`), L77 (`incomeNotifs`), L104-114 (`weeklyNotif`), L136-138 (`billsNotif`), L166-168 (`debtsNotifs`, due-in-3-hari). Semua generasi notifikasi in-app.
- **`src/widgets.jsx`** — L22-24 & L35-40 (`KpiCards`, kartu bulan-ini + sparkline 8 bulan), L107-130 (`computeCashflow`), L220-221 & L261 (`SpendingCard`), L308-310 (`buildInsights`), L574-578 (`DebtsCard`, badge jatuh tempo terdekat), L616-631 (`WeeklySummaryCard`/`lastWeekRange`, dengan komentar eksplisit soal WIB).
- **`src/analytics.jsx`** — L16-43 (`computeBarData`), L46-67 (`computeCatData`), L69-94 (`computeIncomeData`), L184-247 (state & rolling-window 12 bulan `AnalyticsPage`), L310 (tombol unduh laporan tahun).
- **`src/lib/budgetSpent.js`** — L32-33, sumber tunggal perhitungan "terpakai bulan ini" untuk budget, dipakai `budgets-page.jsx`, `widgets.jsx`, dan `useNotifications.js`.
- **`src/lib/widgetSync.js`** — L25-29 & L42, data yang didorong ke widget Android home-screen (`incomeToday`, prefix bulan).
- **`src/debts-page.jsx`** — L11-31 (`todayISO`, `plusDaysISO`, `daysBetween`, `dueBadge`), badge overdue/jatuh-tempo-3-hari.
- **`src/hooks/useDebts.js`** — L292-297, tanggal "boleh buat hutang lagi" untuk tampilan (mencampur `created_at` timestamptz UTC dengan getter lokal — aman karena hasil akhirnya dikonsumsi sebagai tanggal kalender WIB, tapi pola pencampurannya sama dengan yang diaudit). L247-249 sengaja **bukan** WIB-biased (`toISOString()` dipakai untuk membandingkan `timestamptz` penuh, bukan tanggal kalender — ini benar dan bukan bug).
- **`src/pages/RecurringTransactionPage.jsx`** — L121-125, format tampilan `nextDueDate` (bukan perhitungan "hari ini").
- **`src/transactions-page.jsx`** — L26-27, L48, default filter bulan berjalan.
- **`src/components/MonthYearPicker.jsx`** — L8-11, posisi default picker (dipakai `analytics.jsx` & `widgets.jsx`).
- **`src/transactions.jsx`** — L181-189, L238 (`DatePickerPopup`, komponen picker kalender bersama yang dipakai di jalur WRITE di atas — logikanya sendiri murni UI/READ).
- **`src/_test-tx-filter-harness.jsx`** — dev-only, tidak ter-mount dari `main.jsx`/`app.jsx`, diabaikan untuk keputusan desain.

**File yang dicek dan TIDAK ada hit relevan:** `useSavings.js`, `useBudgets.js`, `useSubscription.js` (`toISOString()` di sana benar karena kolomnya `timestamptz`, bukan `date`), `useWallets.js`, `useWalletMembers.js`, `useCustomCategories.js`, `useAutoLock.js`, `lib/lockStatus.js`, `lib/planLimits.js`, `lib/planReconciliation.js`, `lib/walletAccess.js`, `lib/strukParser.js` (parsing tanggal dari teks OCR, bukan jam device), `report-excel.js`, `reports.jsx` (hanya format `dateRaw` yang sudah tersimpan), `app.jsx`, `components/MoneyIQChat.jsx`, `components/ScanStruk.jsx`, `data.jsx`, `budgets-page.jsx`, `savings-page.jsx`, `components/EditCategoryModal.jsx`.

---

## BAGIAN B — Server (`supabase/functions/`)

### B.1 — `financial-chat/query-builder.ts`

Komentar header file, `query-builder.ts:12-16`:
```
//  2. Tanggal LOKAL (WIB / UTC+7), BUKAN UTC.
//     Kolom `transactions.date` bertipe DATE dan diisi tanggal lokal user
//     (YYYY-MM-DD). Deno berjalan di UTC, jadi kalau kita pakai new Date()
//     mentah lalu toISOString(), bisa meleset 1 hari (masalah off-by-one
//     WIB). Semua rentang tanggal dihitung dgn menggeser waktu +7 jam dulu.
```

`nowWIB()`, verbatim (`query-builder.ts:22-27`):
```ts
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Waktu "sekarang" dalam kalender WIB (dibaca via getUTC* setelah digeser). */
function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}
```

`computeDateRange()`, verbatim (`query-builder.ts:47-99`):
```ts
export function computeDateRange(intent: ParsedIntent): DateRange {
  const now = nowWIB();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1; // 1-based
  const curD = now.getUTCDate();

  // ── Bulan / tahun eksplisit ──────────────────────────────────────
  if (intent.month) {
    const y = intent.year ?? curY;
    const m = intent.month;
    return { start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
  }
  if (intent.year && !intent.period) {
    return { start: ymd(intent.year, 1, 1), end: ymd(intent.year, 12, 31) };
  }

  // ── Periode relatif ──────────────────────────────────────────────
  switch (intent.period) {
    case "today":
      return { start: ymd(curY, curM, curD), end: ymd(curY, curM, curD) };

    case "yesterday": { ... subtracts 24h ms from WIB-shifted now, re-reads via getUTC* ... }

    case "this_week": { ... dow = now.getUTCDay(); daysSinceMonday = (dow + 6) % 7; ... }

    case "last_month": { ... rollback bulan dari curY/curM ... }

    case "this_year":
      return { start: ymd(curY, 1, 1), end: ymd(curY, curM, curD) };

    case "this_month":
    default:
      return { start: ymd(curY, curM, 1), end: ymd(curY, curM, curD) };
  }
}
```

Tempat lain di file ini yang bergantung pada `nowWIB()`: pemanggilan kedua di `fetchTransactions` (sekitar L333-341, sesuai laporan agent, belum diverifikasi ulang baris-per-baris di sesi ini) untuk menentukan `isRunningPeriod` (apakah `range.end === hari ini WIB`) yang memengaruhi teks `leadAnswer` yang disuntikkan ke prompt LLM.

`types.ts` mendokumentasikan asumsi yang sama di komentar (`date: string; // YYYY-MM-DD (lokal WIB, bukan UTC)`).

**File lain di `supabase/functions/` yang dicek:** `financial-chat/index.ts`, `guardrail.ts`, `intent-parser.ts`, `groq-client.ts` — tidak ada aritmetika tanggal/timezone sama sekali di file-file ini (`intent-parser.ts` hanya memetakan frasa seperti "hari ini"/"bulan ini" ke string simbolik `IntentPeriod`, perhitungan tanggal aktual hanya terjadi di `computeDateRange()`). `revenuecat-webhook/index.ts` memakai `Date`/`Date.now()` murni untuk timestamp UTC absolut (`expiresAt`, `originalPurchaseAt` — epoch millis → ISO string), tidak ada logika "hari ini"/kalender lokal sama sekali di file ini — timezone-agnostic by construction.

### B.2 — Apakah edge function tahu timezone pemanggil? **TIDAK.**

Diverifikasi dengan membaca kode auth penuh di `financial-chat/index.ts:143-165`:
```ts
// ── 1. Auth via JWT ────────────────────────────────────────────────
// user_id diambil dari token, BUKAN dari body → user tak bisa mengintip
// data orang lain dgn memalsukan user_id. RLS juga otomatis membatasi.
const authHeader = req.headers.get("Authorization") ?? "";
const token = authHeader.replace(/^Bearer\s+/i, "").trim();
if (!token) {
  return json({ answer: "Unauthorized", source: "error" }, 401);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  },
);

const { data: userData, error: authErr } = await supabase.auth.getUser(token);
if (authErr || !userData?.user) {
  return json({ answer: "Unauthorized", source: "error" }, 401);
}
const userId = userData.user.id;
```
Hanya `userData.user.id` yang diambil — tidak ada kode yang membaca `user_metadata`/`app_metadata`/custom claim JWT lain di manapun dalam `supabase/functions/`.

Header yang dibaca (`CORS_HEADERS` allow-list, `index.ts:27-32`): hanya `authorization, x-client-info, apikey, content-type`. Tidak ada `Accept-Language` atau header timezone kustom, dan tidak ada kode yang memanggil `req.headers.get(...)` selain untuk `Authorization`.

Body request (`ChatRequest`, `types.ts:10-13`) hanya berisi `question` dan `user_id?` opsional (tidak dipercaya, IDOR guard) — tidak ada field timezone/locale.

Pencarian `timezone`/`tz_offset`/`utc_offset` di seluruh `supabase/` (termasuk migrations): **nol hit** di luar migration `20260921000000` (lihat Bagian C). Tidak ada tabel yang disentuh `financial-chat` (`wallets`, `transactions`, `budgets`, `savings`, `custom_categories`, `debts`, `error_logs`, `chat_unanswered_log`) yang punya kolom timezone.

**Kesimpulan:** `nowWIB()` bukan pengganti sementara untuk lookup yang sebenarnya ada di tempat lain — itu memang **satu-satunya** sumber informasi "sekarang"/timezone di seluruh jalur permintaan edge function ini. Mendukung timezone lain butuh transport baru (header, JWT claim, atau kolom tabel profil) sebelum `query-builder.ts` bisa diubah untuk memakainya.

### B.3 — Temuan baru: hardcoding WIB di lapisan RPC database (belum tercatat di CLAUDE.md)

Di luar cakupan awal ("edge functions"), ditemukan lapisan ketiga: migration **belum di-commit**, bagian dari kerja sesi berjalan (lihat git status: `A supabase/migrations/20260921000000_add_tier_limit_rpcs.sql`), berisi fungsi `create_debt()` yang JUGA hardcode `AT TIME ZONE 'Asia/Jakarta'`:

Komentar desain, `20260921000000_add_tier_limit_rpcs.sql:416-421`:
```sql
--  TANGGAL "boleh lagi" DIHITUNG DALAM WIB, bukan UTC. now() dan created_at
--  bertipe timestamptz (instant, tidak ambigu), tapi yang dikembalikan ke UI
--  adalah TANGGAL KALENDER — dan kalender di aplikasi ini selalu WIB (lihat
--  CLAUDE.md "Dates are local (WIB), never UTC"). Tanpa `AT TIME ZONE
--  'Asia/Jakarta'`, setiap perhitungan antara 00:00-07:00 WIB akan meleset
--  satu hari dari yang dihitung klien untuk data yang sama.
```

Pemakaian 1 — hitung tanggal "boleh membuat hutang lagi" setelah cooldown 50 hari, `20260921000000_add_tier_limit_rpcs.sql:526-528`:
```sql
-- Tanggal kalender WIB — lihat catatan zona waktu di header bagian ini.
v_until := ((v_oldest + make_interval(days => c_cooldown_days))
              AT TIME ZONE 'Asia/Jakarta')::date;
```

Pemakaian 2 — fallback tanggal transaksi hutang bila klien tidak mengirim `p_date`, `20260921000000_add_tier_limit_rpcs.sql:550-555`:
```sql
-- Tanggal hari ini dalam WIB, BUKAN CURRENT_DATE. CURRENT_DATE di server
-- adalah tanggal UTC: antara 00:00-07:00 WIB dia masih menunjuk hari
-- kemarin, dan catatan akan tercatat mundur satu hari dari yang dilihat
-- user. Kolomnya memang ber-DEFAULT CURRENT_DATE, tapi jalur ini tidak
-- memakai default itu.
COALESCE(p_date, (now() AT TIME ZONE 'Asia/Jakarta')::date),
```

Migration lain yang sudah ter-apply sebelumnya justru **menghindari** hardcode ini dengan cara berbeda: `record_transaction` RPC (`20260911010000_add_rpc_record_transaction.sql:27-33`) sengaja **tidak** punya fallback `CURRENT_DATE` sama sekali — parameter `p_date` wajib diisi klien, persis karena `CURRENT_DATE` di server adalah UTC dan akan salah untuk WIB antara 00:00–07:00:
```sql
--  KONVENSI TANGGAL:
--    p_date bertipe `date` (bukan timestamp) dan WAJIB diisi klien. Kolom
--    transactions.date menyimpan tanggal kalender LOKAL (WIB), bukan
--    timestamp UTC. Sengaja TIDAK ada fallback ke CURRENT_DATE: CURRENT_DATE
--    di server Supabase adalah UTC, yang untuk WIB (UTC+7) salah satu hari
--    setiap malam sebelum jam 07:00. Klien sudah menghitung tanggal lokalnya
--    sendiri — biarkan itu satu-satunya sumber.
```
Jadi ada **dua pola berbeda** untuk masalah yang sama di dalam RPC layer: `record_transaction` menolak menebak dan mewajibkan klien mengirim tanggal; `create_debt` (migration baru) memilih menebak sendiri dengan `AT TIME ZONE 'Asia/Jakarta'` sebagai fallback. Keduanya konsisten dengan "WIB hardcoded", tapi mekanismenya berbeda — relevan untuk keputusan desain karena kalau nanti timezone user jadi dinamis, KEDUA pola butuh perubahan dengan cara berbeda (yang satu di klien saat membangun `p_date`, yang satu di dalam body SQL RPC).

---

## BAGIAN C — Skema Database

### C.1 — Tidak ada kolom preferensi timezone di mana pun

Pencarian `timezone|tz_offset|utc_offset|Asia/Jakarta` di seluruh `supabase/` (schema + semua migration): satu-satunya hit di luar komentar adalah migration `20260921000000` (Bagian B.3 di atas). Tidak ada kolom timezone di tabel manapun, termasuk `user_subscriptions` — satu-satunya tabel per-user yang bukan data finansial murni:

`supabase/subscriptions.sql:7-14`:
```sql
create table if not exists public.user_subscriptions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  plan          text not null default 'basic' check (plan in ('basic','pro')),
  billing_cycle text check (billing_cycle in ('monthly','yearly')),
  started_at    timestamptz,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);
```
Kalau timezone user perlu disimpan di server, tabel ini (atau tabel profil baru) butuh migration baru menambah kolom (mis. `timezone text default 'Asia/Jakarta'`) — **kebutuhan migration baru yang belum ada**.

### C.2 — Tipe kolom tanggal: semua `date` polos, dikonfirmasi

| Kolom | Tipe | Sumber |
|---|---|---|
| `transactions.date` | `date NOT NULL DEFAULT CURRENT_DATE` | `supabase/schema.sql:15` |
| `debts.date` | `date NOT NULL DEFAULT CURRENT_DATE` | `supabase/migrations/20260704000000_add_debts.sql:23` |
| `debts.due_date` | `date DEFAULT NULL` | `supabase/migrations/20260704000000_add_debts.sql:24` |
| `debt_payments.date` | `date NOT NULL DEFAULT CURRENT_DATE` | `supabase/migrations/20260704000000_add_debts.sql:43` |
| `savings.deadline_date` | `DATE NULL` | `supabase/migrations/20260701000000_add_deadline_date_to_savings.sql:10` |

Tidak satu pun `timestamptz`. Ini mengonfirmasi klaim CLAUDE.md: data lama tidak menyimpan informasi offset apa pun — begitu baris `date` ditulis, informasi "ini WIB atau timezone lain" **hilang permanen**; tidak bisa direkonstruksi dari data itu sendiri. Kolom `created_at`/`updated_at` di semua tabel bertipe `timestamptz` (instant absolut, benar dan tidak ambigu) — kontras yang jadi dasar beberapa komentar kode (mis. `useDebts.js:247-249`) yang secara eksplisit membedakan pemakaian `timestamptz` (aman UTC) vs `date` (WIB, tidak aman UTC).

---

## BAGIAN D — Estimasi Dampak

### D.1 — Daftar file, dikelompokkan per lapisan

**Lapisan 1 — Input transaksi/hutang/tabungan (WRITE, risiko tertinggi bila diubah salah):**
- `src/hooks/useTransactions.js` (fallback tanggal transaksi)
- `src/transactions.jsx` (`AddTransactionModal`, `DatePickerPopup`)
- `src/hooks/useDebts.js` (`markPaid`, komentar RPC)
- `src/components/debts/AddDebtModal.jsx`
- `src/components/debts/DebtDetailSheet.jsx`
- `src/lib/recurringHelper.js` (**mesin auto-eksekusi, paling kritikal**)
- `src/components/RecurringTransactionForm.jsx`
- Server: `supabase/migrations/20260911010000_add_rpc_record_transaction.sql` (`record_transaction`, sudah benar — menolak fallback UTC)
- Server: `supabase/migrations/20260921000000_add_tier_limit_rpcs.sql` (`create_debt`, hardcode `Asia/Jakarta`, **belum di-commit**)

**Lapisan 2 — Filter tampilan (READ/FILTER, risiko lebih rendah — salah tampil, bukan salah tulis):**
- `src/hooks/useNotifications.js`
- `src/widgets.jsx`
- `src/analytics.jsx`
- `src/lib/budgetSpent.js`
- `src/debts-page.jsx`
- `src/transactions-page.jsx`
- `src/components/MonthYearPicker.jsx`
- `src/pages/RecurringTransactionPage.jsx`

**Lapisan 3 — Laporan PDF/Excel:**
- `src/lib/debtProof.js` (bug UTC terbalik, L133 — perlu fix terpisah dari keputusan timezone)
- `src/lib/widgetSync.js` (widget Android home-screen)
- Catatan: `reports.jsx`/`report-excel.js` sendiri **tidak** melakukan perhitungan "hari ini" — hanya memformat `dateRaw` yang sudah tersimpan, jadi tidak masuk daftar ini kecuali kalau nanti butuh label timezone eksplisit di header laporan.

**Lapisan 4 — Money IQ / edge function:**
- `supabase/functions/financial-chat/query-builder.ts` (`nowWIB`, `computeDateRange`, `isRunningPeriod`)
- `supabase/functions/financial-chat/types.ts` (komentar dokumentasi, tidak ada logika)

### D.2 — Wajib berubah vs boleh tetap hardcode sementara

Karena **tidak ada infrastruktur transport timezone sama sekali** (tidak ada kolom DB, tidak ada JWT claim, tidak ada header) — lihat Bagian B.2 dan C.1 — pertanyaan "mana yang wajib berubah" belum bisa dijawab tanpa keputusan desain lebih dulu: **dari mana timezone user akan datang?** (device locale saat runtime? preferensi tersimpan di `user_subscriptions`? terikat ke lokasi/negara akun?)

Sampai keputusan itu diambil, semua titik di atas **boleh tetap hardcode WIB** — ini bukan bug tersembunyi, ini keputusan desain yang sudah didokumentasikan konsisten (`CLAUDE.md` §"Dates are local (WIB), never UTC"). Yang **bisa disiapkan sekarang tanpa menunggu keputusan produk**, murni sebagai infrastruktur:

1. Migration menambah kolom timezone opsional ke `user_subscriptions` (default `'Asia/Jakarta'`, tidak mengubah perilaku apa pun sampai dipakai).
2. Konsolidasi ~6 duplikat helper `todayISO()`/`localISO()`/`dateToISO()` yang identik (`transactions.jsx`, `useDebts.js`, `AddDebtModal.jsx`, `DebtDetailSheet.jsx`, `debts-page.jsx`, `useNotifications.js`, `widgets.jsx`, `recurringHelper.js`) menjadi satu util bersama di `src/utils/` — akan memudahkan titik perubahan tunggal kalau/ketika timezone jadi dinamis, dan berdiri sendiri sebagai cleanup tanpa perlu keputusan produk apa pun.
3. Perbaikan bug `debtProof.js:133` (UTC vs WIB terbalik) — independen dari keputusan timezone, murni bug existing.

**Tidak direkomendasikan untuk dikerjakan sekarang:** mengubah `nowWIB()`/`computeDateRange()` atau logika client manapun untuk "membaca timezone dari sumber lain" — sumber itu belum ada, dan mengubah sebagian titik tanpa mengubah semuanya (44 titik hit di `src/` + 2 lapisan server) akan membuat sebagian layar konsisten WIB dan sebagian lagi tidak, persis pola inkonsistensi yang sudah pernah jadi masalah di keputusan currency (`CLAUDE.md` §Currency).

---

## Lampiran — Ringkasan jumlah titik per kategori

| Kategori | Jumlah file | Jumlah titik hit |
|---|---|---|
| Client — WRITE (menulis ke DB) | 7 | ~15 |
| Client — READ/FILTER | 11 | ~44 |
| Server — edge function (`financial-chat`) | 1 (`query-builder.ts`) | 1 konstanta + 2 fungsi + 1 pemanggilan kedua |
| Server — RPC database (migration baru, belum commit) | 1 (`20260921000000_add_tier_limit_rpcs.sql`) | 2 (`AT TIME ZONE 'Asia/Jakarta'`) |
| Skema DB — kolom timezone | 0 | — |
| Bug arah terbalik (UTC dipakai, WIB dimaksud) | 1 (`debtProof.js`) | 1 |
