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
- Kalau DATA tidak cukup untuk menjawab, katakan: "Data kurang. Tanya lagi dengan detail kategori/periode apa yang kamu cari."
TONE: Ramah, singkat, pakai sedikit emoji.
FORMAT ANGKA: Rupiah (contoh Rp1.500.000).`;

/**
 * Level 3 — Susun jawaban natural language dari data context.
 */
export async function answerFinancialQuestion(
  question: string,
  dataContext: string,
  language: "id" | "en" = "id",
): Promise<{ answer: string; usage: TokenUsage }> {
  const langLine = language === "en"
    ? "LANGUAGE: Answer in English."
    : "LANGUAGE: Jawab dalam Bahasa Indonesia.";

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
      temperature: 0.3,
      maxTokens: 1024,
      timeoutMs: 20000,
      reasoningEffort: "low",
    },
  );

  const answer = content.trim() ||
    "Maaf, aku belum bisa menyusun jawaban. Coba ulangi pertanyaannya ya. 🙏";
  return { answer, usage };
}
