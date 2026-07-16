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
  // BUG YANG PERNAH TERJADI: kalau user menyebut nama dompet yang TIDAK ada
  // (mis. "dompet BRI" padahal user cuma punya BCA/BNI), setiap fetcher di
  // bawah cuma skip filter `.eq("wallet_id", ...)` karena walletId memang
  // undefined — hasilnya query jalan TANPA filter (agregat semua dompet),
  // tapi jawaban dibungkus model seolah itu angka spesifik dompet yang
  // disebut user. Short-circuit di sini SEBELUM dispatch ke fetcher manapun,
  // supaya kasus ini tidak pernah sampai ke query agregat sama sekali.
  if (intent.walletNotFound) {
    const { data: walletRows } = await supabase
      .from("wallets")
      .select("name")
      .eq("user_id", userId);
    const names = (walletRows ?? []).map((w) => w.name as string).filter(Boolean);
    const namesLine = names.length > 0
      ? `Dompet yang terdaftar di akun ini: ${names.join(", ")}.`
      : "Akun ini belum punya dompet manapun.";
    return {
      context:
        `Dompet "${intent.walletMentionRaw}" TIDAK DITEMUKAN di akun ini — ` +
        `JANGAN jawab pakai data agregat semua dompet, JANGAN mengarang ` +
        `seolah dompet itu ada. ${namesLine} Beri tahu user dompet yang ` +
        `disebut tidak ditemukan, dan sebutkan daftar dompet asli di atas.`,
      rowCount: 0,
    };
  }

  // Kalau user bertanya tentang daftar dompet ("apa nama dompet yang aku punya",
  // "mana saja dompetku", dll) → short-circuit & return wallet list langsung.
  // Ini bukan query spesifik (expense/budget/debt/etc), jadi tidak perlu fetch
  // data transaksi. Prioritas SETELAH walletNotFound: kalau nama dompet tidak
  // cocok, user definitely asking about specific wallet, bukan general list.
  if (intent.wantWalletList) {
    const { data: walletRows } = await supabase
      .from("wallets")
      .select("name")
      .eq("user_id", userId);
    const names = (walletRows ?? []).map((w) => w.name as string).filter(Boolean);
    if (names.length === 0) {
      return {
        context: `Akun ini belum punya dompet manapun.`,
        rowCount: 0,
      };
    }
    return {
      context: `Daftar dompet yang terdaftar di akun ini: ${names.join(", ")}.`,
      rowCount: names.length,
    };
  }

  switch (intent.type) {
    case "budget":
      return fetchBudgets(supabase, userId);
    case "savings":
      return fetchSavings(supabase, userId);
    case "investment":
      return fetchInvestments(supabase, userId);
    case "debt":
      return fetchDebts(supabase, intent, userId);
    case "expense":
    case "income":
      return fetchTransactions(supabase, intent, userId, intent.type);
    case "general":
    default:
      return fetchSummary(supabase, intent, userId);
  }
}

