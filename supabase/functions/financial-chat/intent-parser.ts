// ════════════════════════════════════════════════════════════════════
//  intent-parser.ts — Ubah pertanyaan natural language → ParsedIntent
//
//  Ini parser berbasis aturan (rule-based), BUKAN LLM. Alasannya: murah,
//  instan, deterministik, dan cukup untuk pola pertanyaan umum. Kalau nanti
//  butuh pemahaman lebih dalam, Level 3 answering model tetap menerima data
//  mentah + pertanyaan asli, jadi salah-parse ringan masih bisa "diselamatkan"
//  oleh model saat menyusun jawaban.
// ════════════════════════════════════════════════════════════════════

import type { IntentPeriod, IntentType, ParsedIntent } from "./types.ts";

// Nama bulan Indonesia + Inggris → angka 1-12.
const MONTHS: Record<string, number> = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, december: 12, dec: 12,
};

// Kata kunci kategori → kode kategori internal (samakan dgn yang dipakai app).
// Kategori kustom user tidak ada di sini; itu ditangani belakangan oleh
// pencocokan longgar di query-builder / answering model.
const CATEGORY_KEYWORDS: Record<string, string> = {
  makan: "food", makanan: "food", kuliner: "food", jajan: "food", food: "food",
  transport: "transport", transportasi: "transport", bensin: "transport",
  ojek: "transport", grab: "transport", gojek: "transport", bbm: "transport",
  belanja: "shopping", shopping: "shopping", baju: "shopping",
  tagihan: "bills", listrik: "bills", air: "bills", internet: "bills",
  pulsa: "bills", bills: "bills",
  hiburan: "entertainment", nonton: "entertainment", game: "entertainment",
  entertainment: "entertainment",
  kesehatan: "health", dokter: "health", obat: "health", health: "health",
  pendidikan: "education", sekolah: "education", kuliah: "education",
  gaji: "salary", salary: "salary", pendapatan: "salary",
};

export function parseIntent(question: string): ParsedIntent {
  const q = question.toLowerCase().trim();

  const intent: ParsedIntent = { type: detectType(q) };

  // Kalau tipe sudah out_of_scope, tidak perlu parse detail lagi.
  if (intent.type === "out_of_scope") return intent;

  // ── Periode relatif ─────────────────────────────────────────────
  const period = detectPeriod(q);
  if (period) intent.period = period;

  // ── Bulan eksplisit ("di Juli", "bulan maret") ──────────────────
  const month = detectMonth(q);
  if (month) intent.month = month;

  // ── Tahun eksplisit (2020-2099) ─────────────────────────────────
  const yearMatch = q.match(/\b(20\d{2})\b/);
  if (yearMatch) intent.year = parseInt(yearMatch[1], 10);

  // ── Kategori ────────────────────────────────────────────────────
  const category = detectCategory(q);
  if (category) intent.category = category;

  // ── Urutan (terbesar/terkecil) ──────────────────────────────────
  if (/terbesar|termahal|paling (besar|mahal|banyak)|tertinggi|largest|biggest|most expensive/.test(q)) {
    intent.order = "desc";
  } else if (/terkecil|termurah|paling (kecil|murah|sedikit)|terendah|smallest|cheapest/.test(q)) {
    intent.order = "asc";
  }

  // ── Minta total/agregat? ("berapa total", "jumlah", "berapa banyak") ─
  if (/berapa total|total (pengeluaran|pemasukan|income|expense)|jumlah|berapa (banyak|besar)|total\b|sum/.test(q)) {
    intent.wantsTotal = true;
  }

  // ── Limit default untuk pertanyaan "daftar/terbesar" ────────────
  const limitMatch = q.match(/\b(\d{1,2})\s*(transaksi|item|teratas|terbesar|top)/);
  if (limitMatch) {
    intent.limit = Math.min(parseInt(limitMatch[1], 10), 20);
  } else if (intent.order && !intent.wantsTotal) {
    intent.limit = 5; // "pengeluaran terbesar" → default top 5
  }

  return intent;
}

