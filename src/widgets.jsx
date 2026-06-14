import React from 'react';
import { CATEGORIES, ALL_CATEGORIES, fmtShort, fmt, formatNominal, nominalFontSize } from './data';
import { IconArrowUp, IconArrowDown, IconArrowRight, IconSpark, CatIcon } from './icons';
import { CashflowChart, SpendingDonut, Spark, Ring } from './charts';
import { useIsMobile } from './use-mobile';
import { useScrollLock } from './hooks/useScrollLock';

export function KpiCards({ balanceVisible, onToggleVisible, totalBalance, accountCount, transactions = [] }) {
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
  const monthName = new Date().toLocaleDateString('id-ID', { month: 'long' });

  const cards = [
    { label: "Total saldo", value: totalBalance ?? 0, delta: 0, hero: true, spark: sparks.balance, color: "var(--ink)", sub: `dari ${accountCount ?? 0} akun` },
    { label: isMobile ? "Pemasukan"   : `Pemasukan (${monthName})`,   value: income,   delta: 0, spark: sparks.income,  color: "var(--sage)",  sub: "bulan ini" },
    { label: isMobile ? "Pengeluaran" : `Pengeluaran (${monthName})`, value: expenses, delta: 0, deltaInverted: true, spark: sparks.expense, color: "var(--terra)", sub: catCount > 0 ? `${catCount} kategori` : "bulan ini" },
    { label: isMobile ? "Selisih" : "Selisih bulan ini", value: income - expenses, delta: 0, spark: [], color: income >= expenses ? "var(--sage)" : "var(--terra)", sub: "pemasukan − pengeluaran" },
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
                <button className="kpi-hide-btn" onClick={onToggleVisible} style={{ fontSize: 10.5, letterSpacing: ".05em", color: "var(--muted)", background: "transparent", border: 0, padding: 0, textTransform: "uppercase", minHeight: "auto", flexShrink: 0 }}>{balanceVisible ? "Hide" : "Show"}</button>
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

const CF_MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function computeCashflow(transactions, range, pickedMonth) {
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
    return { m: CF_MONTHS[mo], income, expense, year: yr, month: mo };
  });
}

