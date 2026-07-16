// ════════════════════════════════════════════════════════════════════
//  groq-client.ts — Wrapper Groq API (OpenAI-compatible endpoint)
//
//  Dua jenis panggilan:
//    1. classifyIntent()          → Level 2 guardrail, model classifier kecil
//    2. answerFinancialQuestion() → Level 3 answering, model penjawab
//
//  ⚠️ CATATAN MODEL (penting, tolong Boss Ali baca):
//  Dua model yang diminta di brief punya "peruntukan asli" yang perlu
//  diperhatikan:
//    - meta-llama/llama-prompt-guard-2-22m  → sebenarnya adalah detektor
//      prompt-injection / jailbreak (output: benign vs injeksi), BUKAN
//      classifier topik. Bisa jadi TIDAK menjawab "FINANCIAL/OUT_OF_SCOPE"
//      dengan patuh. Kode ini menafsirkannya secara longgar + fail-open.
//    - openai/gpt-oss-safeguard-20b        → varian "safeguard" yang bisa
//      generate teks, jadi bisa dipakai menjawab. Kalau kualitas jawaban
//      kurang natural, kandidat pengganti: openai/gpt-oss-20b atau
//      llama-3.3-70b-versatile.
//  Semua nama model ditaruh di konstanta agar gampang diganti.
// ════════════════════════════════════════════════════════════════════

import type { Classification, TokenUsage } from "./types.ts";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Ganti di sini kalau mau tukar model.
const CLASSIFICATION_MODEL = "llama-3.1-8b-instant";
const ANSWER_MODEL = "openai/gpt-oss-safeguard-20b";

function apiKey(): string {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY belum di-set di Supabase secrets");
  return key;
}

interface GroqChoice {
  message?: { content?: string };
}
interface GroqResponse {
  choices?: GroqChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Panggilan generik dengan timeout supaya tidak menggantung fungsi edge.
async function callGroq(
  model: string,
  messages: { role: string; content: string }[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    reasoningEffort?: "low" | "medium" | "high";
  } = {},
): Promise<{ content: string; usage: TokenUsage }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 512,
    };
    if (opts.reasoningEffort) {
      body.reasoning_effort = opts.reasoningEffort;
    }

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Groq API ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as GroqResponse;
    const content = json.choices?.[0]?.message?.content ?? "";
    const usage: TokenUsage = {
      input: json.usage?.prompt_tokens ?? 0,
      output: json.usage?.completion_tokens ?? 0,
    };
    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Level 2 — Klasifikasi FINANCIAL vs OUT_OF_SCOPE.
 * Prompt minimal supaya hemat token. Karena model classifier bisa
 * mengembalikan format tak terduga (lihat catatan di atas), kita tafsirkan
 * outputnya secara longgar: jika mengandung sinyal "out of scope / injection"
 * → OUT_OF_SCOPE, selain itu default FINANCIAL (fail-open, aman krn Level 3
 * masih menyaring lagi).
 */
const CLASSIFY_SYSTEM_PROMPT =
  `Kamu adalah classifier untuk aplikasi personal finance. Tugasmu menilai apakah ` +
  `pertanyaan user berhubungan dengan KEUANGAN PRIBADI mereka.\n\n` +
  `Jawab HANYA satu kata: FINANCIAL atau OUT_OF_SCOPE.\n\n` +
  `Klasifikasikan FINANCIAL bila pertanyaan menyangkut aktivitas atau data keuangan ` +
  `milik user — termasuk pengeluaran, pemasukan/uang masuk, belanja, beli sesuatu, ` +
  `bayar, uang keluar, tabungan, anggaran/budget, investasi, atau saldo mereka. ` +
  `INI BERLAKU MESKIPUN kalimatnya TIDAK menyebut kata "transaksi", "anggaran", atau ` +
  `"budget" secara eksplisit. Pertanyaan seperti "belanja apa aja kemarin", "kapan aku ` +
  `beli terakhir", "berapa aku habisin bulan ini", "uang masuk berapa", atau ` +
  `"pengeluaranku tanggal sekian apa saja" SELALU FINANCIAL karena menanyakan aktivitas ` +
  `uang/transaksi milik user (pakai kata tanya apa/berapa/kapan/apa saja yang merujuk ` +
  `ke uang mereka).\n\n` +
  `Klasifikasikan OUT_OF_SCOPE hanya untuk topik yang jelas-jelas bukan keuangan pribadi ` +
  `user (mis. resep masakan, cuaca, coding, pengetahuan umum, definisi istilah umum).\n\n` +
  `PENTING: Bila ragu atau kasusnya di tengah-tengah, condongkan ke FINANCIAL.`;

