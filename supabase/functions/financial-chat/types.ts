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
//   - "debt"       → dibaca dari tabel `debts` (piutang/hutang)
export type IntentType =
  | "expense"
  | "income"
  | "investment"
  | "budget"
  | "savings"
  | "debt"
  | "general"
  | "out_of_scope";

export type IntentPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year";

// ── Dompet user (untuk deteksi wallet by nama & cegah tabrakan dgn metode) ──
// Nama wallet dinamis per-user (bukan keyword statis kayak kategori), jadi
// harus di-fetch dari Supabase dulu lalu dioper ke parseIntent().
export interface WalletRef {
  id: string;
  name: string;
}

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
  // Dompet spesifik bila disebut by nama ("di dompet BNI") — dicocokkan thd
  // daftar wallet user. Dideteksi SEBELUM metode (lihat catatan di metode).
  walletId?: string;
  walletName?: string;
  // true bila user MENYEBUT nama dompet dalam kalimat tapi tidak cocok dgn
  // wallet manapun milik user (beda dgn "user tidak sebut dompet sama
  // sekali", yang membiarkan walletId/walletName & field ini undefined).
  // fetchFinancialData() di query-builder.ts WAJIB jawab jujur "tidak
  // ditemukan" saat ini true, BUKAN diam-diam fallback ke data agregat.
  walletNotFound?: boolean;
  // Nama dompet mentah (apa adanya dari kalimat user) saat walletNotFound
  // true — dipakai utk menyusun pesan "dompet '<ini>' tidak ditemukan".
  walletMentionRaw?: string;
  // Metode pembayaran ("tunai"/"cash" → Tunai; "transfer"/"tf" → Transfer).
  // Dideteksi SETELAH wallet: kalau kata metode persis sama dgn nama salah
  // satu wallet user, itu diperlakukan sbg wallet match, bukan metode match
  // (lihat detectMetode() di intent-parser.ts).
  metode?: "Tunai" | "Transfer";
  // Hanya transaksi hasil eksekusi recurring yang SUDAH tercatat (note
  // berprefix "[Otomatis] "). BUKAN akses ke jadwal/konfigurasi recurring —
  // itu ada di localStorage client, di luar jangkauan edge function ini.
  onlyAutomatic?: boolean;
  // ── Hutang/Piutang (dipakai saat type === "debt", baca tabel `debts`) ──
  // Arah utang: 'receivable' = PIUTANG (uang orang lain ke user),
  //             'payable'    = HUTANG (uang user ke orang lain).
  // LAWAN ARAH, bukan sinonim — jangan digabung jadi satu keyword list.
  // null = user tidak menyebut arah → fetchDebts ambil kedua arah.
  debtDirection?: "receivable" | "payable" | null;
  // Status catatan: 'active' (belum lunas) atau 'paid' (lunas). null = user
  // tidak menyebut status → fetchDebts default ke 'active' saja.
  debtStatus?: "active" | "paid" | null;
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
