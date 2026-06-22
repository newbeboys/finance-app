import React from 'react';
import { formatNominal } from '../data';
import { playSound } from '../lib/sound';
import notifSound from '../assets/sound/notification-sound.mp3';

const NOTIF_KEY    = 'notif_data';
const PREFS_KEY    = 'notif_prefs';
const WEEKLY_KEY   = 'notif_weekly_sent';
const INC_IDS_KEY  = 'notif_income_ids';
const MAX_NOTIFS   = 50;
const READ_RETENTION_MS = 5 * 24 * 60 * 60 * 1000; // notif sudah dibaca > 5 hari → dihapus

const DEFAULT_PREFS = { budget: true, income: true, weekly: true, bills: false };

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Tanggal LOKAL "YYYY-MM-DD" (bukan toISOString yang berbasis UTC).
// Wajib lokal supaya cocok dgn tx.dateRaw yang juga disimpan lokal
// (useTransactions) — di zona WIB toISOString menggeser tanggal 1 hari.
// Pola sama dgn WeeklySummaryCard di widgets.jsx.
const pad2 = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Senin minggu ini → "2026-06-22"
function thisWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return localISO(d);
}

// ── Generate: Peringatan Anggaran ──────────────────────────────────
function budgetNotifs(transactions, budgets) {
  const now = new Date();
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const activeBudgets = (budgets || []).filter(b => b.enabled && b.limit > 0);
  if (!activeBudgets.length) return [];

  // Hitung pengeluaran bulan ini per categoryId
  const spent = {};
  transactions.forEach(tx => {
    if (tx.amount < 0 && tx.dateRaw?.startsWith(pfx)) {
      spent[tx.category] = (spent[tx.category] || 0) + Math.abs(tx.amount);
    }
  });

  // Fuzzy match untuk budget lama tanpa categoryId
  const CATS = ['food','transport','shopping','bills','entertainment','healthcare','snacking','education','crypto','laundry','cigarette'];
  const MONTH_MAP = { jan:0,feb:1,mar:2,apr:3,mei:4,jun:5,jul:6,agu:7,ags:7,sep:8,okt:9,nov:10,des:11 };
  const fuzzyId = (label) => {
    const bl = (label || '').toLowerCase().trim();
    // Simple check: if label is a standard id
    if (CATS.includes(bl)) return bl;
    // Partial match
    const found = CATS.find(id => id.startsWith(bl.split(' ')[0]) || bl.startsWith(id.split(' ')[0]));
    return found || null;
  };

  const notifs = [];
  activeBudgets.forEach(b => {
    const catId   = b.categoryId || fuzzyId(b.label);
    const s       = catId ? (spent[catId] || 0) : 0;
    if (s === 0) return;
    const pct     = s / b.limit;
    const id      = `budget-${pct >= 1 ? 'over' : 'warn'}-${b.id}-${pfx}`;

    if (pct >= 1) {
      notifs.push({ id, type: 'budget', icon: '🚨',
        titleKey: 'notifikasi.anggaranTerlampaui',
        msgKey: 'notifikasi.anggaranMelebihi', msgParams: { label: b.label },
        detailKey: 'notifikasi.terpakaiDari', detailParams: { terpakai: formatNominal(s), batas: formatNominal(b.limit) },
        read: false, ts: Date.now() });
    } else if (pct >= 0.8) {
      notifs.push({ id, type: 'budget', icon: '⚠️',
        titleKey: 'notifikasi.peringatanAnggaran',
        msgKey: 'notifikasi.anggaranPersen', msgParams: { label: b.label, persen: Math.round(pct * 100) },
        detailKey: 'notifikasi.terpakaiDari', detailParams: { terpakai: formatNominal(s), batas: formatNominal(b.limit) },
        read: false, ts: Date.now() });
    }
  });
  return notifs;
}

// ── Generate: Transaksi Masuk (hari ini saja) ─────────────────────
function incomeNotifs(transactions) {
  const today    = localISO(new Date()); // tanggal lokal — bukan UTC (lihat thisWeekKey)
  const done     = new Set(load(INC_IDS_KEY, []));
  const notifs   = [];

  transactions
    .filter(tx => tx.amount > 0 && tx.dateRaw === today && !done.has(tx.id))
    .forEach(tx => {
      done.add(tx.id);
      notifs.push({
        id:      `income-${tx.id}`,
        type:    'income',
        icon:    '💰',
        titleKey: 'notifikasi.transaksiMasuk',
        // Nominal & data merchant/tanggal bukan teks yang perlu diterjemahkan
        message: `+${formatNominal(tx.amount)}`,
        detail:  `${tx.merchant} · ${tx.date}`,
        read:    false,
        ts:      Date.now(),
      });
    });

  if (notifs.length) save(INC_IDS_KEY, [...done].slice(-200));
  return notifs;
}

