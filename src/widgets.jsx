import React from 'react';
import { KPI, CASHFLOW, CATEGORIES, BUDGETS, GOALS, AI_INSIGHTS, fmtShort, fmt } from './data';
import { IconArrowUp, IconArrowDown, IconArrowRight, IconSpark, CatIcon } from './icons';
import { CashflowChart, SpendingDonut, Spark, Ring } from './charts';
import { useIsMobile } from './use-mobile';

export function KpiCards({ balanceVisible, onToggleVisible, totalBalance, accountCount }) {
  const isMobile = useIsMobile();
  const incomeSpark  = CASHFLOW.map(d => d.income);
  const expenseSpark = CASHFLOW.map(d => d.expense);
  const balanceSpark = CASHFLOW.map((d, i, a) => a.slice(0, i + 1).reduce((s, x) => s + (x.income - x.expense), 16000));

  const savingsPct = KPI.savingsTarget > 0 ? Math.round((KPI.savings / KPI.savingsTarget) * 100) : 0;
  const cards = [
    { label: "Total saldo",                       value: totalBalance != null ? totalBalance : KPI.balance, delta: KPI.balanceDelta, hero: true,  spark: balanceSpark,                          color: "var(--ink)",   sub: `dari ${accountCount != null ? accountCount : 3} akun` },
    { label: isMobile ? "Pemasukan"  : "Pemasukan (Mei)",  value: KPI.income,   delta: KPI.incomeDelta,                         spark: incomeSpark,                           color: "var(--sage)",  sub: "gaji + freelance" },
    { label: isMobile ? "Pengeluaran": "Pengeluaran (Mei)", value: KPI.expenses, delta: KPI.expensesDelta, deltaInverted: true,  spark: expenseSpark,                          color: "var(--terra)", sub: "9 kategori" },
    { label: isMobile ? "Tabungan"   : "Tabungan bulan ini", value: KPI.savings, delta: KPI.savingsDelta,                        spark: balanceSpark.slice(-8).map(v => v * 0.07), color: "var(--gold)", sub: isMobile ? `${savingsPct}% • ${fmtShort(KPI.savingsTarget)}` : `${savingsPct}% dari target ${fmtShort(KPI.savingsTarget)}`, progress: KPI.savings / KPI.savingsTarget },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => {
        const positive = c.deltaInverted ? c.delta < 0 : c.delta > 0;
        return (
          <div key={i} className="card rise kpi-card" style={{ padding: isMobile ? 14 : 18, animationDelay: `${i * 0.05}s`, display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12, minHeight: isMobile ? 120 : 156 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
              <div className="kpi-label" style={{ fontSize: isMobile ? 10.5 : 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{c.label}</div>
              {c.hero ? (
                <button className="kpi-hide-btn" onClick={onToggleVisible} style={{ fontSize: 10.5, letterSpacing: ".05em", color: "var(--muted)", background: "transparent", border: 0, padding: 0, textTransform: "uppercase", minHeight: "auto", flexShrink: 0 }}>{balanceVisible ? "Hide" : "Show"}</button>
              ) : (
                !isMobile && <Spark values={c.spark} color={c.color} />
              )}
            </div>

            <div>
              <div className={c.hero ? "serif kpi-hero-val" : "serif kpi-value"} style={{ fontSize: c.hero ? (isMobile ? 22 : 38) : (isMobile ? 18 : (c.value >= 1_000_000 ? 26 : 30)), lineHeight: 1, letterSpacing: "-0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {c.hero && !balanceVisible ? "Rp ••••••" : (c.hero ? fmtShort(c.value) : fmt(c.value))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", minWidth: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: positive ? "rgba(92,107,76,.12)" : "rgba(178,106,74,.12)", color: positive ? "var(--sage)" : "var(--terra)", fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                {c.delta > 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                {Math.abs(c.delta).toFixed(1)}%
              </span>
              <span className="kpi-sub" style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.sub}</span>
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

// Month metadata aligned with CASHFLOW array order
const ID_LABEL = { Jun:"Jun", Jul:"Jul", Aug:"Agu", Sep:"Sep", Oct:"Okt", Nov:"Nov", Dec:"Des", Jan:"Jan", Feb:"Feb", Mar:"Mar", Apr:"Apr", May:"Mei" };
const YEAR_OF  = { Jun:2025, Jul:2025, Aug:2025, Sep:2025, Oct:2025, Nov:2025, Dec:2025, Jan:2026, Feb:2026, Mar:2026, Apr:2026, May:2026 };
const SPENDING_MONTHS = CASHFLOW.map((c, i) => ({ idx: i, abbr: c.m, label: ID_LABEL[c.m], year: YEAR_OF[c.m], expense: c.expense }));

function catsForExpense(monthExpense) {
  const refTotal = CATEGORIES.reduce((s, c) => s + c.amount, 0);
  if (refTotal === 0) return [];
  const k = monthExpense / refTotal;
  return CATEGORIES.map(c => ({ ...c, amount: Math.round(c.amount * k / 1000) * 1000 }))
    .sort((a, b) => b.amount - a.amount);
}

export function SpendingCard() {
  const [hover, setHover] = React.useState(null);
  const [selectedIdx, setSelectedIdx] = React.useState(Math.max(SPENDING_MONTHS.length - 1, 0));
  const [sheetOpen, setSheetOpen] = React.useState(false);

  if (SPENDING_MONTHS.length === 0) {
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

  const selected = SPENDING_MONTHS[selectedIdx];
  const monthCats = catsForExpense(selected.expense);
  const total = monthCats.reduce((s, c) => s + c.amount, 0);

  const years = [2026, 2025]; // tampil 2026 dulu, lalu 2025

  return (
    <>
      <div className="card rise" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Rincian pengeluaran</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Per kategori</div>
          </div>
          <button onClick={() => setSheetOpen(true)} style={ghostBtn}>{selected.label} {selected.year !== 2026 ? selected.year : ""} ▾</button>
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
          <button style={{ ...ghostBtn, marginTop: 4, width: "fit-content", padding: "4px 0", border: 0, background: "transparent", color: "var(--muted)" }}>
            + {monthCats.length - 5} kategori lagi
          </button>
        </div>
      </div>

      {/* Overlay + Bottom Sheet */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "20px 16px 80px", zIndex: 200, maxHeight: "50vh", overflowY: "auto", boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-8px auto 16px" }} />
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Pilih bulan</div>

            {years.map(year => {
              const yearMonths = SPENDING_MONTHS.filter(m => m.year === year);
              if (!yearMonths.length) return null;
              return (
                <div key={year} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{year}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {yearMonths.map(m => {
                      const active = m.idx === selectedIdx;
                      return (
                        <button key={m.idx}
                          onClick={() => { setSelectedIdx(m.idx); setSheetOpen(false); }}
                          style={{ padding: "10px 0", borderRadius: 10, border: active ? 0 : "1px solid var(--line-soft)", background: active ? "var(--ink)" : "var(--paper)", color: active ? "var(--cream)" : "var(--ink)", fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function InsightsCard() {
  const [idx, setIdx] = React.useState(0);

  if (AI_INSIGHTS.length === 0) {
    return (
      <div className="card rise" style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180 }}>
        <span style={{ color: "var(--muted)" }}><IconSpark size={22} /></span>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>Belum ada wawasan AI</div>
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>Tambahkan transaksi dan anggaran agar AI bisa menganalisis pola keuanganmu</div>
      </div>
    );
  }

  const ins = AI_INSIGHTS[idx];
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
        <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Wawasan AI · {idx + 1} dari {AI_INSIGHTS.length}</span>
      </div>

      <div className="serif" style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 10 }}>{ins.title}</div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18, minHeight: 88 }}>{ins.body}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5 }}>
          {ins.cta} <IconArrowRight size={12} />
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {AI_INSIGHTS.map((_, i) => (
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

export function BudgetsCard({ onManage }) {
  const [budgets, setBudgets] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('finance_budgets') || '[]').filter(b => b.enabled); }
    catch { return []; }
  });

  React.useEffect(() => {
    const refresh = () => {
      try { setBudgets(JSON.parse(localStorage.getItem('finance_budgets') || '[]').filter(b => b.enabled)); }
      catch {}
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Anggaran · Mei</div>
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
            const pct = Math.min(b.spent / b.limit, 1.15);
            const over = b.spent > b.limit;
            return (
              <div key={b.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <CatIcon kind={b.id} size={14} /> {b.label}
                  </span>
                  <span className="tnum" style={{ fontSize: 12.5, color: over ? "var(--terra)" : "var(--muted)" }}>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{fmtShort(b.spent)}</span>{" / "}{fmtShort(b.limit)}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : b.color, borderRadius: 99, transition: "width .6s ease" }} />
                  {over && <div style={{ position: "absolute", top: 0, left: "100%", height: "100%", width: `${(pct - 1) * 100}%`, background: "var(--terra)", transform: "translateX(-100%)", opacity: 0.4 }} />}
                </div>
                {over && <div style={{ fontSize: 11, color: "var(--terra)", marginTop: 4 }}>{fmtShort(b.spent - b.limit)} di atas anggaran</div>}
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