// Deteksi pertanyaan PERBANDINGAN pemasukan-vs-pengeluaran atau rasio
// "pendapatan terpakai". Kalimat begini butuh DUA angka sekaligus (income &
// expense untuk periode sama), jadi TIDAK boleh diperlakukan sebagai single
// type. Contoh yang harus kena:
//   - "rincikan pemasukan vs pengeluaranku"
//   - "bandingkan pemasukan dan pengeluaran"
//   - "434% pendapatanku terpakai bulan ini"
//   - "berapa persen pendapatanku habis"
function isIncomeExpenseComparison(q: string): boolean {
  const hasIncome = /(pemasukan|pendapatan|penghasilan|income|uang masuk)/.test(q);
  const hasExpense = /(pengeluaran|pengeluaranku|belanja|uang keluar|expense|spending|habis|terpakai|terserap)/.test(q);

  // Menyebut kedua sisi sekaligus (pemasukan ... pengeluaran) dalam kalimat.
  if (hasIncome && hasExpense) return true;

  // Rasio/persentase pendapatan yang terpakai (menyebut income + sinyal rasio).
  if (hasIncome && /(terpakai|terserap|habis|persen|%|rasio|ratio)/.test(q)) return true;

  // Kata banding eksplisit + salah satu sisi.
  if (/\bvs\b|versus|bandingkan|banding|perbandingan/.test(q) && (hasIncome || hasExpense)) {
    return true;
  }

  return false;
}

// ── Deteksi tipe transaksi/data ──────────────────────────────────────
function detectType(q: string): IntentType {
  // Perbandingan income-vs-expense / rasio pendapatan → "general"
  // supaya query-builder mengambil KEDUA angka (lihat fetchSummary).
  if (isIncomeExpenseComparison(q)) return "general";

  if (/anggaran|budget|batas (pengeluaran|belanja)/.test(q)) return "budget";
  if (/tabungan|nabung|saving|celengan|target tabungan/.test(q)) return "savings";
  if (/investasi|invest|saham|reksadana|reksa dana|crypto ku|portofolio/.test(q)) {
    return "investment";
  }
  if (/pemasukan|pendapatan|penghasilan|income|gaji|masuk\b|terima uang/.test(q)) {
    return "income";
  }
  if (/pengeluaran|pengeluaranku|belanja|keluar|habis|spending|expense|beli|bayar/.test(q)) {
    return "expense";
  }
  // Pertanyaan umum keuangan ("gimana keuanganku", "ringkasan bulan ini")
  if (/keuangan|ringkasan|summary|rekap|kondisi finansial|saldo/.test(q)) {
    return "general";
  }
  // Default: anggap tanya pengeluaran (kasus paling umum).
  return "expense";
}

// ── Deteksi periode relatif ──────────────────────────────────────────
function detectPeriod(q: string): IntentPeriod | undefined {
  if (/\bhari ini\b|\btoday\b/.test(q)) return "today";
  if (/\bkemarin\b|\byesterday\b/.test(q)) return "yesterday";
  if (/\bminggu ini\b|\bpekan ini\b|\bthis week\b/.test(q)) return "this_week";
  if (/\bbulan lalu\b|\bbulan kemarin\b|\blast month\b/.test(q)) return "last_month";
  if (/\bbulan ini\b|\bthis month\b/.test(q)) return "this_month";
  if (/\btahun ini\b|\bthis year\b/.test(q)) return "this_year";
  return undefined;
}

// ── Deteksi bulan by nama ────────────────────────────────────────────
function detectMonth(q: string): number | undefined {
  // Cari token bulan yang berdiri sendiri.
  for (const [name, num] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(q)) return num;
  }
  return undefined;
}

// ── Deteksi kategori ─────────────────────────────────────────────────
function detectCategory(q: string): string | undefined {
  for (const [kw, code] of Object.entries(CATEGORY_KEYWORDS)) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(q)) return code;
  }
  return undefined;
}
