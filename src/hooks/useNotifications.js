import React from 'react';
import { formatNominal } from '../data';

const NOTIF_KEY    = 'notif_data';
const PREFS_KEY    = 'notif_prefs';
const WEEKLY_KEY   = 'notif_weekly_sent';
const INC_IDS_KEY  = 'notif_income_ids';
const BUDGET_KEY   = 'finance_budgets';
const MAX_NOTIFS   = 50;

const DEFAULT_PREFS = { budget: true, income: true, weekly: true, bills: false };

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Senin minggu ini → "2026-06-01"
function thisWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// ── Generate: Peringatan Anggaran ──────────────────────────────────
function budgetNotifs(transactions) {
  const now = new Date();
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const budgets = load(BUDGET_KEY, []).filter(b => b.enabled && b.limit > 0);
  if (!budgets.length) return [];

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
  budgets.forEach(b => {
    const catId   = b.categoryId || fuzzyId(b.label);
    const s       = catId ? (spent[catId] || 0) : 0;
    if (s === 0) return;
    const pct     = s / b.limit;
    const id      = `budget-${pct >= 1 ? 'over' : 'warn'}-${b.id}-${pfx}`;

    if (pct >= 1) {
      notifs.push({ id, type: 'budget', icon: '🚨',
        title: 'Anggaran terlampaui!',
        message: `Anggaran ${b.label} melebihi batas`,
        detail: `Terpakai ${formatNominal(s)} dari ${formatNominal(b.limit)}`,
        read: false, ts: Date.now() });
    } else if (pct >= 0.8) {
      notifs.push({ id, type: 'budget', icon: '⚠️',
        title: 'Peringatan Anggaran',
        message: `Anggaran ${b.label} sudah ${Math.round(pct * 100)}%`,
        detail: `Terpakai ${formatNominal(s)} dari ${formatNominal(b.limit)}`,
        read: false, ts: Date.now() });
    }
  });
  return notifs;
}

// ── Generate: Transaksi Masuk (hari ini saja) ─────────────────────
function incomeNotifs(transactions) {
  const today    = new Date().toISOString().slice(0, 10);
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
        title:   'Transaksi masuk',
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
  const from = lastMon.toISOString().slice(0, 10);
  const to   = sun.toISOString().slice(0, 10);

  const week   = transactions.filter(tx => tx.dateRaw >= from && tx.dateRaw <= to);
  const income = week.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const exp    = week.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  save(WEEKLY_KEY, wKey);
  return [{
    id:      `weekly-${wKey}`,
    type:    'weekly',
    icon:    '📊',
    title:   'Ringkasan Mingguan',
    message: `Masuk ${formatNominal(income)} · Keluar ${formatNominal(exp)}`,
    detail:  `Selisih: ${formatNominal(income - exp)}`,
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
      title:   'Pengingat Tagihan',
      message: 'Jangan lupa catat tagihan bulan ini!',
      detail:  `Bulan lalu kamu punya tagihan ${formatNominal(total)}`,
      read:    false,
      ts:      Date.now(),
    }];
  }
  return [];
}

// ── Hook utama ────────────────────────────────────────────────────

export function useNotifications(transactions, prefs) {
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
      ...(resolvedPrefs.budget  ? budgetNotifs(transactions) : []),
      ...(resolvedPrefs.income  ? incomeNotifs(transactions)  : []),
      ...(resolvedPrefs.weekly  ? weeklyNotif(transactions)   : []),
      ...(resolvedPrefs.bills   ? billsNotif(transactions)    : []),
    ].filter(n => !doneIds.has(n.id));

    if (fresh.length > 0) {
      const updated = [...fresh, ...existing].slice(0, MAX_NOTIFS);
      setNotifs(updated);
      save(NOTIF_KEY, updated);
    }
  }, [transactions, resolvedPrefs]);

  const markAllRead = React.useCallback(() => {
    setNotifs(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      save(NOTIF_KEY, updated);
      return updated;
    });
  }, []);

  const markRead = React.useCallback((id) => {
    setNotifs(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      save(NOTIF_KEY, updated);
      return updated;
    });
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifs([]);
    save(NOTIF_KEY, []);
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

  return { notifications, unreadCount, markAllRead, markRead, clearAll };
}
