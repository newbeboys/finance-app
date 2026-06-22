// ── Konfigurasi limit per plan (Basic vs Pro) ──────────────────────
// SATU-SATUNYA sumber kebenaran untuk semua batasan fitur. Jangan
// hardcode angka/limit di file lain — selalu baca dari sini lewat
// useSubscription().limits.
//
// availableFontThemes memakai key/id tema font ASLI di kode
// (lihat FONT_THEMES di src/app.jsx & FONT_THEME_OPTIONS di
// src/settings-page.jsx): 'modern-tech', 'pro-finance', 'elegant',
// 'luxury', 'soft-friendly'. Untuk Pro nilainya 'all' (semua tema).

export const PLAN_LIMITS = {
  basic: {
    maxCustomCategories: 3,
    maxWallets: 1,
    maxSavingsGoals: 2,
    maxBudgets: 7,
    maxTransactionsPerMonth: 75,   // per BULAN KALENDER (berdasar tanggal transaksi, bukan created_at)
    recurringTransactionsEnabled: false,
    reportsExportEnabled: false,
    receiptScanEnabled: false,
    aiInsightsEnabled: false,
    availableFontThemes: ['modern-tech', 'soft-friendly'],
  },
  pro: {
    maxCustomCategories: Infinity,
    maxWallets: Infinity,
    maxSavingsGoals: Infinity,
    maxBudgets: Infinity,
    maxTransactionsPerMonth: Infinity,
    recurringTransactionsEnabled: true,
    reportsExportEnabled: true,
    receiptScanEnabled: true,
    aiInsightsEnabled: true,
    availableFontThemes: 'all',
  },
};

// True bila tema font `themeId` boleh dipakai pada `limits` saat ini.
export function isFontThemeAllowed(themeId, limits) {
  if (!limits) return true;
  const allowed = limits.availableFontThemes;
  if (allowed === 'all') return true;
  return Array.isArray(allowed) && allowed.includes(themeId);
}
