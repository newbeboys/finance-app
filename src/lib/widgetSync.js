// Jembatan data React → Widget Android (home-screen).
// READ-ONLY: hanya mendorong ringkasan ke SharedPreferences via plugin native WidgetBridge.
// Semua panggilan native dijaga Capacitor.isNativePlatform() agar web/dev tidak terpengaruh.

import { registerPlugin, Capacitor } from '@capacitor/core';
import { fmtShort, fmtSigned, formatNominal, ALL_CATEGORIES } from '../data';

const WidgetBridge = registerPlugin('WidgetBridge');

const MONTHS_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const CAT_LABEL = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.id, c.label]));

function txTitle(t) {
  if (t.merchant && t.merchant !== '—') return t.merchant;
  return CAT_LABEL[t.category] || t.category || 'Transaksi';
}

// Hitung seluruh data yang dipakai widget dari transaksi + anggaran.
export function computeWidgetData(transactions = [], budgets = []) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const pfx = `${y}-${String(m + 1).padStart(2, '0')}`;          // "2026-06"
  const todayISO = `${pfx}-${String(now.getDate()).padStart(2, '0')}`;

  const monthTx = transactions.filter((t) => t.dateRaw && t.dateRaw.startsWith(pfx));
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expense;

  const totalBudget = budgets
    .filter((b) => b.enabled)
    .reduce((s, b) => s + (Number(b.limit) || 0), 0);
  const percent = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0;

  // Karakter (urutan prioritas sesuai spesifikasi)
  const incomeToday = transactions.some((t) => t.amount > 0 && t.dateRaw === todayISO);
  let character = 'char_happy';
  if (incomeToday) character = 'char_celebrate';
  else if (totalBudget > 0 && expense > 0.9 * totalBudget) character = 'char_panic';
  else if (totalBudget > 0 && expense > 0.7 * totalBudget) character = 'char_worried';

  // 2 transaksi terakhir (transactions sudah terurut terbaru → lama)
  const lastTx = transactions.slice(0, 2).map((t) => ({
    title: txTitle(t),
    amount: fmtSigned(t.amount),
    positive: t.amount > 0,
  }));

  return {
    bulan_tahun: `${MONTHS_FULL[m]} ${y}`,
    bulan_tahun_pendek: `${MONTHS_SHORT[m]} ${y}`,
    total_masuk_bulan_ini: formatNominal(income),
    total_keluar_bulan_ini: formatNominal(expense),
    saldo_bersih: formatNominal(net),
    masuk_short: fmtShort(income),
    keluar_short: fmtShort(expense),
    persen_anggaran: percent,
    persen_label: totalBudget > 0 ? `${percent}% dari anggaran` : 'Belum ada anggaran',
    transaksi_terakhir: JSON.stringify(lastTx),
    karakter_aktif: character,
  };
}

// Dorong data terbaru ke widget. Aman dipanggil di web (no-op).
export async function syncWidget(transactions, budgets) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update(computeWidgetData(transactions, budgets));
  } catch (e) {
    console.warn('[widget] gagal sync:', e?.message || e);
  }
}

// Ambil aksi peluncuran dari widget (mis. "add_tx"). Mengembalikan "" jika tidak ada.
export async function consumeWidgetLaunchAction() {
  if (!Capacitor.isNativePlatform()) return '';
  try {
    const res = await WidgetBridge.consumeLaunchAction();
    return (res && res.action) || '';
  } catch {
    return '';
  }
}
