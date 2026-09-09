import { CATEGORIES } from '../data';

// Sumber tunggal perhitungan "sudah kepakai berapa" untuk sebuah anggaran.
// Dipakai di budgets-page.jsx, widgets.jsx (BudgetsCard), dan
// hooks/useNotifications.js — jangan bikin kalkulator lokal lagi di tempat lain,
// tiga tempat itu dulu punya versi sendiri-sendiri dan sempat beda hasil.

// Budget lama hasil migrateFromLocalStorage (useBudgets.js) tidak punya
// categoryId, cuma `label` — dicocokkan balik ke CATEGORIES secara fuzzy.
export function resolveBudgetCategoryId(budget) {
  if (!budget) return null;
  if (budget.categoryId) return budget.categoryId;

  const bl = (budget.label || '').toLowerCase().trim();
  const match = CATEGORIES.find(c => {
    const cl = c.label.toLowerCase();
    return cl === bl || cl.startsWith(bl) || bl.startsWith(cl.split(' ')[0]);
  });
  return match ? match.id : null;
}

// budget.walletId null = anggaran umum (semua dompet); selain itu anggaran
// dikunci ke satu dompet. Transaksi tanpa wallet_id dianggap milik dompet utama
// (sama seperti perlakuan di halaman lain).
export function getBudgetSpent(budget, transactions = [], accounts = []) {
  const catId = resolveBudgetCategoryId(budget);
  if (!catId) return 0;

  const primaryWalletId = accounts.find(a => a.primary)?.id || null;
  const scopedWalletId  = budget?.walletId ?? null;

  const now = new Date();
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let total = 0;
  transactions.forEach(tx => {
    if (!(tx.amount < 0 && tx.dateRaw?.startsWith(pfx) && tx.category === catId)) return;
    if (scopedWalletId != null && (tx.wallet_id || primaryWalletId) !== scopedWalletId) return;
    total += Math.abs(tx.amount);
  });
  return total;
}
