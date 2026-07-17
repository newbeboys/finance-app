// ════════════════════════════════════════════════════════════════════
//  financial-chat — Entry point Edge Function
//
//  Alur:
//    0. CORS preflight + hanya POST
//    1. Auth: ambil user_id dari JWT (BUKAN dari body → cegah IDOR)
//    2. Level 1: keyword filter (instan, tanpa API)
//    3. Level 2: klasifikasi intent via Groq (FINANCIAL / OUT_OF_SCOPE)
//    4. Level 3: parse intent → query Supabase → answering via Groq
//
//  Setiap error ditangani "graceful": user selalu dapat pesan yang enak
//  dibaca, dan error penting dicatat ke error_logs (service_role).
// ════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { ChatRequest, ChatResponse, WalletRef } from "./types.ts";
import { classifyWithGroq, keywordFilter } from "./guardrail.ts";
import { parseIntent } from "./intent-parser.ts";
import { fetchFinancialData } from "./query-builder.ts";
import { answerFinancialQuestion } from "./groq-client.ts";

// ── CORS ─────────────────────────────────────────────────────────────
// Fungsi ini dipanggil dari browser (React), jadi WAJIB ada CORS header —
// beda dgn revenuecat-webhook yang server-to-server.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: ChatResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Error logging server-side (pola sama dgn revenuecat-webhook) ─────
async function logServerError(
  message: string,
  metadata: Record<string, unknown> | null,
  severity: "high" | "medium" = "medium",
  userId: string | null = null,
) {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("error_logs").insert({
      user_id: userId, // dari JWT terverifikasi (index handler), BUKAN dari body
      source: "financial-chat",
      message,
      metadata,
      severity,
    });
  } catch (e) {
    console.error("[financial-chat] logServerError gagal (diabaikan):", e);
  }
}

// ── Log pertanyaan yang GAGAL dijawab (tabel chat_unanswered_log) ─────
// TERPISAH dari error_logs: ini analitik POLA pertanyaan untuk memperbaiki
// keyword filter Level 1, BUKAN error teknis/uang.
//
// ⚠️ PRIVASI: SENGAJA tanpa user_id / identitas apa pun. Kita insert langsung
// pakai service_role (bypass RLS), BUKAN via RPC — justru supaya auth.uid()
// TIDAK ikut tercatat. Lihat migration 20260717000000_add_chat_unanswered_log.sql.
//
// Fail-silent seperti logServerError(): kegagalan menulis TIDAK boleh
// mengganggu alur jawaban ke user — cukup console.error.
async function logUnanswered(
  question: string,
  reason: "level1_blocked" | "level2_blocked" | "level3_declined" | "data_kurang",
) {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Hanya question + reason + created_at (default now()). TIDAK ADA user_id.
    await admin.from("chat_unanswered_log").insert({ question, reason });
  } catch (e) {
    console.error("[financial-chat] logUnanswered gagal (diabaikan):", e);
  }
}

// Deteksi jawaban "Data kurang..." yang diinstruksikan di system prompt
// answering (groq-client.ts). Frasa itu cukup khas untuk dicocokkan literal.
function isDataKurang(answer: string): boolean {
  return /\bdata kurang\b/i.test(answer);
}

