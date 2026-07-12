// ════════════════════════════════════════════════════════════════════
//  query-builder.ts — Ambil data dari Supabase sesuai ParsedIntent
//
//  DUA prinsip penting:
//
//  1. AMAN dari SQL injection.
//     Kita TIDAK merangkai string SQL manual. Kita pakai query builder
//     supabase-js (.eq / .gte / .lte / .order) yang otomatis
//     parameterized. Ini lebih aman & konsisten dgn kode app lain
//     (mis. revenuecat-webhook).
//
//  2. Tanggal LOKAL (WIB / UTC+7), BUKAN UTC.
//     Kolom `transactions.date` bertipe DATE dan diisi tanggal lokal user
//     (YYYY-MM-DD). Deno berjalan di UTC, jadi kalau kita pakai new Date()
//     mentah lalu toISOString(), bisa meleset 1 hari (masalah off-by-one
//     WIB). Semua rentang tanggal dihitung dgn menggeser waktu +7 jam dulu.
// ════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { DateRange, ParsedIntent, TransactionRow } from "./types.ts";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Waktu "sekarang" dalam kalender WIB (dibaca via getUTC* setelah digeser). */
function nowWIB(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format Y/M/D (M 1-based) → "YYYY-MM-DD". */
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Tanggal terakhir bulan m (1-based) di tahun y. */
function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Hitung rentang tanggal (inklusif) dari ParsedIntent, dalam kalender WIB.
 * Prioritas: month/year eksplisit > period relatif > default (bulan ini).
 */
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

    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const s = ymd(y.getUTCFullYear(), y.getUTCMonth() + 1, y.getUTCDate());
      return { start: s, end: s };
    }

    case "this_week": {
      // Minggu dimulai Senin. getUTCDay(): 0=Minggu..6=Sabtu.
      const dow = now.getUTCDay();
      const daysSinceMonday = (dow + 6) % 7; // Senin=0
      const monday = new Date(now.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
      return {
        start: ymd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
        end: ymd(curY, curM, curD),
      };
    }

    case "last_month": {
      const y = curM === 1 ? curY - 1 : curY;
      const m = curM === 1 ? 12 : curM - 1;
      return { start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
    }

    case "this_year":
      return { start: ymd(curY, 1, 1), end: ymd(curY, curM, curD) };

    case "this_month":
    default:
      // Default aman: bulan berjalan sampai hari ini.
      return { start: ymd(curY, curM, 1), end: ymd(curY, curM, curD) };
  }
}

// ── Format Rupiah ringkas untuk data context ─────────────────────────
function rupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

/**
 * Ambil data dari Supabase & rangkai jadi "data context" (string ringkas)
 * yang akan disuntikkan ke prompt answering model.
 *
 * Memakai client TER-AUTENTIKASI (JWT user) → RLS otomatis membatasi ke
 * data milik user. `userId` tetap ditambahkan sbg filter eksplisit
 * (defense-in-depth), tapi bukan satu-satunya pengaman.
 *
 * Return null bila tidak ada data relevan.
 */
export async function fetchFinancialData(
  supabase: SupabaseClient,
  intent: ParsedIntent,
  userId: string,
): Promise<{ context: string; rowCount: number } | null> {
  switch (intent.type) {
    case "budget":
      return fetchBudgets(supabase, userId);
    case "savings":
      return fetchSavings(supabase, userId);
    case "investment":
      return fetchInvestments(supabase, userId);
    case "expense":
    case "income":
      return fetchTransactions(supabase, intent, userId, intent.type);
    case "general":
    default:
      return fetchSummary(supabase, intent, userId);
  }
}

