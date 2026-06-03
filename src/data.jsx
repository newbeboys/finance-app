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

export const CURRENCY = { code: "IDR", symbol: "Rp" };

export const ACCOUNTS = [
  { id: "a1", name: "BCA Utama",        type: "bank",       institution: "Bank Central Asia", last4: "4421", balance: 92_400_000, color: "#2A6FDB", primary: true },
  { id: "a2", name: "Jenius",           type: "bank",       institution: "Bank BTPN",         last4: "8810", balance: 48_350_000, color: "#1FA8A0", primary: false },
  { id: "a3", name: "GoPay",            type: "ewallet",    institution: "Gojek",             last4: "0297", balance: 8_500_000,  color: "#1B8A3F", primary: false },
  { id: "a4", name: "Portfolio Kripto", type: "investment", institution: "Pintu",             last4: "—",    balance: 32_000_000, color: "#9A6BD9", primary: false },
  { id: "a5", name: "Dompet Tunai",     type: "cash",       institution: "Tunai",             last4: "—",    balance: 3_000_000,  color: "#8C7B5C", primary: false },
];

export const ACCOUNT_TYPES = [
  { id: "bank",       label: "Rekening Bank" },
  { id: "ewallet",    label: "E-Wallet" },
  { id: "cash",       label: "Tunai" },
  { id: "investment", label: "Investasi" },
];

export const KPI = {
  balance: 184_250_000,
  balanceDelta: 4.2,
  income: 32_400_000,
  incomeDelta: 2.1,
  expenses: 18_754_000,
  expensesDelta: -6.8,
  savings: 6_820_000,
  savingsTarget: 8_000_000,
  savingsDelta: 11.4,
};

export const CASHFLOW = [
  { m: "Jun", income: 27_200_000, expense: 16_800_000 },
  { m: "Jul", income: 28_400_000, expense: 20_400_000 },
  { m: "Aug", income: 27_600_000, expense: 15_200_000 },
  { m: "Sep", income: 29_600_000, expense: 17_600_000 },
  { m: "Oct", income: 30_400_000, expense: 19_600_000 },
  { m: "Nov", income: 31_200_000, expense: 21_200_000 },
  { m: "Dec", income: 35_600_000, expense: 24_400_000 },
  { m: "Jan", income: 31_600_000, expense: 18_400_000 },
  { m: "Feb", income: 30_800_000, expense: 16_800_000 },
  { m: "Mar", income: 32_400_000, expense: 19_600_000 },
  { m: "Apr", income: 32_000_000, expense: 18_800_000 },
  { m: "May", income: 32_400_000, expense: 18_754_000 },
];

