import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, ALL_CATEGORIES, fmtShort, fmt, formatNominal, nominalFontSize } from './data';
import { IconArrowUp, IconArrowDown, IconArrowRight, IconSpark, CatIcon } from './icons';
import { CashflowChart, SpendingDonut, Spark, Ring } from './charts';
import { useIsMobile } from './use-mobile';
import { categoryLabel } from './category-field';
import { usePaywall } from './components/PaywallModal';
import { useMoneyIQ } from './components/MoneyIQChat';
import { MonthYearPicker } from './components/MonthYearPicker';

// Nama bulan singkat terlokalisasi (mengikuti bahasa aktif)
const monthShort = (locale, mo) => new Date(2024, mo, 1).toLocaleDateString(locale, { month: 'short' });
const localeOf = (i18n) => (i18n.language === 'en' ? 'en-US' : 'id-ID');

export function KpiCards({ balanceVisible, onToggleVisible, totalBalance, accountCount, transactions = [] }) {
  const { t: tr, i18n } = useTranslation();
  const isMobile = useIsMobile();

  // Hitung income & expense bulan ini dari transaksi Supabase
  const { income, expenses, catCount } = React.useMemo(() => {
    const now = new Date();
    const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month = transactions.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
    const income   = month.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = month.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const cats = new Set(month.filter(t => t.amount < 0).map(t => t.category));
    return { income, expenses, catCount: cats.size };
  }, [transactions]);

  // Sparkline 8 bulan untuk income/expense
  const sparks = React.useMemo(() => {
    const n = 8;
    const now = new Date();
    const inc = [], exp = [], bal = [];
    let runBal = 0;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pfx = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = transactions.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
      const i_ = m.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const e_ = m.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      inc.push(i_); exp.push(e_); runBal += i_ - e_; bal.push(runBal);
    }
    return { income: inc, expense: exp, balance: bal };
  }, [transactions]);

  const savings  = Math.max(income - expenses, 0);
  const monthName = new Date().toLocaleDateString(localeOf(i18n), { month: 'long' });

  const cards = [
    { label: tr('beranda.totalSaldo'), value: totalBalance ?? 0, delta: 0, hero: true, spark: sparks.balance, color: "var(--ink)", sub: tr('beranda.dariAkun', { count: accountCount ?? 0 }) },
    { label: isMobile ? tr('beranda.pemasukan')   : tr('beranda.pemasukanBulan', { bulan: monthName }),   value: income,   delta: 0, spark: sparks.income,  color: "var(--sage)",  sub: tr('beranda.bulanIni') },
    { label: isMobile ? tr('beranda.pengeluaran') : tr('beranda.pengeluaranBulan', { bulan: monthName }), value: expenses, delta: 0, deltaInverted: true, spark: sparks.expense, color: "var(--terra)", sub: catCount > 0 ? tr('beranda.jumlahKategori', { count: catCount }) : tr('beranda.bulanIni') },
    { label: isMobile ? tr('beranda.selisih') : tr('beranda.selisihBulanIni'), value: income - expenses, delta: 0, spark: [], color: income >= expenses ? "var(--sage)" : "var(--terra)", sub: tr('beranda.pemasukanMinusPengeluaran') },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => {
        const positive = c.deltaInverted ? c.delta < 0 : c.delta > 0;
        return (
          <div key={i} className="card rise kpi-card" style={{ padding: isMobile ? 12 : 18, animationDelay: `${i * 0.05}s`, display: "flex", flexDirection: "column", gap: isMobile ? 6 : 12, minHeight: isMobile ? 0 : 156, overflow: "hidden", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4, minWidth: 0 }}>
              <div className="kpi-label" style={{ fontSize: isMobile ? 10 : 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{c.label}</div>
              {c.hero ? (
                <button className="kpi-hide-btn" onClick={onToggleVisible} style={{ fontSize: 10.5, letterSpacing: ".05em", color: "var(--muted)", background: "transparent", border: 0, padding: 0, textTransform: "uppercase", minHeight: "auto", flexShrink: 0 }}>{balanceVisible ? tr('beranda.hide') : tr('beranda.show')}</button>
              ) : (
                !isMobile && <Spark values={c.spark} color={c.color} />
              )}
            </div>

            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div className={`${c.hero ? "serif kpi-hero-val" : "serif kpi-value"} kpi-nominal`}
                style={{ fontSize: nominalFontSize(c.value, { hero: c.hero, mobile: isMobile }), letterSpacing: "-0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {c.hero && !balanceVisible ? "Rp ••••••" : formatNominal(c.value)}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", minWidth: 0, overflow: "hidden" }}>
              {c.delta !== 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: positive ? "rgba(92,107,76,.12)" : "rgba(178,106,74,.12)", color: positive ? "var(--sage)" : "var(--terra)", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                  {c.delta > 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                  {Math.abs(c.delta).toFixed(1)}%
                </span>
              )}
              <span className="kpi-sub" style={{ fontSize: isMobile ? 10 : 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.sub}</span>
            </div>

            {c.progress != null && (
              <div style={{ height: 4, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${c.progress * 100}%`, background: c.color, borderRadius: 99, transition: "width .6s ease" }} />
              </div>
            )}

            {c.hero && <div style={{ marginTop: 4 }}><Spark values={c.spark} color="var(--ink)" /></div>}
          </div>
        );
      })}
    </div>
  );
}

function computeCashflow(transactions, range, pickedMonth, locale = 'id-ID') {
  if (!transactions || transactions.length === 0) return [];
  const now = new Date();

  if (pickedMonth || range === "1M") {
    const yr  = pickedMonth ? pickedMonth.year  : now.getFullYear();
    const mo  = pickedMonth ? pickedMonth.month : now.getMonth();
    const days = new Date(yr, mo + 1, 0).getDate();
    const pfx  = `${yr}-${String(mo + 1).padStart(2, "0")}-`;
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const iso = pfx + String(day).padStart(2, "0");
      const txs = transactions.filter(t => t.dateRaw === iso);
      const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      return { m: String(day), income, expense, year: yr, month: mo };
    });
  }

  const n = range === "1Y" ? 12 : 6;
  return Array.from({ length: n }, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const pfx = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    const txs = transactions.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
    const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { m: monthShort(locale, mo), income, expense, year: yr, month: mo };
  });
}

export function CashflowCard({ transactions = [] }) {
  const { t: tr, i18n } = useTranslation();
  const locale = localeOf(i18n);
  const [range, setRange] = React.useState("6M");
  const [pickedMonth, setPickedMonth] = React.useState(null); // { year, month }
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const cashflowData = React.useMemo(
    () => computeCashflow(transactions, range, pickedMonth, locale),
    [transactions, range, pickedMonth, locale]
  );

  const hasData = cashflowData.some(d => d.income > 0 || d.expense > 0);

  const pickedLabel = pickedMonth
    ? `${monthShort(locale, pickedMonth.month)} ${pickedMonth.year}`
    : null;

  const isPicked = pickedMonth !== null;

  return (
    <>
      <div className="card rise span-2" style={{ padding: 22 }}>
        <div className="cashflow-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="cashflow-label" style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('beranda.arusKas')}</div>
            <div className="serif cashflow-title" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>{tr('beranda.pemasukanVsPengeluaran')}</div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--sage)", display: "inline-block" }} /> {tr('beranda.pemasukan')}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--terra)", display: "inline-block", borderTop: "2px dashed var(--terra)" }} /> {tr('beranda.pengeluaran')}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {/* Range filter */}
            <div className="cashflow-range-group" style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              {["1M", "6M", "1Y"].map(r => {
                const active = !isPicked && range === r;
                return (
                  <button key={r} onClick={() => { setRange(r); setPickedMonth(null); }} className="cashflow-range-btn"
                    style={{ padding: "5px 12px", fontSize: 12, background: active ? "var(--ivory)" : "transparent", border: active ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: active ? "var(--ink)" : "var(--muted)", fontWeight: active ? 500 : 400 }}>
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Pilih Bulan */}
            <button onClick={() => setSheetOpen(true)}
              style={{ padding: "5px 12px", fontSize: 12, background: isPicked ? "var(--ink)" : "var(--paper)", color: isPicked ? "var(--cream)" : "var(--ink-2)", border: "1px solid var(--line-soft)", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {isPicked ? `${pickedLabel} ▾` : `${tr('beranda.pilihBulan')} ▾`}
            </button>
          </div>
        </div>

        {!hasData ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 160, color: "var(--muted)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            <div style={{ fontSize: 13 }}>{tr('beranda.belumAdaArusKas')}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{tr('beranda.arusKasMuncul')}</div>
          </div>
        ) : (
          <CashflowChart data={cashflowData} />
        )}
      </div>

      <MonthYearPicker
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={(month, year) => setPickedMonth({ year, month })}
        locale={locale}
        initialMonth={pickedMonth?.month}
        initialYear={pickedMonth?.year}
      />
    </>
  );
}

export function SpendingCard({ transactions = [] }) {
  const { t: tr, i18n } = useTranslation();
  const locale = localeOf(i18n);
  const [hover, setHover] = React.useState(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const now = new Date();
  const [sel, setSel] = React.useState({ year: now.getFullYear(), month: now.getMonth() });

  const pfx = `${sel.year}-${String(sel.month + 1).padStart(2, '0')}`;

  const availableMonthsByYear = React.useMemo(() => {
    const map = {};
    transactions.filter(t => t.amount < 0 && t.dateRaw).forEach(t => {
      const [yr, mo] = t.dateRaw.slice(0, 7).split('-');
      const year = +yr, month = +mo - 1;
      if (!map[year]) map[year] = [];
      if (!map[year].includes(month)) map[year].push(month);
    });
    return map;
  }, [transactions]);

  const monthCats = React.useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.amount < 0 && t.dateRaw && t.dateRaw.startsWith(pfx))
      .forEach(t => { map[t.category] = (map[t.category] || 0) + Math.abs(t.amount); });
    return CATEGORIES
      .filter(c => map[c.id])
      .map(c => ({ ...c, amount: map[c.id] }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, pfx]);

  if (monthCats.length === 0) {
    return (
      <div className="card rise" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 200 }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", alignSelf: "flex-start" }}>{tr('beranda.rincianPengeluaran')}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 0" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>{tr('beranda.belumAdaPengeluaran')}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>{tr('beranda.pengeluaranMuncul')}</div>
        </div>
      </div>
    );
  }

  const total = monthCats.reduce((s, c) => s + c.amount, 0);
  const selLabel = `${monthShort(locale, sel.month)} ${sel.year !== now.getFullYear() ? sel.year : ""}`.trim();

  return (
    <>
      <div className="card rise" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('beranda.rincianPengeluaran')}</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>{tr('beranda.perKategori')}</div>
          </div>
          <button onClick={() => setSheetOpen(true)} style={ghostBtn}>{selLabel} ▾</button>
        </div>

        <SpendingDonut data={monthCats} active={hover} onHover={setHover} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {monthCats.slice(0, 5).map((c, i) => (
            <div key={c.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderRadius: 8, background: hover === i ? "var(--paper)" : "transparent" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>{categoryLabel(c, tr)}</span>
              <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round((c.amount / total) * 100)}%</span>
              <span className="tnum" style={{ fontSize: 12, color: "var(--ink)", minWidth: 92, textAlign: "right" }}>{fmtShort(c.amount)}</span>
            </div>
          ))}
          {monthCats.length > 5 && (
            <button style={{ ...ghostBtn, marginTop: 4, width: "fit-content", padding: "4px 0", border: 0, background: "transparent", color: "var(--muted)" }}>
              {tr('beranda.kategoriLagi', { count: monthCats.length - 5 })}
            </button>
          )}
        </div>
      </div>

      <MonthYearPicker
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={(month, year) => setSel({ year, month })}
        locale={locale}
        initialMonth={sel.month}
        initialYear={sel.year}
        availableMonthsByYear={availableMonthsByYear}
      />
    </>
  );
}

function buildInsights(transactions, customCategories, tr, locale) {
  const now = new Date();
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleDateString(locale, { month: 'long' });

  const expTx = transactions.filter(t => t.amount < 0 && t.dateRaw && t.dateRaw.startsWith(pfx));
  if (expTx.length === 0) return [];

  const totalExp = expTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalInc = transactions.filter(t => t.amount > 0 && t.dateRaw && t.dateRaw.startsWith(pfx)).reduce((s, t) => s + t.amount, 0);

  const catMap = {};
  expTx.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const topId  = sorted[0][0];
  const allCats = [...ALL_CATEGORIES, ...customCategories];
  const topCat = allCats.find(c => c.id === topId) || { id: topId, label: topId };
  const topCatName = categoryLabel(topCat, tr);
  const topPct = Math.round((sorted[0][1] / totalExp) * 100);

  // Tiap insight punya `kind` + `data` (dipakai untuk menyusun starter
  // message saat user klik "Tanya Money IQ"). Cara kalkulasi insight TIDAK
  // diubah — hanya ditambah metadata mesin-baca.
  const insights = [
    {
      kind: "top_expense",
      data: { kategori: topCatName, persen: topPct },
      title: tr('insight.pengeluaranTerbesar', { kategori: topCatName }),
      body: tr('insight.pengeluaranTerbesarBody', {
        kategori: topCatName, persen: topPct, bulan: monthName, jumlah: fmt(sorted[0][1]),
        saran: topPct > 40 ? tr('insight.saranKurangi') : tr('insight.saranWajar'),
      }),
      tone: topPct > 40 ? "warn" : "info",
    },
  ];

  if (totalInc > 0) {
    const ratio = totalExp / totalInc;
    insights.push({
      kind: "spending_ratio",
      data: { persen: Math.round(ratio * 100) },
      title: tr('insight.persenTerpakai', { persen: Math.round(ratio * 100) }),
      body: tr('insight.persenTerpakaiBody', {
        masuk: fmt(totalInc), bulan: monthName, keluar: fmt(totalExp),
        saran: ratio > 0.8 ? tr('insight.saranTingkatkanTabungan') : tr('insight.saranTerkontrol'),
      }),
      tone: ratio > 0.8 ? "warn" : "good",
    });
  }

  insights.push({
    kind: "transaction_summary",
    data: { count: expTx.length },
    title: tr('insight.transaksiTercatat', { count: expTx.length }),
    body: tr('insight.transaksiTercatatBody', {
      count: expTx.length, kategori: sorted.length,
      saran: expTx.length >= 10 ? tr('insight.saranKebiasaanBagus') : tr('insight.saranCatatSetiap'),
    }),
    tone: expTx.length >= 10 ? "good" : "info",
  });

  return insights;
}

export function InsightsCard({ transactions = [], customCategories = [], limits = null }) {
  const { t: tr, i18n } = useTranslation();
  const { openPaywall } = usePaywall();
  const { openMoneyIQ } = useMoneyIQ();
  const locale = localeOf(i18n);
  const [idx, setIdx] = React.useState(0);
  const insights = React.useMemo(() => buildInsights(transactions, customCategories, tr, locale), [transactions, customCategories, tr, locale]);
  React.useEffect(() => { setIdx(0); }, [insights.length]);

  // Fitur Pro: basic user melihat placeholder terkunci
  if (limits !== null && !limits.aiInsightsEnabled) {
    return (
      <div className="card rise" onClick={() => openPaywall('Money IQ')}
        style={{ padding: 22, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, minHeight: 180, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 600 }}>Pro</span>
        </div>
        <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{tr('beranda.wawasanAi', { defaultValue: 'Money IQ' })}</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
          {tr('beranda.wawasanAiProDesc', { defaultValue: 'Kartu saran cerdas — analisis pengeluaran, tips menabung, dan prediksi keuangan kamu.' })}
        </div>
        <div style={{ fontSize: 12, color: "var(--gold)", marginTop: 4 }}>Tap untuk mengetahui lebih lanjut →</div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="card rise" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180 }}>
        <span style={{ color: "var(--muted)" }}><IconSpark size={22} /></span>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>{tr('beranda.belumAdaWawasan')}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>{tr('beranda.wawasanMuncul')}</div>
      </div>
    );
  }

  const ins = insights[Math.min(idx, insights.length - 1)];
  const toneColor = ins.tone === "warn" ? "var(--terra)" : ins.tone === "good" ? "var(--sage)" : "var(--gold)";

  // Susun starter message sesuai isi kartu aktif, lalu buka chat Money IQ.
  // Kartu ini hanya render untuk Pro (branch Basic sudah dicegat paywall di
  // atas), jadi klik di sini pasti user Pro.
  const handleAsk = () => {
    const d = ins.data || {};
    let starter;
    if (ins.kind === "spending_ratio") {
      starter = tr('moneyIqChat.starterSpendingRatio', { persen: d.persen });
    } else if (ins.kind === "transaction_summary") {
      starter = tr('moneyIqChat.starterTxSummary', { count: d.count });
    } else {
      starter = tr('moneyIqChat.starterTopExpense', { kategori: d.kategori, persen: d.persen });
    }
    openMoneyIQ({ starter, kind: ins.kind });
  };

  return (
    <div className="card rise" style={{ padding: 22, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--ivory) 0%, var(--paper) 100%)" }}>
      <svg style={{ position: "absolute", top: -20, right: -20, opacity: 0.5, pointerEvents: "none" }} width="160" height="160" viewBox="0 0 160 160">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1={i*22} y1="0" x2="0" y2={i*22} stroke={toneColor} strokeOpacity="0.18" strokeWidth="1" />
        ))}
      </svg>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: toneColor }}><IconSpark size={14} /></span>
        <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('beranda.wawasanAiCounter', { idx: idx + 1, total: insights.length })}</span>
      </div>

      <div className="serif" style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 10 }}>{ins.title}</div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18, minHeight: 88 }}>{ins.body}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={handleAsk} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, cursor: "pointer" }}>
          {tr('insight.tanyaMoneyIq')} <IconArrowRight size={12} />
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {insights.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 22 : 6, height: 6, borderRadius: 99, background: i === idx ? toneColor : "var(--line)", border: 0, padding: 0, transition: "all .25s ease" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SavingsCard({ goals = GOALS, onManage }) {
  const { t: tr } = useTranslation();
  const ringColors = ["var(--sage)", "var(--gold)", "var(--blush)"];
  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('beranda.targetTabungan')}</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: "-0.01em" }}>{tr('beranda.yangKamuKumpulkan')}</div>
        </div>
        <button style={ghostBtn} onClick={onManage}>{tr('umum.kelola')}</button>
      </div>

      {goals.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0 8px", textAlign: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{tr('beranda.belumAdaGoal')}</div>
          <button onClick={onManage} style={{ fontSize: 12, color: "var(--sage)", background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>{tr('beranda.buatGoalPertama')}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.slice(0, 3).map((g, i) => {
            const pct = Math.min(g.current / g.target, 1);
            const col = g.color || ringColors[i % ringColors.length];
            return (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Ring pct={pct} color={col} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{g.label}</span>
                    <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{g.deadline}</span>
                  </div>
                  <div className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{fmtShort(g.current)}</span>{" dari "}{fmtShort(g.target)}
                  </div>
                  <div style={{ marginTop: 6, height: 3, background: "var(--line-soft)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: col, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BudgetsCard({ onManage, transactions = [], budgets: allBudgets = [] }) {
  const { t: tr, i18n } = useTranslation();
  const locale = localeOf(i18n);
  const budgets = allBudgets.filter(b => b.enabled);

  // Hitung pengeluaran aktual per category dari transaksi bulan ini
  const spentByCategory = React.useMemo(() => {
    const now = new Date();
    const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = {};
    transactions.forEach(tx => {
      if (tx.amount < 0 && tx.dateRaw && tx.dateRaw.startsWith(pfx)) {
        map[tx.category] = (map[tx.category] || 0) + Math.abs(tx.amount);
      }
    });
    return map;
  }, [transactions]);

  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
            {tr('beranda.anggaranBulan', { bulan: new Date().toLocaleDateString(locale, { month: 'long' }) })}
          </div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: "-0.01em" }}>{tr('beranda.posisiSekarang')}</div>
        </div>
        <button style={ghostBtn} onClick={onManage}>{tr('umum.atur')}</button>
      </div>

      {budgets.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0 4px", textAlign: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{tr('beranda.belumAdaAnggaranAktif')}</div>
          <button onClick={onManage} style={{ fontSize: 12, color: "var(--sage)", background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>{tr('beranda.aturAnggaran')}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {budgets.slice(0, 4).map(b => {
            const bl = (b.label || '').toLowerCase().trim();
            const matchedCat = !b.categoryId && CATEGORIES.find(c => {
              const cl = c.label.toLowerCase();
              return cl === bl || cl.startsWith(bl) || bl.startsWith(cl.split(' ')[0]);
            });
            const computedSpent = b.categoryId
              ? (spentByCategory[b.categoryId] || 0)
              : matchedCat
                ? (spentByCategory[matchedCat.id] || 0)
                : (b.spent ?? 0);
            const pct = Math.min(computedSpent / b.limit, 1.15);
            const over = computedSpent > b.limit;
            return (
              <div key={b.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <CatIcon kind={b.categoryId || b.id} size={14} /> {b.label}
                  </span>
                  <span className="tnum" style={{ fontSize: 12.5, color: over ? "var(--terra)" : "var(--muted)" }}>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{fmtShort(computedSpent)}</span>{" / "}{fmtShort(b.limit)}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : b.color, borderRadius: 99, transition: "width .6s ease" }} />
                  {over && <div style={{ position: "absolute", top: 0, left: "100%", height: "100%", width: `${(pct - 1) * 100}%`, background: "var(--terra)", transform: "translateX(-100%)", opacity: 0.4 }} />}
                </div>
                {over && <div style={{ fontSize: 11, color: "var(--terra)", marginTop: 4 }}>{tr('beranda.diAtasAnggaran', { jumlah: fmtShort(computedSpent - b.limit) })}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Hutang & Piutang (Beranda) ─────────────────────────────────────
// Hanya muncul bila ada catatan AKTIF. Tap card → buka halaman Hutang/Piutang.
export function DebtsCard({ debts = [], onManage }) {
  // Hanya catatan aktif yang TIDAK terkunci: total & indikator telat bayar
  // konsisten dengan header halaman Hutang/Piutang (catatan terkunci = sisa
  // downgrade Pro→Basic, tidak bisa dikelola, jadi dikeluarkan).
  const active = debts.filter(d => d.status === 'active' && !d.is_locked);
  if (active.length === 0) return null;   // jangan tampilkan card kosong

  const totalReceivable = active.filter(d => d.type === 'receivable').reduce((s, d) => s + d.remaining, 0);
  const totalPayable    = active.filter(d => d.type === 'payable').reduce((s, d) => s + d.remaining, 0);

  // Item terdekat jatuh tempo
  const nearest = active.filter(d => d.due_date).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0] || null;
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let dueLabel = null, dueColor = 'var(--muted)';
  if (nearest) {
    const days = Math.round((new Date(nearest.due_date + 'T00:00:00') - new Date(todayISO + 'T00:00:00')) / 86400000);
    if (days < 0)       { dueLabel = `${nearest.person_name} telat ${Math.abs(days)} hari`; dueColor = 'var(--terra)'; }
    else if (days === 0){ dueLabel = `${nearest.person_name} jatuh tempo hari ini`;         dueColor = 'var(--terra)'; }
    else                { dueLabel = `${nearest.person_name} jatuh tempo ${days} hari lagi`; dueColor = days <= 3 ? 'var(--gold)' : 'var(--muted)'; }
  }

  return (
    <div className="card rise" style={{ padding: 22, cursor: 'pointer' }} onClick={onManage}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Hutang &amp; Piutang</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: '-0.01em' }}>Uang di jalan</div>
        </div>
        <span style={ghostBtn}>Lihat</span>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Piutang</div>
          <div className="serif tnum" style={{ fontSize: 22, letterSpacing: '-0.02em', marginTop: 3, color: 'var(--sage)' }}>{fmt(totalReceivable)}</div>
        </div>
        <div style={{ width: 1, background: 'var(--line-soft)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Hutang</div>
          <div className="serif tnum" style={{ fontSize: 22, letterSpacing: '-0.02em', marginTop: 3, color: 'var(--terra)' }}>{fmt(totalPayable)}</div>
        </div>
      </div>

      {dueLabel && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: dueColor, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: dueColor, flexShrink: 0 }} />
          {dueLabel}
        </div>
      )}
    </div>
  );
}

// ── Ringkasan Mingguan ─────────────────────────────────────────────
// Tanggal LOKAL (bukan toISOString) supaya cocok dgn dateRaw transaksi
// yang disimpan lokal di useTransactions, dan dgn zona WIB.
const pad2 = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Range minggu lalu (Senin–Minggu penuh) + Senin minggu berjalan.
function lastWeekRange(now = new Date()) {
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  const day = mon.getDay() || 7;          // Minggu=7
  mon.setDate(mon.getDate() - day + 1);   // Senin minggu ini
  const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
  const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
  return { thisMon: localISO(mon), from: localISO(lastMon), to: localISO(lastSun), lastMon, lastSun };
}

const WEEKLY_DISMISS_PREFIX = 'weeklyKpiDismissed_';

export function WeeklySummaryCard({ transactions = [], walletId }) {
  const { t: tr, i18n } = useTranslation();
  const locale = localeOf(i18n);

  // Hitung live tiap mount Beranda dari Date saat ini — tidak depend ke
  // notifikasi weeklyNotif lama. Otomatis ganti tiap Senin baru.
  const range = React.useMemo(() => lastWeekRange(), []);
  // walletId disertakan dalam key saat kartu dipakai di Analitik (per-dompet dismiss state);
  // saat dipakai di Beranda (walletId = undefined), format key lama tetap dipakai.
  const dismissKey = WEEKLY_DISMISS_PREFIX + range.thisMon + (walletId !== undefined ? `_${walletId}` : '');

  // Disembunyikan HANYA jika key untuk Senin minggu berjalan SAAT INI ada.
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem(dismissKey) === '1'; } catch { return false; }
  });

  const { income, expenses } = React.useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach(t => {
      if (!t.dateRaw || t.dateRaw < range.from || t.dateRaw > range.to) return;
      if (t.amount > 0) income += t.amount;
      else expenses += Math.abs(t.amount);
    });
    return { income, expenses };
  }, [transactions, range]);

  if (dismissed) return null;

  const net = income - expenses;
  const dismiss = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch {}
    setDismissed(true);
  };

  const dateLabel = `${range.lastMon.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${range.lastSun.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

  const rows = [
    { label: tr('beranda.pemasukan'),   value: income,   color: 'var(--sage)' },
    { label: tr('beranda.pengeluaran'), value: expenses, color: 'var(--terra)' },
    { label: tr('beranda.selisih'),     value: net,      color: net >= 0 ? 'var(--sage)' : 'var(--terra)', strong: true },
  ];

  return (
    <div className="card rise" style={{ padding: 16, position: 'relative' }}>
      <button onClick={dismiss} aria-label={tr('umum.tutup')}
        style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 17, lineHeight: 1, padding: 0 }}>×</button>

      <div style={{ paddingRight: 28 }}>
        <div style={{ fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{tr('beranda.ringkasanMingguan')}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{tr('beranda.mingguLalu')} · {dateLabel}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minWidth: 0, ...(r.strong ? { borderTop: '1px solid var(--line-soft)', paddingTop: 8, marginTop: 2 } : null) }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.label}</span>
            <span className="tnum" style={{ fontSize: r.strong ? 14.5 : 13.5, fontWeight: r.strong ? 600 : 500, color: r.color, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{formatNominal(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ghostBtn = {
  padding: "6px 10px", background: "var(--paper)",
  border: "1px solid var(--line-soft)", borderRadius: 8,
  fontSize: 12, color: "var(--ink-2)",
};