// ── Generate: Ringkasan Mingguan (Senin saja) ─────────────────────
function weeklyNotif(transactions) {
  const now = new Date();
  if (now.getDay() !== 1) return []; // bukan Senin

  const wKey = thisWeekKey();
  if (load(WEEKLY_KEY, null) === wKey) return []; // sudah dikirim minggu ini

  const mon  = new Date(wKey + 'T00:00:00');
  const sun  = new Date(mon); sun.setDate(mon.getDate() - 1);
  const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
  const from = localISO(lastMon);
  const to   = localISO(sun);

  const week   = transactions.filter(tx => tx.dateRaw >= from && tx.dateRaw <= to);
  const income = week.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const exp    = week.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  save(WEEKLY_KEY, wKey);
  return [{
    id:      `weekly-${wKey}`,
    type:    'weekly',
    icon:    '📊',
    titleKey: 'notifikasi.ringkasanMingguan',
    msgKey:  'notifikasi.ringkasanMasukKeluar', msgParams: { masuk: formatNominal(income), keluar: formatNominal(exp) },
    detailKey: 'notifikasi.selisih', detailParams: { jumlah: formatNominal(income - exp) },
    read:    false,
    ts:      Date.now(),
  }];
}

// ── Generate: Pengingat Tagihan ───────────────────────────────────
function billsNotif(transactions) {
  const now     = new Date();
  const curPfx  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMo  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastPfx = `${lastMo.getFullYear()}-${String(lastMo.getMonth() + 1).padStart(2, '0')}`;

  const curBills  = transactions.filter(t => t.amount < 0 && t.category === 'bills' && t.dateRaw?.startsWith(curPfx));
  const lastBills = transactions.filter(t => t.amount < 0 && t.category === 'bills' && t.dateRaw?.startsWith(lastPfx));

  if (curBills.length === 0 && lastBills.length > 0) {
    const total = lastBills.reduce((s, t) => s + Math.abs(t.amount), 0);
    return [{
      id:      `bills-${curPfx}`,
      type:    'bills',
      icon:    '🔔',
      titleKey: 'notifikasi.pengingatTagihan',
      msgKey:  'notifikasi.janganLupaTagihan',
      detailKey: 'notifikasi.bulanLaluTagihan', detailParams: { jumlah: formatNominal(total) },
      read:    false,
      ts:      Date.now(),
    }];
  }
  return [];
}

// ── Hook utama ────────────────────────────────────────────────────

export function useNotifications(transactions, prefs, budgets) {
  const [notifs, setNotifs] = React.useState(() => load(NOTIF_KEY, []));

  // Merge passed prefs with defaults (falls back to localStorage if not passed)
  const resolvedPrefs = React.useMemo(() => ({
    ...DEFAULT_PREFS,
    ...(prefs ?? load(PREFS_KEY, {})),
  }), [prefs]);

  React.useEffect(() => {
    if (!transactions || transactions.length === 0) return;

    const existing = load(NOTIF_KEY, []);
    const doneIds  = new Set(existing.map(n => n.id));

    const fresh = [
      ...(resolvedPrefs.budget  ? budgetNotifs(transactions, budgets) : []),
      ...(resolvedPrefs.income  ? incomeNotifs(transactions)           : []),
      ...(resolvedPrefs.weekly  ? weeklyNotif(transactions)            : []),
      ...(resolvedPrefs.bills   ? billsNotif(transactions)             : []),
    ].filter(n => !doneIds.has(n.id));

    if (fresh.length > 0) {
      const updated = [...fresh, ...existing].slice(0, MAX_NOTIFS);
      setNotifs(updated);
      save(NOTIF_KEY, updated);
      // Sound notifikasi — volume pelan & hanya saat tab di foreground
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        playSound(notifSound, 0.5);
      }
    }
  }, [transactions, resolvedPrefs, budgets]);

  const markAllRead = React.useCallback(() => {
    const now = Date.now();
    setNotifs(prev => {
      // read_at hanya di-set untuk yang belum punya → jam retensi 5 hari
      // dihitung dari saat PERTAMA ditandai dibaca (tidak menimpa nilai lama).
      const updated = prev.map(n => ({ ...n, read: true, read_at: n.read_at ?? now }));
      save(NOTIF_KEY, updated);
      return updated;
    });
  }, []);

  const markRead = React.useCallback((id) => {
    const now = Date.now();
    setNotifs(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true, read_at: n.read_at ?? now } : n);
      save(NOTIF_KEY, updated);
      return updated;
    });
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifs([]);
    save(NOTIF_KEY, []);
  }, []);

  // Cleanup: hard-delete notif yang SUDAH DIBACA dan read_at-nya > 5 hari lalu.
  // Notif belum dibaca (read=false) TIDAK PERNAH dihapus — keputusan produk.
  // read_at = epoch ms (konsisten dgn `ts`); selisih umur tz-safe, tanpa
  // toISOString (lihat memori proyek). Dipanggil saat panel dibuka (TopBar).
  const cleanupExpired = React.useCallback(() => {
    const cutoff = Date.now() - READ_RETENTION_MS;
    setNotifs(prev => {
      const kept = prev.filter(n => !(n.read && n.read_at && n.read_at <= cutoff));
      if (kept.length === prev.length) return prev; // tidak ada yg kedaluwarsa → no-op
      save(NOTIF_KEY, kept);
      return kept;
    });
  }, []);

  // Only show notifications from categories the user has enabled
  const notifications = notifs.filter(n => {
    if (n.type === 'budget')  return resolvedPrefs.budget;
    if (n.type === 'income')  return resolvedPrefs.income;
    if (n.type === 'weekly')  return resolvedPrefs.weekly;
    if (n.type === 'bills')   return resolvedPrefs.bills;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, markAllRead, markRead, clearAll, cleanupExpired };
}
