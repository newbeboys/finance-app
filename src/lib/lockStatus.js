// ── Status "terkunci" (soft lock sisa downgrade Pro→Basic) ─────────────
//  DIHITUNG dari data yang sudah ada di state, TIDAK disimpan.
//
//  Aturan tunggal untuk keempat tabel ber-kuota (wallets, savings,
//  custom_categories, debts): N item PALING LAMA (created_at ASC) tetap
//  aktif, sisanya terkunci. N = limit plan yang sedang berlaku, dibaca dari
//  `useSubscription().limits` (PLAN_LIMITS) — bukan angka hardcode di sini.
//
//  KENAPA DIHITUNG, BUKAN DIBACA DARI KOLOM `is_locked` (keputusan 15 Sep
//  2026, lihat §1.17 teknis_keputusan-infrastruktur-roadmap.md): kolom itu
//  hanya pernah ditulis oleh planReconciliation.js, dan itu pun HANYA kalau
//  sebuah tab kebetulan sedang terbuka dan menyaksikan transisi plan
//  Pro→Basic (useSubscription.js:79-83; cold start dilewati karena
//  prevIsProRef masih null). Kalau downgrade terjadi saat app tertutup,
//  kolomnya tidak pernah diperbarui dan UI memakai status basi tanpa jejak.
//  Hasil hitungan di bawah tidak bisa basi: dia fungsi murni dari
//  (isi array, limit saat ini). Pola yang sama dengan `budgets.spent` yang
//  juga sengaja tidak pernah dipakai (§1.2).
//
//  Kolom `is_locked` di database SENGAJA dibiarkan ada dan tetap ditulis
//  planReconciliation.js — tidak ada lagi pembacanya di klien, dan tidak ada
//  policy/trigger/RPC yang membacanya di server (diverifikasi 15 Sep 2026,
//  docs/investigasi-bug-4-5-6-2026-09-15.md Bagian C8 & E3).

// created_at hilang / tidak bisa di-parse → dianggap PALING BARU (Infinity),
// jadi baris itu yang kena kunci lebih dulu saat kuota terlampaui. Sengaja
// begitu: gagal ke arah MENGUNCI, bukan ke arah memberi akses gratis.
function timeOf(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : Infinity;
}

// Urutan DETERMINISTIK: created_at ASC, lalu `id` sebagai pemecah seri.
// Tiebreaker id itu WAJIB, bukan kosmetik: dua baris dengan created_at
// identik (mis. dibuat dalam satu batch/seed) bisa bertukar posisi antar
// render kalau hanya diurut waktu — dan yang tampil terkunci akan
// berganti-ganti sendiri di layar tanpa ada yang berubah di data.
function compareOldestFirst(a, b, timestampKey, idKey) {
  const ta = timeOf(a?.[timestampKey]);
  const tb = timeOf(b?.[timestampKey]);
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ia = String(a?.[idKey] ?? '');
  const ib = String(b?.[idKey] ?? '');
  if (ia === ib) return 0;
  return ia < ib ? -1 : 1;
}

/**
 * Kumpulan id item yang TERKUNCI.
 *
 * @param items  array item yang MEMAKAN KUOTA. Pemanggil wajib memfilter
 *               lebih dulu sesuai aturan tabelnya (buang is_deleted, status
 *               non-aktif, atau baris milik user lain) — fungsi ini sengaja
 *               tidak tahu aturan per tabel.
 * @param limit  maksimum item yang boleh aktif. Infinity/null = tanpa batas
 *               (Pro) → tidak ada yang terkunci.
 * @returns Set<id>
 */
export function lockedIds(items, { limit, timestampKey = 'created_at', idKey = 'id' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return new Set();
  if (limit == null || limit === Infinity) return new Set();

  const max = Math.max(0, Math.floor(Number(limit) || 0));
  if (items.length <= max) return new Set();

  // Salin dulu: .sort() memodifikasi array di tempat, dan array yang masuk
  // ke sini adalah state React (atau turunannya) yang tidak boleh diacak.
  const sorted = [...items].sort((a, b) => compareOldestFirst(a, b, timestampKey, idKey));
  return new Set(sorted.slice(max).map(it => it?.[idKey]));
}

/**
 * Bentuk yang dipakai hook: kembalikan penguji `isLocked(item)`.
 * Set-nya dihitung SEKALI di sini, jadi memanggil penguji di dalam .map()
 * tetap O(1) per item — bukan menyortir ulang setiap kali dipanggil.
 *
 * Penguji menerima objek item maupun id mentah.
 */
export function makeIsLocked(items, options = {}) {
  const locked = lockedIds(items, options);
  const idKey = options.idKey || 'id';
  if (locked.size === 0) return () => false;
  return (item) => {
    if (item == null) return false;
    const id = typeof item === 'object' ? item[idKey] : item;
    return locked.has(id);
  };
}