// ── transactions (expense / income) ──────────────────────────────────
async function fetchTransactions(
  supabase: SupabaseClient,
  intent: ParsedIntent,
  userId: string,
  type: "expense" | "income",
) {
  const range = computeDateRange(intent);

  let query = supabase
    .from("transactions")
    .select("category, amount, note, merchant, date, type")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("date", range.start)
    .lte("date", range.end);

  if (intent.category) query = query.eq("category", intent.category);

  // Urutan & limit: kalau minta total, ambil banyak lalu agregasi.
  const limit = intent.wantsTotal ? 500 : (intent.limit ?? 50);
  if (intent.order) query = query.order("amount", { ascending: intent.order === "asc" });
  else query = query.order("date", { ascending: false });
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as TransactionRow[];
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const label = type === "expense" ? "Pengeluaran" : "Pemasukan";

  const lines = rows.slice(0, intent.wantsTotal ? 10 : rows.length).map((r) => {
    const desc = r.merchant || r.note || r.category;
    return `- ${r.date} | ${r.category} | ${rupiah(Number(r.amount))} | ${desc}`;
  });

  const header =
    `${label} periode ${range.start} s/d ${range.end}` +
    (intent.category ? ` (kategori: ${intent.category})` : "") +
    `\nTotal ${label.toLowerCase()}: ${rupiah(total)} dari ${rows.length} transaksi.`;

  return {
    context: `${header}\nRincian (maks 10 baris):\n${lines.join("\n")}`,
    rowCount: rows.length,
  };
}

// ── budgets ──────────────────────────────────────────────────────────
async function fetchBudgets(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("budgets")
    .select("category, label, limit, spent, enabled")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const lines = rows.map((b: Record<string, unknown>) => {
    const limit = Number(b.limit);
    const spent = Number(b.spent);
    const sisa = limit - spent;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return `- ${b.label} (${b.category}): terpakai ${rupiah(spent)} dari ${rupiah(limit)} (${pct}%), sisa ${rupiah(sisa)}`;
  });
  return { context: `Anggaran aktif:\n${lines.join("\n")}`, rowCount: rows.length };
}

// ── savings ──────────────────────────────────────────────────────────
async function fetchSavings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("savings")
    .select("name, target, current, deadline")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const lines = rows.map((s: Record<string, unknown>) => {
    const target = Number(s.target);
    const current = Number(s.current);
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;
    const dl = s.deadline ? `, target tanggal ${s.deadline}` : "";
    return `- ${s.name}: terkumpul ${rupiah(current)} dari ${rupiah(target)} (${pct}%)${dl}`;
  });
  return { context: `Tabungan:\n${lines.join("\n")}`, rowCount: rows.length };
}

// ── investments (wallets type='investment') ──────────────────────────
async function fetchInvestments(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("wallets")
    .select("name, bank, balance, type")
    .eq("user_id", userId)
    .eq("type", "investment");
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const total = rows.reduce((s: number, w: Record<string, unknown>) => s + Number(w.balance), 0);
  const lines = rows.map((w: Record<string, unknown>) =>
    `- ${w.name}${w.bank ? ` (${w.bank})` : ""}: ${rupiah(Number(w.balance))}`
  );
  return {
    context: `Aset investasi (total ${rupiah(total)}):\n${lines.join("\n")}`,
    rowCount: rows.length,
  };
}

// ── general summary (income vs expense periode) ──────────────────────
async function fetchSummary(
  supabase: SupabaseClient,
  intent: ParsedIntent,
  userId: string,
) {
  const range = computeDateRange(intent);
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end)
    .limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  let income = 0, expense = 0;
  for (const r of rows as { type: string; amount: number }[]) {
    if (r.type === "income") income += Number(r.amount);
    else expense += Number(r.amount);
  }
  const net = income - expense;
  // Rasio pengeluaran terhadap pendapatan (persen). Hanya bermakna bila ada
  // pemasukan; disertakan supaya model bisa menjawab pertanyaan perbandingan
  // "berapa persen pendapatan terpakai" dengan angka yang tepat.
  const ratioLine = income > 0
    ? `\n- Rasio pengeluaran terhadap pendapatan: ${Math.round((expense / income) * 100)}%`
    : "";

  return {
    context:
      `Ringkasan keuangan ${range.start} s/d ${range.end}:\n` +
      `- Total pemasukan: ${rupiah(income)}\n` +
      `- Total pengeluaran: ${rupiah(expense)}\n` +
      `- Selisih (net): ${rupiah(net)}${ratioLine}\n` +
      `- Jumlah transaksi: ${rows.length}`,
    rowCount: rows.length,
  };
}