// UUID mentah (36 karakter, format standar UUID) yang gak ketemu di categoryMap
// berarti kategori custom sudah tidak ada lagi datanya (orphan/terhapus manual).
// Tampilkan label netral, bukan UUID mentah yang gak berguna buat user.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── helper: resolve custom category names ───────────────────────────
async function resolveCategoryNames(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Kolom custom_categories.id bertipe uuid di Postgres. Kode kategori
  // bawaan (food, transport, salary, dll) BUKAN uuid — kalau ikut dikirim
  // ke .in("id", ...), seluruh query gagal (error 22P02 invalid input
  // syntax for type uuid), bukan cuma di-skip. Mereka tetap lolos apa
  // adanya lewat fallback terakhir di displayCategory().
  const uuidsOnly = categoryIds.filter((id) => UUID_PATTERN.test(id));
  if (uuidsOnly.length === 0) return map;

  const { data, error } = await supabase
    .from("custom_categories")
    .select("id, name")
    .eq("user_id", userId)
    .in("id", uuidsOnly);

  if (error) {
    console.error(
      `[query-builder] gagal resolve custom_categories (userId=${userId}, ` +
      `categoryIds=${uuidsOnly.length}):`,
      error,
    );
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

function displayCategory(rawCategory: string, categoryMap: Map<string, string>): string {
  const resolved = categoryMap.get(rawCategory);
  if (resolved) return resolved;
  if (UUID_PATTERN.test(rawCategory)) return "Kategori (tidak dikenal)";
  return rawCategory; // kode kategori bawaan (food, transport, dll) — biarkan apa adanya
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
  if (intent.walletId) query = query.eq("wallet_id", intent.walletId);
  if (intent.metode) query = query.eq("method", intent.metode);
  if (intent.onlyAutomatic) query = query.ilike("note", "[Otomatis]%");

  // Urutan & limit: kalau minta total, ambil banyak lalu agregasi.
  const limit = intent.wantsTotal ? 500 : (intent.limit ?? 50);
  if (intent.order) {
    const wantsBiggest = intent.order === "desc";
    // Expense disimpan negatif: "terbesar" secara magnitude = angka paling
    // negatif = ascending TRUE. Income disimpan positif: "terbesar" = angka
    // paling besar = ascending FALSE. Kebalikan untuk "terkecil".
    const ascending = type === "expense" ? wantsBiggest : !wantsBiggest;
    query = query.order("amount", { ascending });
  } else {
    query = query.order("date", { ascending: false });
  }
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as TransactionRow[];
  if (rows.length === 0) return null;

  // Resolve custom category names
  const categoryIds = Array.from(new Set(rows.map((r) => r.category as string)));
  const categoryMap = await resolveCategoryNames(supabase, userId, categoryIds);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const label = type === "expense" ? "Pengeluaran" : "Pemasukan";

  const lines = rows.slice(0, intent.wantsTotal ? 10 : rows.length).map((r) => {
    const resolvedCategory = displayCategory(r.category as string, categoryMap);
    const desc = r.merchant || r.note || resolvedCategory;
    return `- ${r.date} | ${resolvedCategory} | ${rupiah(Number(r.amount))} | ${desc}`;
  });

  const header =
    `${label} periode ${range.start} s/d ${range.end}` +
    (intent.category ? ` (kategori: ${intent.category})` : "") +
    (intent.walletName ? ` (dompet: ${intent.walletName})` : "") +
    (intent.metode ? ` (metode: ${intent.metode})` : "") +
    (intent.onlyAutomatic ? ` (khusus transaksi otomatis)` : "") +
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

  // Resolve custom category names
  const categoryIds = Array.from(
    new Set(rows.map((b: Record<string, unknown>) => b.category as string))
  );
  const categoryMap = await resolveCategoryNames(supabase, userId, categoryIds);

  const lines = rows.map((b: Record<string, unknown>) => {
    const limit = Number(b.limit);
    const spent = Number(b.spent);
    const sisa = limit - spent;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const resolvedCategory = displayCategory(b.category as string, categoryMap);
    return `- ${b.label} (${resolvedCategory}): terpakai ${rupiah(spent)} dari ${rupiah(limit)} (${pct}%), sisa ${rupiah(sisa)}`;
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

// ── debts (hutang / piutang) ─────────────────────────────────────────
// Baca tabel `debts`. amount SELALU positif; arah uang ditentukan kolom
// `type` ('receivable' = piutang, 'payable' = hutang), BUKAN tanda minus.
// PENTING: piutang & hutang TIDAK boleh dijumlahkan jadi satu angka — mereka
// lawan arah. Breakdown dipisah per arah + per person_name.
interface DebtRow {
  type: "receivable" | "payable";
  person_name: string;
  amount: number;
  paid: number;
  status: string;
  date: string;
  due_date: string | null;
}

function debtDirLabel(t: "receivable" | "payable"): string {
  return t === "receivable" ? "Piutang" : "Hutang";
}

async function fetchDebts(
  supabase: SupabaseClient,
  intent: ParsedIntent,
  userId: string,
) {
  // Status efektif: kalau user tidak menyebut status, default HANYA 'active'
  // (catatan yang sudah lunas biasanya tak relevan kecuali diminta eksplisit).
  const statusFilter = intent.debtStatus ?? "active";

  let query = supabase
    .from("debts")
    .select("type, person_name, amount, paid, status, date, due_date")
    .eq("user_id", userId)
    .eq("is_deleted", false) // WAJIB: soft-deleted tidak boleh ikut terhitung.
    .eq("status", statusFilter);

  // Arah (piutang/hutang) hanya difilter kalau user menyebutnya.
  if (intent.debtDirection) query = query.eq("type", intent.debtDirection);
  // Filter dompet — INI yang membuat "dompet Mess" vs "dompet BNI" beda angka.
  if (intent.walletId) query = query.eq("wallet_id", intent.walletId);

  query = query.order("amount", { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as DebtRow[];

  const statusLabel = statusFilter === "paid" ? "lunas" : "aktif";
  const walletSuffix = intent.walletName ? ` di dompet ${intent.walletName}` : "";
  const scopeLabel = intent.debtDirection
    ? debtDirLabel(intent.debtDirection)
    : "Hutang & Piutang";

  // Kasus tidak ada data: JANGAN return null diam-diam (nanti model bisa
  // menebak). Beri konteks eksplisit "nol" supaya jawabannya jujur.
  if (rows.length === 0) {
    return {
      context: `${scopeLabel} ${statusLabel}${walletSuffix}: tidak ada catatan. Total Rp0.`,
      rowCount: 0,
    };
  }

  // Pisah per arah supaya piutang & hutang tidak tercampur jadi satu angka.
  const byDir: Record<"receivable" | "payable", DebtRow[]> = {
    receivable: [],
    payable: [],
  };
  for (const r of rows) byDir[r.type].push(r);

  // Bug lama: header cuma kasih JUMLAH CATATAN tanpa nominal ("— 2 catatan."),
  // dan model kadang cuma echo baris ini tanpa turun ke section detail →
  // jawaban "2 catatan" tanpa rupiah. Fix: header WAJIB sertakan nominal
  // total per arah juga (redundan dgn section di bawah, sengaja — supaya
  // model tidak mungkin kehilangan angkanya). Arah tetap dipisah, TIDAK
  // dijumlah jadi satu angka gabungan.
  const totalsByDir = (["receivable", "payable"] as const)
    .filter((dir) => byDir[dir].length > 0)
    .map((dir) => {
      const subtotal = byDir[dir].reduce((s, r) => s + Number(r.amount), 0);
      return `${debtDirLabel(dir)} ${rupiah(subtotal)} (${byDir[dir].length} catatan)`;
    });

  const sections: string[] = [];
  for (const dir of ["receivable", "payable"] as const) {
    const list = byDir[dir];
    if (list.length === 0) continue;
    const subtotal = list.reduce((s, r) => s + Number(r.amount), 0);
    const lines = list.map((r) => {
      const sisa = Number(r.amount) - Number(r.paid);
      const due = r.due_date ? `, jatuh tempo ${r.due_date}` : "";
      return `- ${r.person_name}: ${rupiah(Number(r.amount))} ` +
        `(terbayar ${rupiah(Number(r.paid))}, sisa ${rupiah(sisa)}${due})`;
    });
    sections.push(
      `${debtDirLabel(dir)} ${statusLabel} — total ${rupiah(subtotal)} (${list.length} catatan):\n` +
      lines.join("\n"),
    );
  }

  // CATATAN: sengaja TIDAK pakai `scopeLabel` di sini — totalsByDir sudah
  // menyertakan nama arah per item ("Piutang Rp... (N catatan)"), jadi kalau
  // scopeLabel ikut ditaruh di depan hasilnya jadi dobel ("Piutang — Piutang
  // Rp...").
  const header = `Catatan ${statusLabel}${walletSuffix}: ${totalsByDir.join(", ")}.`;

  return {
    context: `${header}\n\n${sections.join("\n\n")}`,
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
  let summaryQuery = supabase
    .from("transactions")
    .select("type, amount")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end);
  if (intent.walletId) summaryQuery = summaryQuery.eq("wallet_id", intent.walletId);
  if (intent.metode) summaryQuery = summaryQuery.eq("method", intent.metode);
  if (intent.onlyAutomatic) summaryQuery = summaryQuery.ilike("note", "[Otomatis]%");
  const { data, error } = await summaryQuery.limit(2000);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;

  let income = 0, expense = 0;
  for (const r of rows as { type: string; amount: number }[]) {
    if (r.type === "income") income += Number(r.amount);
    else expense += Number(r.amount);
  }
  const net = income - expense;
  const ratioLine = income > 0
    ? `\n- Rasio pengeluaran terhadap pendapatan: ${Math.round((expense / income) * 100)}%`
    : "";

  // Jika user nanya "terbesar/terkecil", ambil transaksi konkret
  let largestItemsLine = "";
  if (intent.order) {
    const wantsBiggest = intent.order === "desc";
    const orderWord = wantsBiggest ? "terbesar" : "terkecil";

    // Ambil expense terbesar/terkecil. Expense disimpan negatif: "terbesar"
    // secara magnitude = angka paling negatif = ascending TRUE. Income
    // disimpan positif: "terbesar" = angka paling besar = ascending FALSE.
    // Kebalikan untuk "terkecil". (Sama seperti fix Bug A di fetchTransactions().)
    let expQuery = supabase
      .from("transactions")
      .select("category, amount, note, merchant, date")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", range.start)
      .lte("date", range.end);
    if (intent.walletId) expQuery = expQuery.eq("wallet_id", intent.walletId);
    if (intent.metode) expQuery = expQuery.eq("method", intent.metode);
    if (intent.onlyAutomatic) expQuery = expQuery.ilike("note", "[Otomatis]%");
    expQuery = expQuery.order("amount", { ascending: wantsBiggest }).limit(1);

    const { data: expData } = await expQuery;
    const expRow = (expData?.[0] as
      | { category: string; amount: number; note: string; merchant: string; date: string }
      | undefined);

    // Ambil income terbesar/terkecil
    let incQuery = supabase
      .from("transactions")
      .select("category, amount, note, merchant, date")
      .eq("user_id", userId)
      .eq("type", "income")
      .gte("date", range.start)
      .lte("date", range.end);
    if (intent.walletId) incQuery = incQuery.eq("wallet_id", intent.walletId);
    if (intent.metode) incQuery = incQuery.eq("method", intent.metode);
    if (intent.onlyAutomatic) incQuery = incQuery.ilike("note", "[Otomatis]%");
    incQuery = incQuery.order("amount", { ascending: !wantsBiggest }).limit(1);

    const { data: incData } = await incQuery;
    const incRow = (incData?.[0] as
      | { category: string; amount: number; note: string; merchant: string; date: string }
      | undefined);

    // Resolve custom category names
    const largestCategoryIds = Array.from(
      new Set(
        [expRow?.category, incRow?.category].filter((c): c is string => !!c),
      ),
    );
    const largestCategoryMap = await resolveCategoryNames(supabase, userId, largestCategoryIds);

    const lines: string[] = [];

    if (expRow) {
      const resolvedCategory = displayCategory(expRow.category, largestCategoryMap);
      const desc = expRow.merchant || expRow.note || resolvedCategory;
      lines.push(`Pengeluaran ${orderWord}: ${rupiah(Number(expRow.amount))} (${desc}, ${expRow.date})`);
    }

    if (incRow) {
      const resolvedCategory = displayCategory(incRow.category, largestCategoryMap);
      const desc = incRow.merchant || incRow.note || resolvedCategory;
      lines.push(`Pemasukan ${orderWord}: ${rupiah(Number(incRow.amount))} (${desc}, ${incRow.date})`);
    }

    if (lines.length > 0) {
      largestItemsLine = `\n- ${lines.join("\n- ")}`;
    }
  }

  const summaryFilters =
    (intent.walletName ? ` (dompet: ${intent.walletName})` : "") +
    (intent.metode ? ` (metode: ${intent.metode})` : "") +
    (intent.onlyAutomatic ? ` (khusus transaksi otomatis)` : "");

  return {
    context:
      `Ringkasan keuangan ${range.start} s/d ${range.end}${summaryFilters}:\n` +
      `- Total pemasukan: ${rupiah(income)}\n` +
      `- Total pengeluaran: ${rupiah(expense)}\n` +
      `- Selisih (net): ${rupiah(net)}${ratioLine}\n` +
      `- Jumlah transaksi: ${rows.length}${largestItemsLine}`,
    rowCount: rows.length,
  };
}
