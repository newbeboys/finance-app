// ════════════════════════════════════════════════════════════════════
//  guardrail.ts — Level 1 (keyword) & Level 2 (Groq classification)
//
//  Tujuan: buang pertanyaan di luar topik keuangan SEDINI mungkin supaya
//  tidak membakar token/kuota di Level 3 (query + answering).
//
//    Level 1  → instan, tanpa panggil API. Tolak kalau ada keyword
//               yang jelas di luar konteks (resep, cuaca, coding, dll).
//    Level 2  → panggil model classifier kecil di Groq. Kalau hasilnya
//               OUT_OF_SCOPE → tolak sebelum masuk ke query + answering.
// ════════════════════════════════════════════════════════════════════

import type { Classification, KeywordFilterResult } from "./types.ts";
import { classifyIntent } from "./groq-client.ts";

// ── Level 1: daftar keyword di luar topik ────────────────────────────
// Sengaja konservatif: hanya kata yang HAMPIR PASTI bukan pertanyaan
// keuangan pribadi. Tujuannya menangkap kasus jelas, bukan menyaring
// segalanya (itu tugas Level 2). Semua dicek lower-case dengan batas kata.
const OUT_OF_SCOPE_KEYWORDS: string[] = [
  // makanan / resep
  "resep", "recipe", "masak", "memasak", "cara membuat", "bahan-bahan",
  // cuaca
  "cuaca", "weather", "hujan", "ramalan",
  // coding / teknis
  "javascript", "python", "coding", "programming", "kode program",
  "html", "css", "algoritma",
  // pengetahuan umum / hiburan
  "sepak bola", "film", "movie", "lagu", "lyrics", "lirik", "artis",
  "ibukota", "capital city", "sejarah", "presiden", "pahlawan",
  // sapaan/curhat murni non-finansial
  "obat", "penyakit", "gejala", "resep dokter",
  // crypto sebagai edukasi umum (bukan data pribadi user)
  "apa itu bitcoin", "apa itu crypto", "cara beli bitcoin",
];

/**
 * Level 1 — Keyword filter.
 * Return blocked=true bila menemukan keyword di luar topik.
 * Tidak memanggil API apa pun → sangat murah & instan.
 */
export function keywordFilter(question: string): KeywordFilterResult {
  const q = question.toLowerCase();

  for (const kw of OUT_OF_SCOPE_KEYWORDS) {
    // Untuk frasa (mengandung spasi) cukup cek substring.
    // Untuk kata tunggal, cek dengan batas kata agar "obat" tidak cocok
    // dengan "obatan" yang tak relevan — tapi tetap toleran.
    if (kw.includes(" ")) {
      if (q.includes(kw)) return { blocked: true, reason: `keyword:${kw}` };
    } else {
      const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i");
      if (re.test(q)) return { blocked: true, reason: `keyword:${kw}` };
    }
  }

  return { blocked: false };
}

/**
 * Level 2 — Klasifikasi intent via Groq (model classifier kecil).
 * Delegasi ke groq-client.classifyIntent(). Bila API gagal, kita memilih
 * strategi "fail-open": anggap FINANCIAL dan lanjut ke Level 3. Alasannya:
 * Level 3 masih punya safeguard sendiri, jadi jangan sampai user sah
 * tertolak hanya karena classifier sempat error.
 */
export async function classifyWithGroq(
  question: string,
): Promise<Classification> {
  try {
    return await classifyIntent(question);
  } catch (e) {
    console.error("[guardrail] classifyIntent gagal, fail-open ke FINANCIAL:", e);
    return "FINANCIAL";
  }
}

// ── util ─────────────────────────────────────────────────────────────
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