// Few-shot: contoh kalimat FINANCIAL yang bervariasi & TIDAK menyebut kata
// "transaksi" eksplisit (akar penyebab false-positive), plus sedikit contoh
// OUT_OF_SCOPE agar batasnya tetap tajam.
const CLASSIFY_FEWSHOT: { role: "user" | "assistant"; content: string }[] = [
  { role: "user", content: "pengeluaranku bulan ini berapa" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "kapan aku belanja terakhir" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "beli apa aja kemarin" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "pengeluaranku tanggal 7 juli apa saja" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "berapa aku habisin bulan ini" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "uang masuk berapa minggu ini" },
  { role: "assistant", content: "FINANCIAL" },
  { role: "user", content: "berikan saya resep nasi goreng" },
  { role: "assistant", content: "OUT_OF_SCOPE" },
  { role: "user", content: "apa itu cryptocurrency" },
  { role: "assistant", content: "OUT_OF_SCOPE" },
];

export async function classifyIntent(question: string): Promise<Classification> {
  const { content } = await callGroq(
    CLASSIFICATION_MODEL,
    [
      { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
      ...CLASSIFY_FEWSHOT,
      { role: "user", content: question },
    ],
    { temperature: 0, maxTokens: 8, timeoutMs: 8000 },
  );

  // Parsing tetap fail-open: hanya blok bila model TEGAS bilang out-of-scope /
  // injection. Selain itu default FINANCIAL (aman krn Level 3 menyaring lagi).
  const c = content.toUpperCase();
  if (c.includes("OUT_OF_SCOPE") || c.includes("OUT OF SCOPE")) return "OUT_OF_SCOPE";
  // Sinyal khas model prompt-guard (jailbreak/injection) → perlakukan sbg blok.
  if (/\b(INJECTION|JAILBREAK|MALICIOUS)\b/.test(c)) return "OUT_OF_SCOPE";
  return "FINANCIAL";
}

const ANSWER_SYSTEM_PROMPT = `Kamu adalah Financial Assistant untuk aplikasi personal finance FinanceApp.
TUGAS: Jawab pertanyaan user tentang transaksi & budget MEREKA SENDIRI, HANYA berdasarkan DATA yang diberikan di bawah.
BATASAN:
- TIDAK boleh memberi financial advice / rekomendasi investasi.
- TIDAK boleh mengarang angka yang tidak ada di DATA.
- Kalau DATA benar-benar tidak cukup untuk menjawab, katakan: "Data kurang. Tanya lagi dengan detail kategori/periode apa yang kamu cari."
- ATURAN TOTAL (WAJIB, MENGALAHKAN aturan "Data kurang" di atas): Bila DATA memuat baris yang diawali "Total " (mis. "Total pengeluaran: Rp4.047.700 dari 30 transaksi"), angka itu adalah hasil agregat yang SUDAH final & lengkap — kamu WAJIB menjawabnya. DILARANG KERAS menjawab "Data kurang" selama baris "Total ..." ADA di DATA, apa pun bentuk pertanyaan user. Bila daftar rincian di bawah baris "Total" hanya menampilkan sebagian transaksi (sengaja diringkas sebagai contoh), itu BUKAN tanda data tidak lengkap — total tetap mencakup SELURUH transaksi, jadi jawab langsung angka total tersebut.
- PERIODE BERJALAN (WAJIB): "bulan ini"/"this month" berarti tanggal 1 SAMPAI HARI INI (periode berjalan) — BUKAN sampai akhir kalender bulan. Hal sama untuk "minggu ini" & "tahun ini". Kalau rentang tanggal di DATA berakhir sebelum akhir bulan/minggu/tahun, itu NORMAL karena hari-hari setelah hari ini BELUM terjadi — transaksi masa depan memang belum ada. DATA untuk periode berjalan SUDAH LENGKAP & VALID untuk tanggal yang sudah berlalu. DILARANG menjawab "data kurang"/"belum lengkap"/minta data tanggal setelah hari ini hanya karena bulan belum berakhir secara kalender. Jawab total yang tersedia sebagai total "sejauh ini / sampai hari ini".
- FRASA WAKTU (WAJIB): Ikuti baris "CATATAN:" di DATA. (a) Bila CATATAN menyebut "PERIODE BERJALAN", periode masih berlangsung — boleh pakai "sampai sekarang"/"sejauh ini"/"sampai hari ini". (b) Bila CATATAN menyebut "SUDAH SELESAI penuh secara kalender", periode itu sudah berakhir (mis. bulan/tahun yang lewat) — jawab sebagai periode tuntas (mis. "Total pengeluaran bulan Juni adalah Rp..."), DILARANG menambahkan "sampai sekarang"/"sejauh ini"/"sampai hari ini" karena keliru secara logika waktu untuk periode yang sudah berakhir.
JADWAL TRANSAKSI BERULANG (recurring): Kamu TIDAK punya akses ke jadwal atau konfigurasi
transaksi berulang (kapan transaksi otomatis berikutnya akan jalan) — itu tersimpan di
perangkat user, bukan di DATA yang kamu terima. DATA yang kamu terima soal "transaksi
otomatis" HANYA berisi transaksi yang SUDAH tereksekusi/tercatat di masa lalu. Kalau
pertanyaan user soal JADWAL/KAPAN transaksi berulang berikutnya jalan (bukan soal transaksi
otomatis yang sudah terjadi), jangan menebak atau mengarang jadwal dari DATA — jawab jujur
bahwa kamu belum bisa akses info itu dan arahkan mereka cek halaman Transaksi Berulang
langsung.
HUTANG & PIUTANG: Piutang (uang orang lain ke user) dan hutang (uang user ke orang lain)
adalah hal BERBEDA dan LAWAN ARAH — jangan pernah menjumlahkannya jadi satu angka. Kalau
DATA berisi info hutang/piutang, jawab HANYA dari angka hutang/piutang itu; JANGAN campur
atau bandingkan dengan angka pengeluaran/pemasukan biasa KECUALI user memang eksplisit minta
perbandingan. WAJIB sebutkan NOMINAL RUPIAH totalnya, bukan cuma jumlah catatan — DATA selalu
menyertakan nominal per arah, jangan hanya mengutip jumlah catatan saja walau pertanyaan user
memakai kata "ada berapa" (yang bisa terdengar seperti nanya jumlah, padahal user hampir
selalu maksud nominalnya). Label arah (piutang vs hutang) HARUS mengikuti DATA aktual, BUKAN
istilah yang dipakai user di pertanyaannya — kalau user salah sebut arah (mis. bertanya
"hutang" padahal maksudnya piutang), tetap jawab dengan label yang benar sesuai DATA supaya
user tidak salah paham posisi keuangannya sendiri.
DOMPET SPESIFIK: Kalau user menyebut nama dompet tertentu di pertanyaannya, JANGAN pernah
menyusun jawaban seolah angka di DATA itu "untuk dompet [nama itu]" KECUALI DATA secara
eksplisit mengonfirmasi dompet itu ada (mis. menyebut nama dompetnya di baris DATA, atau
DATA memang berisi pesan "tidak ditemukan"). Jangan ikut-ikutan menyebut nama dompet dari
pertanyaan user di jawabanmu kalau DATA tidak mengonfirmasinya — itu bisa membuat user
mengira dompet fiktif/salah ketik itu benar ada.
TONE: Ramah, singkat, pakai sedikit emoji.
FORMAT ANGKA: Rupiah (contoh Rp1.500.000).`;

/**
 * Level 3 — Susun jawaban natural language dari data context.
 */
export async function answerFinancialQuestion(
  question: string,
  dataContext: string,
  language: "id" | "en" = "id",
  opts: { deterministic?: boolean } = {},
): Promise<{ answer: string; usage: TokenUsage }> {
  const langLine = language === "en"
    ? "LANGUAGE: Answer in English."
    : "LANGUAGE: Jawab dalam Bahasa Indonesia.";

  // deterministic=true dipakai untuk pertanyaan agregat (wantsTotal): temp 0
  // menghapus variasi sampling supaya jawaban angka tidak teracak (kadang
  // benar, kadang "Data kurang"). Pertanyaan percakapan biasa TETAP temp 0.3
  // supaya jawabannya tidak jadi kaku/robotik.
  const temperature = opts.deterministic ? 0 : 0.3;

  const { content, usage } = await callGroq(
    ANSWER_MODEL,
    [
      { role: "system", content: `${ANSWER_SYSTEM_PROMPT}\n${langLine}` },
      {
        role: "user",
        content: `DATA:\n${dataContext}\n\nPERTANYAAN USER:\n${question}`,
      },
    ],
    {
      temperature,
      maxTokens: 1024,
      timeoutMs: 20000,
      reasoningEffort: "low",
    },
  );

  const answer = content.trim() ||
    "Maaf, aku belum bisa menyusun jawaban. Coba ulangi pertanyaannya ya. 🙏";
  return { answer, usage };
}
