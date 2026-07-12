// ════════════════════════════════════════════════════════════════════
//  financial-chat — Type & interface definitions
//  Semua tipe dikumpulkan di sini supaya modul lain tinggal import.
// ════════════════════════════════════════════════════════════════════

// ── Request masuk dari UI ────────────────────────────────────────────
// user_id TIDAK dipercaya dari body (bisa dipalsukan). Sumber kebenaran
// user_id adalah JWT di header Authorization → lihat index.ts. Field ini
// hanya opsional/diagnostik.
export interface ChatRequest {
  question: string;
  user_id?: string;
}

// ── Response ke UI ───────────────────────────────────────────────────
export interface ChatResponse {
  answer: string;
  // Dari level mana jawaban ini berasal (untuk debugging & monitoring).
  source: "keyword_filter" | "intent_filter" | "answer" | "error";
  tokens_used?: { input: number; output: number };
}

// ── Hasil parsing pertanyaan user jadi struktur ──────────────────────
// CATATAN: tabel `transactions` HANYA punya type 'expense' | 'income'.
//   - "investment" → dibaca dari tabel `wallets` (type='investment')
//   - "budget"     → dibaca dari tabel `budgets`
//   - "savings"    → dibaca dari tabel `savings`
export type IntentType =
  | "expense"
  | "income"
  | "investment"
  | "budget"
  | "savings"
  | "general"
  | "out_of_scope";

export type IntentPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year";

export interface ParsedIntent {
  type: IntentType;
  // Bulan/tahun spesifik bila disebut eksplisit ("di Juli", "tahun 2025").
  month?: number; // 1-12
  year?: number;
  // Kategori bila disebut ("makan", "transport", dll) — sudah dinormalisasi
  // ke kode kategori internal bila cocok, kalau tidak dibiarkan apa adanya.
  category?: string;
  // Periode relatif ("bulan ini", "kemarin", dll).
  period?: IntentPeriod;
  order?: "asc" | "desc";
  limit?: number;
  // Apakah user minta agregat total ("berapa total ...") vs daftar item.
  wantsTotal?: boolean;
}

// ── Level 1-2 guardrail ──────────────────────────────────────────────
export interface KeywordFilterResult {
  blocked: boolean;
  reason?: string;
}

export type Classification = "FINANCIAL" | "OUT_OF_SCOPE";

// ── Bentuk baris transaksi yang kita ambil dari Supabase ─────────────
export interface TransactionRow {
  category: string;
  amount: number;
  note: string | null;
  merchant: string | null;
  date: string; // YYYY-MM-DD (lokal WIB, bukan UTC)
  type: "expense" | "income";
}

// ── Rentang tanggal lokal (WIB) untuk filter query ───────────────────
export interface DateRange {
  start: string; // YYYY-MM-DD inklusif
  end: string; // YYYY-MM-DD inklusif
}

// ── Penggunaan token dari Groq ───────────────────────────────────────
export interface TokenUsage {
  input: number;
  output: number;
}