export const CATEGORIES = [
  { id: "food",          label: "Makanan & Minuman",  amount: 3_780_000, color: "var(--terra)" },
  { id: "transport",     label: "Transportasi",       amount: 1_420_000, color: "var(--sage)" },
  { id: "shopping",      label: "Belanja",            amount: 2_840_000, color: "var(--gold)" },
  { id: "bills",         label: "Tagihan & Utilitas", amount: 5_200_000, color: "var(--blush)" },
  { id: "entertainment", label: "Hiburan",            amount: 1_290_000, color: "#8C7B5C" },
  { id: "healthcare",    label: "Kesehatan",          amount: 850_000,   color: "#7A8A6E" },
  { id: "snacking",      label: "Jajan",              amount: 824_000,   color: "#B58263" },
  { id: "education",     label: "Pendidikan",         amount: 1_460_000, color: "#5C6B4C" },
  { id: "crypto",        label: "Crypto",             amount: 1_090_000, color: "#9A8A55" },
  { id: "laundry",       label: "Laundry",            amount: 320_000,   color: "#6E8A8C" },
  { id: "cigarette",     label: "Rokok",              amount: 540_000,   color: "#9A6B55" },
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

export const TRANSACTIONS = [
  { id: "t01", date: "27 Mei", time: "09:14", merchant: "Kopi Tetangga",         category: "food",          amount: -42_000,     note: "Kopi susu & pastry pagi",      method: "BCA •• 4421" },
  { id: "t02", date: "26 Mei", time: "18:02", merchant: "Stripe — Payout",       category: "freelance",     amount:  9_600_000,  note: "Invoice #1041 — retainer Mar", method: "Bank transfer", income: true },
  { id: "t03", date: "26 Mei", time: "11:38", merchant: "Spotify Family",        category: "entertainment", amount: -59_000,     note: "Langganan bulanan",            method: "Jenius •• 8810" },
  { id: "t04", date: "25 Mei", time: "20:45", merchant: "Gojek",                 category: "transport",     amount: -28_000,     note: "Pulang kantor",                method: "GoPay" },
  { id: "t05", date: "25 Mei", time: "13:22", merchant: "Tokopedia",             category: "shopping",      amount: -285_000,    note: "Kemeja linen — pasir",         method: "Jenius •• 8810" },
  { id: "t06", date: "24 Mei", time: "08:50", merchant: "RS Cipto Mangunkusumo", category: "healthcare",    amount: -850_000,    note: "Medical check-up tahunan",     method: "BCA •• 4421" },
  { id: "t07", date: "24 Mei", time: "07:30", merchant: "PLN — Listrik",         category: "bills",         amount: -420_000,    note: "Auto-pay Mei",                 method: "BCA •• 4421" },
  { id: "t08", date: "23 Mei", time: "22:14", merchant: "Pintu Crypto",          category: "crypto",        amount: -1_800_000,  note: "DCA ETH mingguan",             method: "Jenius •• 8810" },
  { id: "t09", date: "23 Mei", time: "12:05", merchant: "Warung Padang Sabana",  category: "food",          amount: -35_000,     note: "Makan siang",                  method: "Tunai" },
  { id: "t10", date: "22 Mei", time: "16:40", merchant: "PT Acme — Gaji",        category: "salary",        amount:  22_800_000, note: "Gaji Mei — net",               method: "Bank transfer", income: true },
  { id: "t11", date: "23 Mei", time: "09:30", merchant: "Laundry Kilat",         category: "laundry",       amount: -45_000,     note: "Cuci + setrika 3kg",           method: "GoPay" },
  { id: "t12", date: "24 Mei", time: "19:15", merchant: "Indomaret",             category: "cigarette",     amount: -38_000,     note: "Sebungkus",                    method: "Tunai" },
  { id: "t13", date: "22 Mei", time: "12:48", merchant: "GoFood — Sushi Tei",    category: "food",          amount: -127_000,    note: "Makan siang tim",              method: "GoPay" },
  { id: "t14", date: "21 Mei", time: "21:10", merchant: "Grab",                  category: "transport",     amount: -34_000,     note: "Ke stasiun",                   method: "Jenius •• 8810" },
  { id: "t15", date: "21 Mei", time: "15:30", merchant: "Gramedia",              category: "education",     amount: -218_000,    note: "2 buku desain",                method: "BCA •• 4421" },
  { id: "t16", date: "21 Mei", time: "08:05", merchant: "Kopi Tetangga",         category: "food",          amount: -32_000,     note: "Americano",                    method: "GoPay" },
  { id: "t17", date: "20 Mei", time: "19:40", merchant: "CGV Cinemas",           category: "entertainment", amount: -110_000,    note: "2 tiket + popcorn",            method: "Jenius •• 8810" },
  { id: "t18", date: "20 Mei", time: "13:15", merchant: "Warteg Bahari",         category: "food",          amount: -28_000,     note: "Makan siang",                  method: "Tunai" },
  { id: "t19", date: "19 Mei", time: "17:55", merchant: "Alfamart",              category: "snacking",      amount: -64_000,     note: "Cemilan & minuman",            method: "GoPay" },
  { id: "t20", date: "19 Mei", time: "10:20", merchant: "Klien — DP Proyek",     category: "freelance",     amount:  3_500_000,  note: "DP desain brand",              method: "Bank transfer", income: true },
  { id: "t21", date: "18 Mei", time: "20:30", merchant: "Tokopedia",             category: "shopping",      amount: -159_000,    note: "Charger & kabel",              method: "Jenius •• 8810" },
  { id: "t22", date: "18 Mei", time: "12:40", merchant: "Gojek",                 category: "transport",     amount: -22_000,     note: "Ke meeting",                   method: "GoPay" },
  { id: "t23", date: "17 Mei", time: "09:00", merchant: "Laundry Kilat",         category: "laundry",       amount: -52_000,     note: "Bed cover",                    method: "Tunai" },
  { id: "t24", date: "16 Mei", time: "18:25", merchant: "IndiHome",              category: "bills",         amount: -385_000,    note: "Internet Mei",                 method: "BCA •• 4421" },
  { id: "t25", date: "16 Mei", time: "13:10", merchant: "Warung Padang Sabana",  category: "food",          amount: -33_000,     note: "Makan siang",                  method: "Tunai" },
  { id: "t26", date: "15 Mei", time: "19:50", merchant: "Apotek K-24",           category: "healthcare",    amount: -96_000,     note: "Vitamin & masker",             method: "GoPay" },
  { id: "t27", date: "15 Mei", time: "08:40", merchant: "Indomaret",             category: "cigarette",     amount: -38_000,     note: "Sebungkus",                    method: "Tunai" },
  { id: "t28", date: "14 Mei", time: "21:05", merchant: "Netflix",               category: "entertainment", amount: -65_000,     note: "Langganan bulanan",            method: "Jenius •• 8810" },
  { id: "t29", date: "14 Mei", time: "12:30", merchant: "Kopi Kenangan",         category: "snacking",      amount: -42_000,     note: "Kopi sore",                    method: "GoPay" },
  { id: "t30", date: "13 Mei", time: "16:15", merchant: "Shopee",                category: "shopping",      amount: -212_000,    note: "Sepatu lari",                  method: "Jenius •• 8810" },
  { id: "t31", date: "12 Mei", time: "10:45", merchant: "Bunga Deposito",        category: "investment",    amount:  140_000,    note: "Bunga bulanan",                method: "BCA •• 4421", income: true },
  { id: "t32", date: "12 Mei", time: "09:20", merchant: "Transjakarta",          category: "transport",     amount: -7_000,      note: "Komuter",                      method: "GoPay" },
];

export const BUDGETS = [
  { id: "food",          label: "Makanan & Minuman", spent: 3_780_000, limit: 4_000_000, color: "var(--terra)" },
  { id: "transport",     label: "Transportasi",      spent: 1_420_000, limit: 1_800_000, color: "var(--sage)"  },
  { id: "shopping",      label: "Belanja",           spent: 2_840_000, limit: 2_300_000, color: "var(--gold)"  },
  { id: "entertainment", label: "Hiburan",           spent: 1_290_000, limit: 1_500_000, color: "#8C7B5C"      },
];

export const GOALS = [
  { id: "g1", label: "Dana darurat",           current: 28_400_000, target: 45_000_000, deadline: "Des 2026", icon: "emergency", color: "#5C6B4C" },
  { id: "g2", label: "Liburan Kyoto, musim gugur", current: 8_400_000, target: 20_000_000, deadline: "Okt 2026", icon: "travel",    color: "#2A6FDB" },
  { id: "g3", label: "Kamera baru",            current: 4_200_000,  target: 9_800_000,  deadline: "Agt 2026", icon: "gadget",    color: "#C9886D" },
];

export const AI_INSIGHTS = [
  {
    tone: "warn",
    title: "Belanja 23% di atas anggaran",
    body: "Kamu sudah belanja Rp 2.840.000 bulan ini — Rp 540.000 di atas batas Rp 2.300.000. Sebagian besar terjadi di dua akhir pekan terakhir. Pertimbangkan menunda satu pembelian ke Juni.",
    cta: "Atur anggaran",
  },
  {
    tone: "good",
    title: "Pengeluaran makan turun 18% dari April",
    body: "Memasak tiga malam lebih banyak per minggu mulai membuahkan hasil. Dengan pola ini, kamu bisa menghemat sekitar Rp 850.000 sampai akhir bulan.",
    cta: "Lihat kategori",
  },
  {
    tone: "info",
    title: "Goal Kyoto bisa tercapai bulan September",
    body: "Menambahkan Rp 1.200.000/bulan — kira-kira sama dengan rata-rata Spotify + ride-share — akan menutup gap dua bulan lebih awal.",
    cta: "Aktifkan auto-save",
  },
];
