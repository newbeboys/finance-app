// ════════════════════════════════════════════════════════════════════
//  intent-parser.ts — Ubah pertanyaan natural language → ParsedIntent
//
//  Ini parser berbasis aturan (rule-based), BUKAN LLM. Alasannya: murah,
//  instan, deterministik, dan cukup untuk pola pertanyaan umum. Kalau nanti
//  butuh pemahaman lebih dalam, Level 3 answering model tetap menerima data
//  mentah + pertanyaan asli, jadi salah-parse ringan masih bisa "diselamatkan"
//  oleh model saat menyusun jawaban.
// ════════════════════════════════════════════════════════════════════

import type { IntentPeriod, IntentType, ParsedIntent, WalletRef } from "./types.ts";

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

// Kata kunci metode pembayaran → nilai kolom `transactions.method`.
const METODE_KEYWORDS: Record<string, "Tunai" | "Transfer"> = {
  tunai: "Tunai",
  cash: "Tunai",
  transfer: "Transfer",
  tf: "Transfer",
};

export function parseIntent(question: string, wallets: WalletRef[] = []): ParsedIntent {
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

  // ── Hutang / Piutang (debt) ─────────────────────────────────────
  // Arah & status hanya relevan bila type sudah terdeteksi "debt".
  if (intent.type === "debt") {
    const direction = detectDebtDirection(q);
    // "both" → JANGAN diisi ke intent.debtDirection. undefined/null di sana
    // sudah berarti "tidak difilter, ambil kedua arah" bagi fetchDebts() —
    // itu persis yang kita mau saat user menyebut piutang & hutang sekaligus.
    if (direction === "receivable" || direction === "payable") {
      intent.debtDirection = direction;
    }
    // Status: hanya set "paid" bila user eksplisit menyebut lunas/sudah
    // dibayar. Kalau tidak, biarkan undefined → fetchDebts() default 'active'.
    //
    // BUG YANG PERNAH TERJADI: \blunas\b cocok ke kata "lunas" berdiri
    // sendiri TANPA peduli apa yang mendahuluinya — jadi "belum lunas" (yang
    // artinya JUSTRU belum/aktif) ikut ke-match dan status ke-flip jadi
    // "paid", padahal maksud user kebalikannya. Fix: cek dulu pola negasi
    // ("belum lunas/dibayar/terbayar") SEBELUM cek pola lunas biasa, dan
    // kalau negasi ketemu, JANGAN set "paid" (biarkan default 'active').
    if (/\bbelum\s+(lunas|dibayar|terbayar|di\s*bayar)\b/.test(q)) {
      intent.debtStatus = "active";
    } else if (/\blunas\b|sudah (di)?bayar|sudah terbayar|telah dibayar|udah lunas|udah dibayar/.test(q)) {
      intent.debtStatus = "paid";
    }
  }

  // ── Dompet (wallet) ── HARUS jalan SEBELUM metode, supaya kata yang
  // persis sama dgn nama wallet user (mis. wallet bernama "Tunai") tidak
  // ikut ke-klaim oleh detectMetode().
  const wallet = detectWallet(q, wallets);
  if (wallet) {
    intent.walletId = wallet.id;
    intent.walletName = wallet.name;
  } else {
    // BUG YANG PERNAH TERJADI: kalau user MENYEBUT nama dompet ("di dompet
    // BRI ku") tapi nama itu tidak cocok dgn wallet manapun milik user,
    // kode di atas cuma diam (walletId tetap undefined) — TIDAK ada beda
    // dgn kasus "user tidak sebut dompet sama sekali". Akibatnya query di
    // query-builder.ts jalan TANPA filter wallet (fail-open ke agregat
    // semua dompet), tapi jawaban tetap dibungkus seolah itu angka spesifik
    // utk dompet yang disebut user — padahal dompet itu tidak ada.
    // Fix: bedakan dua state ini secara eksplisit. Kalau ada kandidat nama
    // dompet yang disebut (lihat detectWalletMention) tapi tak match apapun,
    // set walletNotFound + simpan nama mentahnya, supaya fetchFinancialData
    // bisa jujur bilang "tidak ditemukan" alih-alih diam-diam agregat.
    // Pakai `question` (casing asli), BUKAN `q` yang sudah di-lowercase,
    // supaya pesan "dompet '<X>' tidak ditemukan" menampilkan nama persis
    // seperti yang diketik user (mis. "BRI", bukan "bri").
    const mention = detectWalletMention(question);
    if (mention) {
      intent.walletNotFound = true;
      intent.walletMentionRaw = mention;
    }
  }

  // ── Metode pembayaran ── dijalankan SETELAH wallet, lihat detectMetode().
  const metode = detectMetode(q, wallets);
  if (metode) intent.metode = metode;

  // ── Transaksi otomatis (recurring yang SUDAH tereksekusi & tercatat) ──
  // CATATAN: ini TIDAK mendeteksi pertanyaan soal JADWAL recurring
  // ("kapan jalan lagi", "jadwal aku apa aja") — itu sengaja dibiarkan lolos
  // ke Level 3 answering model, yang diinstruksikan lewat system prompt utk
  // jujur bilang tidak bisa akses jadwal (lihat ANSWER_SYSTEM_PROMPT di
  // groq-client.ts). DATA yang terambil di sini (transaksi [Otomatis] masa
  // lalu) tetap terlampir sbg konteks, tapi model diminta tidak menebak
  // jadwal darinya.
  if (/transaksi otomatis|transaksi berulang|\brecurring\b/.test(q)) {
    intent.onlyAutomatic = true;
  }

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

  // Hutang/piutang dicek SEBELUM expense: kalimat debt sering mengandung kata
  // "bayar"/"dibayar" (mis. "hutang yang sudah dibayar") yang juga cocok dgn
  // regex expense di bawah. Kalau expense menang duluan, intent jadi salah.
  if (detectDebtDirection(q) !== null) return "debt";

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

// ── Deteksi arah hutang/piutang ──────────────────────────────────────
// PENTING: piutang & hutang adalah LAWAN ARAH, bukan sinonim.
//   - "piutang"        → receivable (uang orang lain ke user)
//   - "hutang"/"utang" → payable    (uang user ke orang lain)
// Word boundary HANYA di awal kata (tanpa \b di akhir): bahasa Indonesia
// menempelkan sufiks posesif langsung ke kata benda ("piutangKU",
// "hutangMU", "utangNYA"), jadi \bpiutang\b akan gagal match "piutangku".
// "piutang" DICEK DULU karena mengandung substring "utang" — walau
// \butang tidak match di tengah "piutang" (huruf sebelum 'u' adalah 'i',
// bukan batas kata), urutan ini tetap dijaga sebagai pengaman eksplisit.
//
// BUG YANG PERNAH TERJADI: kalimat yang menyebut KEDUA arah sekaligus (mis.
// "piutang dan hutangku masing-masing berapa", "bandingkan piutang dan
// hutangku") dulu langsung `return "receivable"` begitu "piutang" ketemu,
// TANPA pernah mengecek "hutang" di kalimat yang sama — jadi fetchDebts()
// cuma ambil arah piutang, dan model menjawab hutang "tidak ada data"
// padahal datanya ada, cuma tidak pernah di-fetch. Fix: kalau KEDUA kata
// muncul, return "both" (BUKAN salah satu) supaya fetchDebts() TIDAK
// memfilter `type` sama sekali → kedua arah ikut ke-fetch, lalu tetap
// disajikan terpisah per section (lihat fetchDebts()) — TIDAK dijumlah
// jadi satu angka karena keduanya lawan arah.
function detectDebtDirection(q: string): "receivable" | "payable" | "both" | null {
  const hasPiutang = /\bpiutang/.test(q);
  const hasHutang = /\bhutang|\butang/.test(q);
  if (hasPiutang && hasHutang) return "both";
  if (hasPiutang) return "receivable";
  if (hasHutang) return "payable";
  return null;
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Deteksi dompet by nama ────────────────────────────────────────────
// Beda dgn detectCategory: nama wallet dinamis per-user (bukan keyword
// tetap), jadi daftarnya harus dioper dari luar (sudah di-fetch di index.ts
// sebelum parseIntent dipanggil). Diurutkan dari nama terpanjang dulu supaya
// nama yang lebih spesifik ("BNI Syariah") menang dari substring-nya
// ("BNI") kalau keduanya ada di daftar wallet user.
function detectWallet(q: string, wallets: WalletRef[]): WalletRef | undefined {
  const sorted = [...wallets].sort((a, b) => b.name.length - a.name.length);
  for (const w of sorted) {
    const name = w.name.trim();
    if (!name) continue;
    const re = new RegExp(`\\b${escapeRegex(name.toLowerCase())}\\b`, "i");
    if (re.test(q)) return w;
  }
  return undefined;
}

// Kata yang ikut tertangkap tepat sesudah "dompet <kandidat>" tapi BUKAN
// bagian dari nama dompetnya sendiri (sufiks posesif / kata tanya umum /
// partikel umum dalam bahasa Indonesia) — dibuang dari kandidat sebelum
// dibandingkan/ditampilkan.
const WALLET_MENTION_STOPWORDS = new Set([
  "ku", "nya", "mu", "saya", "aku", "yang", "ada", "berapa", "gimana",
  "itu", "ini", "kah",
  // Partikel bahasa Indonesia yang sering nempel di akhir frasa: "apa saja",
  // "mana saja", "siapa saja", dll → partikel ini bukan bagian nama dompet.
  "saja", "aja", "sih", "lah", "yuk", "ya", "gak", "nggak", "dong", "deh",
]);

// Kata tanya umum yang TIDAK boleh dianggap sbg nama dompet spesifik walau
// muncul persis sesudah "dompet " (mis. "dompet apa yang paling boros" itu
// pertanyaan UMUM, bukan menyebut nama dompet tertentu).
const WALLET_MENTION_QUESTION_WORDS = new Set([
  "apa", "mana", "siapa", "kapan", "kenapa",
]);

// Pola pertanyaan umum yang seharusnya TIDAK dideteksi sebagai wallet mention
// — ini FIXED phrases (bukan kombinasi kata) yang sering diajukan tapi BUKAN
// nama dompet spesifik. Pola ini di-check SEBELUM generic question-word check
// supaya catch "apa saja"/"apa aja" dan variasi lainnya dengan ROBUST.
const WALLET_MENTION_EXCLUDED_PHRASES = new Set([
  "apa saja",
  "apa aja",
  "apa yang",
  "mana saja",
  "mana aja",
  "siapa saja",
  "siapa aja",
]);

// Dipakai HANYA saat detectWallet() di atas gagal cocok ke wallet manapun —
// buat membedakan "user tidak sebut dompet sama sekali" (tetap agregat
// seperti biasa) vs "user sebut nama dompet tapi salah/tidak ada" (harus
// jujur bilang tidak ketemu, lihat walletNotFound di parseIntent() &
// fetchFinancialData() di query-builder.ts). Heuristik: tangkap 1-2 kata
// sesudah literal "dompet ", buang stopword posesif/kata tanya, sisanya
// (kalau ada & bukan kata tanya umum) dianggap kandidat nama dompet.
//
// BUG YANG PERNAH TERJADI: pola sebelumnya pakai `\bdompet\s+` — \b di situ
// mensyaratkan BATAS KATA persis sebelum "dompet". Itu gagal total utk
// tulisan sehari-hari "didompet" (nempel tanpa spasi, mis. "piutang
// didompet BCA ku"): huruf sebelum "dompet" di situ adalah 'i' (bagian dari
// "di"), jadi TIDAK ada batas kata di sana, regex tidak pernah cocok, dan
// deteksi wallet-mention gagal SENYAP (bukan cuma gagal cocok nama-nya) —
// balik lagi ke fallback agregat yang seharusnya sudah diperbaiki. Fix:
// buang `\b` di depan "dompet" supaya "dompet" tetap kecocok walau nempel
// dgn kata sebelumnya ("di", "d", dll) — yang penting SESUDAHNYA ada spasi
// lalu kandidat nama.
//
// BUG TERBARU: pertanyaan "apa saja" / "apa aja" / "mana saja" seharusnya
// dikenali sebagai pertanyaan umum (tidak specific wallet mention) TERLEPAS
// ada/tidaknya kata "ada" di depan ("ada didompet apa saja?" vs "didompet apa saja").
// Fix: check excluded phrases TERLEBIH DULU sebelum generic question-word filtering
// untuk robustness & clarity.
function detectWalletMention(q: string): string | undefined {
  const m = q.match(/dompet\s+([^\s?.,!]+(?:\s+[^\s?.,!]+)?)/i);
  if (!m) return undefined;

  // Check excluded phrases dulu — FIXED patterns yang pasti bukan wallet mention
  const captured = m[1].toLowerCase();
  if (WALLET_MENTION_EXCLUDED_PHRASES.has(captured)) {
    return undefined;
  }

  const words = m[1]
    .split(/\s+/)
    .filter((w) => !WALLET_MENTION_STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return undefined;
  // Kalau SEMUA kata yang tersisa adalah kata tanya (misalnya, setelah filter
  // "saja"/"aja" dari "apa saja"/"apa aja" kita tetap dapat "apa", atau dari
  // "mana saja" dapat "mana"), itu pertanyaan umum, bukan nama dompet spesifik.
  // BUG YANG PERNAH TERJADI: cek ini dulu hanya jalan saat words.length === 1,
  // jadi multi-word patterns seperti "apa saja" (tetap ["apa", "saja"] jika
  // "saja" tidak di-filter) lolos jadi "nama dompet" palsu. Fix: cek dulu
  // apakah SETIAP kata dalam words ada di QUESTION_WORDS; kalau ya semua,
  // return undefined (pertanyaan umum, bukan nama dompet).
  if (words.every((w) => WALLET_MENTION_QUESTION_WORDS.has(w.toLowerCase()))) {
    return undefined;
  }
  return words.join(" ");
}

// ── Deteksi metode pembayaran ────────────────────────────────────────
// Kalau kata metode yang match ("tunai") PERSIS sama dgn nama salah satu
// wallet user (mis. user punya dompet bernama "Tunai"), kita SKIP metode
// match ini — sudah diklaim sbg wallet match oleh detectWallet() di atas
// (yang jalan lebih dulu). Kasus ini di-log via console.warn supaya
// ambiguitasnya kelihatan di log Edge Function.
function detectMetode(q: string, wallets: WalletRef[]): "Tunai" | "Transfer" | undefined {
  for (const [kw, metode] of Object.entries(METODE_KEYWORDS)) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (!re.test(q)) continue;

    const collidesWithWallet = wallets.some(
      (w) => w.name.trim().toLowerCase() === kw,
    );
    if (collidesWithWallet) {
      console.warn(
        `[intent-parser] Ambiguitas metode/wallet: kata "${kw}" persis sama dgn nama ` +
        `wallet user, diprioritaskan sbg wallet match (bukan metode pembayaran).`,
      );
      continue;
    }
    return metode;
  }
  return undefined;
}