// Deteksi PENOLAKAN out-of-scope oleh model di Level 3: pertanyaan yang lolos
// L1 (keyword) + L2 (fail-open FINANCIAL) tapi ditolak sopan lewat instruksi
// system prompt (mis. "kenapa market bitcoin turun" → "Maaf, data yang saya
// miliki hanya tentang transaksi & budget pribadi Anda..."). Kasus ini paling
// berguna untuk tuning keyword filter L1, tapi tak tertangkap isDataKurang.
//
// Pola SENGAJA di-anchor ke penolakan batasan-diri (first-person / "di luar
// jangkauan/cakupan") supaya jawaban NORMAL (yang cuma menyebut angka/kategori)
// tidak ikut kena. Selalu dicek SETELAH isDataKurang → keduanya eksklusif.
function isLevel3Declined(answer: string): boolean {
  const a = answer.toLowerCase();
  const patterns: RegExp[] = [
    // ID — penolakan batasan-diri
    /data yang (saya|aku) (miliki|punya) hanya/,
    /(saya|aku) (hanya|cuma) (bisa|dapat) (membantu|menjawab|bantu)/,
    /(saya|aku) tidak (bisa|dapat) (menjawab|membantu)/,
    /tidak (memiliki|punya|menyimpan) (informasi|data|akses)[^.!?]{0,25}(tentang|soal|mengenai|seputar|terkait)/,
    /di luar (jangkauan|cakupan|topik|kemampuan|konteks)/,
    /bukan (topik|pertanyaan|hal) (keuangan|yang)/,
    // EN
    /i can only (help|answer|assist)/,
    /i (don't|do not|cannot|can't) have (information|data|access)/,
    /(outside|beyond) (my|the|what)[^.!?]{0,20}(scope|help|assist|can)/,
    /(that's|that is) (outside|beyond|not something i)/,
  ];
  return patterns.some((re) => re.test(a));
}

// Deteksi bahasa sangat sederhana: kalau tidak ada kata Indonesia umum,
// asumsikan Inggris. Default Indonesia.
function detectLang(q: string): "id" | "en" {
  return /\b(the|what|how|my|show|this|much|last)\b/i.test(q) &&
      !/[a-z]*(ku|nya|kah)\b|\b(apa|berapa|bulan|pengeluaran|saya|aku)\b/i.test(q)
    ? "en"
    : "id";
}

serve(async (req) => {
  // ── 0. CORS preflight ──────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ answer: "Method Not Allowed", source: "error" }, 405);
  }

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

  // ── Parse body ─────────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return json({ answer: "Format request tidak valid (JSON).", source: "error" }, 400);
  }
  const question = (body?.question ?? "").toString().trim();
  if (!question) {
    return json({
      answer: "Pertanyaan kosong. Coba tanya, misal: \"Pengeluaran terbesarku bulan ini?\"",
      source: "error",
    }, 400);
  }
  if (question.length > 500) {
    return json({
      answer: "Pertanyaannya terlalu panjang. Ringkas jadi maksimal 500 karakter ya. 🙏",
      source: "error",
    }, 400);
  }

  const lang = detectLang(question);

  // ── 1.5 Rate limit per-user (SEBELUM Level 1/2/3) ──────────────────
  // Cek + increment counter secara ATOMIK lewat RPC SECURITY DEFINER
  // (counter otoritatif di server; user tak bisa memalsukannya). Kalau
  // sudah lewat batas → tolak dengan pesan ramah TANPA menyentuh Groq,
  // supaya request abusive tidak membakar kuota klasifikasi/answering.
  try {
    const { data: rl, error: rlErr } = await supabase.rpc(
      "check_chat_rate_limit",
      { p_max_requests: 8, p_window_seconds: 60 },
    );
    if (rlErr) {
      // Fail-open: jangan sampai bug rate-limiter memblokir user sah.
      console.error("[financial-chat] rate limit RPC error (fail-open):", rlErr);
    } else if (rl && (rl as { allowed?: boolean }).allowed === false) {
      console.log(`[financial-chat] rate limit blok: user ${userId}`);
      // Status 200 (sama pola dgn keyword_filter/intent_filter): supabase-js
      // functions.invoke memperlakukan non-2xx sbg error & membuang body, jadi
      // 429 akan menyembunyikan pesan ramah ini di UI (MoneyIQChat.jsx). Sumber
      // dibedakan lewat `source:"rate_limit"`, bukan HTTP status.
      return json({
        answer: lang === "en"
          ? "Hang on a sec — you've asked a lot in a short time 🙏 try again in a few seconds."
          : "Tunggu sebentar ya, kamu sudah banyak bertanya 🙏 coba lagi dalam beberapa detik.",
        source: "rate_limit",
      });
    }
  } catch (e) {
    // Fail-open juga bila RPC melempar (mis. fungsi belum ter-deploy).
    console.error("[financial-chat] rate limit exception (fail-open):", e);
  }

  // ── 2. Level 1 — Keyword filter (tanpa panggil Groq) ───────────────
  const kw = keywordFilter(question);
  if (kw.blocked) {
    console.log(`[financial-chat] Level 1 blok: ${kw.reason}`);
    await logUnanswered(question, "level1_blocked");
    return json({
      answer: lang === "en"
        ? "I can only answer questions about your own finances (transactions, budgets, savings, investments). 💰"
        : "Aku cuma bisa bantu soal keuanganmu sendiri ya (transaksi, anggaran, tabungan, investasi). 💰",
      source: "keyword_filter",
    });
  }

  // ── 3. Level 2 — Klasifikasi intent via Groq ───────────────────────
  const classification = await classifyWithGroq(question);
  if (classification === "OUT_OF_SCOPE") {
    console.log("[financial-chat] Level 2 blok: OUT_OF_SCOPE");
    await logUnanswered(question, "level2_blocked");
    return json({
      answer: lang === "en"
        ? "That's outside what I can help with. Ask me about your transactions, budgets, or savings. 🙂"
        : "Pertanyaan itu di luar jangkauanku. Tanyakan soal transaksi, anggaran, atau tabunganmu ya. 🙂",
      source: "intent_filter",
    });
  }

  // ── 4. Level 3 — Parse intent → query → answering ──────────────────
  // Ambil daftar wallet user dulu: dipakai buat deteksi dompet by nama DAN
  // buat cegah tabrakan kata metode vs nama wallet (lihat intent-parser.ts).
  const { data: walletRows, error: walletErr } = await supabase
    .from("wallets")
    .select("id, name")
    .eq("user_id", userId);
  if (walletErr) {
    console.error("[financial-chat] gagal ambil wallets utk deteksi intent:", walletErr);
  }
  const wallets: WalletRef[] = (walletRows ?? []) as WalletRef[];

  const intent = parseIntent(question, wallets);

  // Ambil data (RLS aktif via client ter-autentikasi).
  let dataResult: { context: string; rowCount: number } | null;
  try {
    dataResult = await fetchFinancialData(supabase, intent, userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[financial-chat] Supabase query error:", msg);
    await logServerError(msg, { stage: "fetchFinancialData", intent }, "medium", userId);
    return json({
      answer: lang === "en"
        ? "Couldn't fetch your data. Try again with a specific category or period."
        : "Data tidak ditemukan. Tanya dengan detail kategori apa?",
      source: "error",
    });
  }

  if (!dataResult) {
    return json({
      answer: lang === "en"
        ? "No matching data found for that period/category. Try a different one. 🔎"
        : "Belum ada data untuk periode/kategori itu. Coba periode atau kategori lain ya. 🔎",
      source: "answer",
    });
  }

  // Susun jawaban via Groq answering model.
  try {
    const { answer, usage } = await answerFinancialQuestion(
      question,
      dataResult.context,
      lang,
      { deterministic: intent.wantsTotal === true }, // temp 0 khusus agregat
    );
    // Pertanyaan yang lolos guardrail tapi tetap gagal dilayani di L3 → catat
    // polanya (tanpa identitas user). Urutan penting & eksklusif:
    //   1) "Data kurang..." literal        → data_kurang
    //   2) penolakan out-of-scope oleh model → level3_declined
    // Jawaban normal (angka/kategori) tidak kena keduanya.
    if (isDataKurang(answer)) {
      await logUnanswered(question, "data_kurang");
    } else if (isLevel3Declined(answer)) {
      await logUnanswered(question, "level3_declined");
    }
    return json({
      answer,
      source: "answer",
      tokens_used: usage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[financial-chat] Groq answering error:", msg);
    await logServerError(msg, { stage: "answerFinancialQuestion", intent }, "medium", userId);
    return json({
      answer: lang === "en"
        ? "Something went wrong. Please try again in a minute."
        : "Terjadi error. Coba lagi dalam 1 menit ⏳",
      source: "error",
    });
  }
});
