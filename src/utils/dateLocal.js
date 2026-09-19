// ════════════════════════════════════════════════════════════════════
//  dateLocal — tanggal kalender LOKAL sebagai string "YYYY-MM-DD".
//
//  INI KONSOLIDASI, BUKAN LOGIC BARU. Pola di bawah sudah ada
//  (identik, di-copy-paste) di banyak file — transactions.jsx,
//  debts-page.jsx, AddDebtModal.jsx, DebtDetailSheet.jsx,
//  useDebts.js, useNotifications.js (sbg `localISO`), widgets.jsx —
//  dan semuanya sekarang meng-import dari sini. Perilaku WAJIB identik
//  byte-per-byte dengan versi lokal yang digantikan; jangan "perbaiki"
//  apa pun di sini tanpa mengecek ulang seluruh pemanggil.
//
//  KENAPA getFullYear/getMonth/getDate, BUKAN toISOString():
//  kolom tanggal di Postgres bertipe DATE dan menyimpan tanggal
//  kalender LOKAL user (WIB/UTC+7), bukan timestamp UTC. toISOString()
//  memformat dalam UTC, jadi di WIB antara 00:00–07:00 dia mengembalikan
//  tanggal KEMARIN — off-by-one-day klasik. Lihat CLAUDE.md
//  § "Dates are local (WIB), never UTC".
//
//  Fungsi murni, TANPA import apa pun — aman dipakai dari hook,
//  komponen, maupun modul lib biasa.
//
//  useTransactions.js dan recurringHelper.js SUDAH ikut konsolidasi
//  (PR #8; `toISO` di recurringHelper.js kini alias `dateToISO`, batch 0
//  timezone), begitu juga lib/debtProof.js. BELUM ikut: inline di
//  lib/widgetSync.js dan pola "YYYY-MM" yang bukan `X.getFullYear()`/
//  `X.getMonth()` (mis. `${yr}-${...mo + 1...}` di analytics.jsx/widgets.jsx).
// ════════════════════════════════════════════════════════════════════

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Date object → "YYYY-MM-DD" menurut kalender LOKAL device.
 * @param {Date} d
 * @returns {string}
 */
export function dateToISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Tanggal hari ini (lokal) sebagai "YYYY-MM-DD".
 * @returns {string}
 */
export function todayISO() {
  return dateToISO(new Date());
}

/**
 * Date object → prefix bulan "YYYY-MM" menurut kalender LOKAL device.
 * Dipakai untuk `dateRaw.startsWith(prefix)` / perbandingan string bulan.
 * @param {Date} d
 * @returns {string}
 */
export function monthPrefixISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