export function CashflowCard({ transactions = [] }) {
  const [range, setRange] = React.useState("6M");
  const [pickedMonth, setPickedMonth] = React.useState(null); // { year, month }
  const [sheetOpen, setSheetOpen] = React.useState(false);
  useScrollLock(sheetOpen);   // kunci scroll latar saat bottom-sheet "Pilih Bulan" terbuka

  const cashflowData = React.useMemo(
    () => computeCashflow(transactions, range, pickedMonth),
    [transactions, range, pickedMonth]
  );

  const hasData = cashflowData.some(d => d.income > 0 || d.expense > 0);

  // Daftar 24 bulan terakhir untuk Pilih Bulan sheet
  const pickerMonths = React.useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    // Kelompokkan per tahun, terbaru di atas
    const byYear = {};
    list.forEach(m => { (byYear[m.year] ||= []).push(m); });
    return Object.entries(byYear).sort((a, b) => b[0] - a[0]);
  }, []);

  const pickedLabel = pickedMonth
    ? `${CF_MONTHS[pickedMonth.month]} ${pickedMonth.year}`
    : null;

  const isPicked = pickedMonth !== null;

  return (
    <>
      <div className="card rise span-2" style={{ padding: 22 }}>
        <div className="cashflow-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="cashflow-label" style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Arus kas</div>
            <div className="serif cashflow-title" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Pemasukan vs. pengeluaran</div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--sage)", display: "inline-block" }} /> Pemasukan</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--terra)", display: "inline-block", borderTop: "2px dashed var(--terra)" }} /> Pengeluaran</span>
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
              {isPicked ? `${pickedLabel} ▾` : "Pilih Bulan ▾"}
            </button>
          </div>
        </div>

        {!hasData ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 160, color: "var(--muted)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            <div style={{ fontSize: 13 }}>Belum ada data arus kas</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Data akan muncul setelah kamu menambahkan transaksi</div>
          </div>
        ) : (
          <CashflowChart data={cashflowData} />
        )}
      </div>

      {/* Bottom Sheet — Pilih Bulan */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "20px 16px 80px", zIndex: 200, maxHeight: "55vh", overflowY: "auto", boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-8px auto 16px" }} />
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Pilih bulan</div>

            {pickerMonths.map(([year, months]) => (
              <div key={year} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{year}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {months.map(m => {
                    const active = pickedMonth?.year === m.year && pickedMonth?.month === m.month;
                    return (
                      <button key={`${m.year}-${m.month}`}
                        onClick={() => { setPickedMonth(m); setSheetOpen(false); }}
                        style={{ padding: "10px 0", borderRadius: 10, border: active ? 0 : "1px solid var(--line-soft)", background: active ? "var(--ink)" : "var(--paper)", color: active ? "var(--cream)" : "var(--ink)", fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                        {CF_MONTHS[m.month]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const SP_MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export function SpendingCard({ transactions = [] }) {
  const [hover, setHover] = React.useState(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  useScrollLock(sheetOpen);   // kunci scroll latar saat bottom-sheet "Pilih Bulan" terbuka
  const now = new Date();
  const [sel, setSel] = React.useState({ year: now.getFullYear(), month: now.getMonth() });

  // Bulan yang punya data expense
  const monthsWithData = React.useMemo(() => {
    const set = new Set();
    transactions.filter(t => t.amount < 0 && t.dateRaw).forEach(t => set.add(t.dateRaw.slice(0, 7)));
    return Array.from(set).sort().reverse().map(s => {
      const [yr, mo] = s.split('-');
      return { year: +yr, month: +mo - 1 };
    });
  }, [transactions]);

  const pfx = `${sel.year}-${String(sel.month + 1).padStart(2, '0')}`;

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
        <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", alignSelf: "flex-start" }}>Rincian pengeluaran</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 0" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>Belum ada data pengeluaran</div>
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>Mulai tambahkan transaksi untuk melihat rincian per kategori</div>
        </div>
      </div>
    );
  }

  const total = monthCats.reduce((s, c) => s + c.amount, 0);
  const selLabel = `${SP_MONTHS_ID[sel.month]} ${sel.year !== now.getFullYear() ? sel.year : ""}`.trim();

  const byYear = {};
  monthsWithData.forEach(m => { (byYear[m.year] ||= []).push(m); });

  return (
    <>
      <div className="card rise" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Rincian pengeluaran</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Per kategori</div>
          </div>
          <button onClick={() => setSheetOpen(true)} style={ghostBtn}>{selLabel} ▾</button>
        </div>

        <SpendingDonut data={monthCats} active={hover} onHover={setHover} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {monthCats.slice(0, 5).map((c, i) => (
            <div key={c.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderRadius: 8, background: hover === i ? "var(--paper)" : "transparent" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>{c.label}</span>
              <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round((c.amount / total) * 100)}%</span>
              <span className="tnum" style={{ fontSize: 12, color: "var(--ink)", minWidth: 92, textAlign: "right" }}>{fmtShort(c.amount)}</span>
            </div>
          ))}
          {monthCats.length > 5 && (
            <button style={{ ...ghostBtn, marginTop: 4, width: "fit-content", padding: "4px 0", border: 0, background: "transparent", color: "var(--muted)" }}>
              + {monthCats.length - 5} kategori lagi
            </button>
          )}
        </div>
      </div>

      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "20px 16px 80px", zIndex: 200, maxHeight: "50vh", overflowY: "auto", boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-8px auto 16px" }} />
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Pilih bulan</div>
            {Object.entries(byYear).sort((a, b) => b[0] - a[0]).map(([yr, months]) => (
              <div key={yr} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{yr}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {months.map(m => {
                    const active = m.year === sel.year && m.month === sel.month;
                    return (
                      <button key={`${m.year}-${m.month}`}
                        onClick={() => { setSel(m); setSheetOpen(false); }}
                        style={{ padding: "10px 0", borderRadius: 10, border: active ? 0 : "1px solid var(--line-soft)", background: active ? "var(--ink)" : "var(--paper)", color: active ? "var(--cream)" : "var(--ink)", fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                        {SP_MONTHS_ID[m.month]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function buildInsights(transactions, customCategories = []) {
  const now = new Date();
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleDateString('id-ID', { month: 'long' });

  const expTx = transactions.filter(t => t.amount < 0 && t.dateRaw && t.dateRaw.startsWith(pfx));
  if (expTx.length === 0) return [];

  const totalExp = expTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalInc = transactions.filter(t => t.amount > 0 && t.dateRaw && t.dateRaw.startsWith(pfx)).reduce((s, t) => s + t.amount, 0);

  const catMap = {};
  expTx.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const topId  = sorted[0][0];
  const allCats = [...ALL_CATEGORIES, ...customCategories];
  const topCat = allCats.find(c => c.id === topId) || { label: topId };
  const topPct = Math.round((sorted[0][1] / totalExp) * 100);

  const insights = [
    {
      title: `Pengeluaran terbesar: ${topCat.label}`,
      body: `${topCat.label} menyumbang ${topPct}% dari total pengeluaran ${monthName} (${fmt(sorted[0][1])}). ${topPct > 40 ? "Pertimbangkan untuk mengurangi anggaran di kategori ini." : "Proporsinya masih dalam batas yang wajar."}`,
      cta: "Lihat anggaran",
      tone: topPct > 40 ? "warn" : "info",
    },
  ];

  if (totalInc > 0) {
    const ratio = totalExp / totalInc;
    insights.push({
      title: `${Math.round(ratio * 100)}% pendapatan terpakai`,
      body: `Dari ${fmt(totalInc)} yang masuk ${monthName}, kamu menghabiskan ${fmt(totalExp)}. ${ratio > 0.8 ? "Coba tingkatkan porsi tabungan bulan depan." : "Pengeluaranmu masih terkontrol dengan baik!"}`,
      cta: "Lihat detail",
      tone: ratio > 0.8 ? "warn" : "good",
    });
  }

  insights.push({
    title: `${expTx.length} transaksi tercatat`,
    body: `Kamu sudah mencatat ${expTx.length} transaksi pengeluaran di ${sorted.length} kategori bulan ini. ${expTx.length >= 10 ? "Kebiasaan mencatat yang bagus — terus pertahankan!" : "Catat setiap pengeluaran untuk analisis yang lebih akurat."}`,
    cta: "Tambah transaksi",
    tone: expTx.length >= 10 ? "good" : "info",
  });

  return insights;
}

export function InsightsCard({ transactions = [], customCategories = [] }) {
  const [idx, setIdx] = React.useState(0);
  const insights = React.useMemo(() => buildInsights(transactions, customCategories), [transactions, customCategories]);
  React.useEffect(() => { setIdx(0); }, [insights.length]);

  if (insights.length === 0) {
    return (
      <div className="card rise" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180 }}>
        <span style={{ color: "var(--muted)" }}><IconSpark size={22} /></span>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>Belum ada wawasan AI</div>
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>Tambahkan transaksi dan anggaran agar AI bisa menganalisis pola keuanganmu</div>
      </div>
    );
  }

  const ins = insights[Math.min(idx, insights.length - 1)];
  const toneColor = ins.tone === "warn" ? "var(--terra)" : ins.tone === "good" ? "var(--sage)" : "var(--gold)";

  return (
    <div className="card rise" style={{ padding: 22, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, var(--ivory) 0%, var(--paper) 100%)" }}>
      <svg style={{ position: "absolute", top: -20, right: -20, opacity: 0.5, pointerEvents: "none" }} width="160" height="160" viewBox="0 0 160 160">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1={i*22} y1="0" x2="0" y2={i*22} stroke={toneColor} strokeOpacity="0.18" strokeWidth="1" />
        ))}
      </svg>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: toneColor }}><IconSpark size={14} /></span>
        <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Wawasan AI · {idx + 1} dari {insights.length}</span>
      </div>

      <div className="serif" style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 10 }}>{ins.title}</div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18, minHeight: 88 }}>{ins.body}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5 }}>
          {ins.cta} <IconArrowRight size={12} />
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
  const ringColors = ["var(--sage)", "var(--gold)", "var(--blush)"];
  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Target tabungan</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: "-0.01em" }}>Yang sedang kamu kumpulkan</div>
        </div>
        <button style={ghostBtn} onClick={onManage}>Kelola</button>
      </div>

      {goals.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0 8px", textAlign: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Belum ada goal tabungan</div>
          <button onClick={onManage} style={{ fontSize: 12, color: "var(--sage)", background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>Buat goal pertama</button>
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
            Anggaran · {new Date().toLocaleDateString('id-ID', { month: 'long' })}
          </div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: "-0.01em" }}>Posisi kamu sekarang</div>
        </div>
        <button style={ghostBtn} onClick={onManage}>Atur</button>
      </div>

      {budgets.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 0 4px", textAlign: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Belum ada anggaran aktif</div>
          <button onClick={onManage} style={{ fontSize: 12, color: "var(--sage)", background: "transparent", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>Atur anggaran</button>
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
                {over && <div style={{ fontSize: 11, color: "var(--terra)", marginTop: 4 }}>{fmtShort(computedSpent - b.limit)} di atas anggaran</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ghostBtn = {
  padding: "6px 10px", background: "var(--paper)",
  border: "1px solid var(--line-soft)", borderRadius: 8,
  fontSize: 12, color: "var(--ink-2)",
};
