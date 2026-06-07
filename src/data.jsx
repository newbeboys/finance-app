export const fmt = (n) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtShort = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (abs >= 1_000_000)     return `${sign}Rp ${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000)         return `${sign}Rp ${(abs / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return sign + "Rp " + abs;
};
export const fmtSigned = (n) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n));

// Angka lengkap dengan titik — tidak dibulatkan ke jt/rb
export const formatNominal = (n) => {
  if (n == null || isNaN(n)) return 'Rp 0';
  const sign = n < 0 ? '−' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
};

// Font size otomatis berdasarkan jumlah digit
export const nominalFontSize = (n, { hero = false, mobile = false } = {}) => {
  const digits = Math.abs(Math.round(n || 0)).toString().length;
  if (hero) {
    if (mobile) return digits < 8 ? 22 : digits <= 11 ? 18 : 14;
    return digits < 8 ? 34 : digits <= 11 ? 24 : 18;
  }
  if (mobile) return digits < 8 ? 18 : digits <= 11 ? 14 : 11;
  return digits < 8 ? 24 : digits <= 11 ? 18 : 14;
};

export const CURRENCY = { code: "IDR", symbol: "Rp" };

export const ACCOUNTS = [];

export const ACCOUNT_TYPES = [
  { id: "bank",       label: "Rekening Bank" },
  { id: "ewallet",    label: "E-Wallet" },
  { id: "cash",       label: "Tunai" },
  { id: "investment", label: "Investasi" },
];

export const KPI = {
  balance: 0,
  balanceDelta: 0,
  income: 0,
  incomeDelta: 0,
  expenses: 0,
  expensesDelta: 0,
  savings: 0,
  savingsTarget: 0,
  savingsDelta: 0,
};

export const CASHFLOW = [];

// Kategori pengeluaran standar — identik di menu Transaksi & Anggaran.
export const CATEGORIES = [
  { id: "food",          label: "Makanan & Minuman",  amount: 0, color: "var(--terra)" },
  { id: "transport",     label: "Transportasi",       amount: 0, color: "var(--sage)" },
  { id: "shopping",      label: "Belanja",            amount: 0, color: "var(--gold)" },
  { id: "bills",         label: "Tagihan & Utilitas", amount: 0, color: "var(--blush)" },
  { id: "entertainment", label: "Hiburan",            amount: 0, color: "#8C7B5C" },
  { id: "healthcare",    label: "Kesehatan",          amount: 0, color: "#7A8A6E" },
  { id: "crypto",        label: "Crypto",             amount: 0, color: "#9A8A55" },
  { id: "laundry",       label: "Laundry",            amount: 0, color: "#6E8A8C" },
  { id: "cigarette",     label: "Rokok",              amount: 0, color: "#9A6B55" },
];

// Kategori khusus pemasukan (sesuai PRD)
export const INCOME_CATEGORIES = [
  { id: "salary",     label: "Gaji",                  color: "var(--sage)"  },
  { id: "freelance",  label: "Freelance",             color: "var(--gold)"  },
  { id: "investment", label: "Investasi",             color: "#9A6BD9"      },
  { id: "side",       label: "Pendapatan Sampingan",  color: "var(--blush)" },
  { id: "business",   label: "Bisnis",                color: "var(--terra)" },
  { id: "bonus",      label: "Bonus / THR",           color: "#7A8A6E"      },
  { id: "other_in",   label: "Pemasukan Lain",        color: "#6E8A8C"      },
];

// Gabungan untuk lookup display (TransactionsCard, TransactionsPage)
export const ALL_CATEGORIES = [...CATEGORIES, ...INCOME_CATEGORIES];

export const TRANSACTIONS = [];

export const BUDGETS = [];

export const GOALS = [];

export const AI_INSIGHTS = [];
