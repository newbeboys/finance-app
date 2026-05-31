import React from 'react';
import { KPI, CASHFLOW, CATEGORIES, BUDGETS, GOALS, AI_INSIGHTS, fmtShort, fmt } from './data';
import { IconArrowUp, IconArrowDown, IconArrowRight, IconSpark, CatIcon } from './icons';
import { CashflowChart, SpendingDonut, Spark, Ring } from './charts';

export function KpiCards({ balanceVisible, onToggleVisible, totalBalance, accountCount }) {
  const incomeSpark  = CASHFLOW.map(d => d.income);
  const expenseSpark = CASHFLOW.map(d => d.expense);
  const balanceSpark = CASHFLOW.map((d, i, a) => a.slice(0, i + 1).reduce((s, x) => s + (x.income - x.expense), 16000));

  const cards = [
    { label: "Total saldo", value: totalBalance != null ? totalBalance : KPI.balance, delta: KPI.balanceDelta, hero: true, spark: balanceSpark, color: "var(--ink)", sub: `dari ${accountCount != null ? accountCount : 3} akun` },
    { label: "Pemasukan (Mei)", value: KPI.income, delta: KPI.incomeDelta, spark: incomeSpark, color: "var(--sage)", sub: "gaji + freelance" },
    { label: "Pengeluaran (Mei)", value: KPI.expenses, delta: KPI.expensesDelta, deltaInverted: true, spark: expenseSpark, color: "var(--terra)", sub: "9 kategori" },
    { label: "Tabungan bulan ini", value: KPI.savings, delta: KPI.savingsDelta, spark: balanceSpark.slice(-8).map(v => v * 0.07), color: "var(--gold)", sub: `${Math.round((KPI.savings / KPI.savingsTarget) * 100)}% dari target ${fmtShort(KPI.savingsTarget)}`, progress: KPI.savings / KPI.savingsTarget },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 16 }}>
      {cards.map((c, i) => {
        const positive = c.deltaInverted ? c.delta < 0 : c.delta > 0;
        return (
          <div key={i} className="card rise" style={{ padding: 18, animationDelay: `${i * 0.05}s`, display: "flex", flexDirection: "column", gap: 12, minHeight: 156 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{c.label}</div>
              {c.hero ? (
                <button onClick={onToggleVisible} style={{ fontSize: 10.5, letterSpacing: ".05em", color: "var(--muted)", background: "transparent", border: 0, padding: 0, textTransform: "uppercase" }}>{balanceVisible ? "Hide" : "Show"}</button>
              ) : (
                <Spark values={c.spark} color={c.color} />
              )}
            </div>

            <div>
              <div className="serif" style={{ fontSize: c.hero ? 38 : c.value >= 1_000_000 ? 26 : 30, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {c.hero && !balanceVisible ? "Rp • • • • • • • •" : (c.hero ? fmtShort(c.value) : fmt(c.value))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: positive ? "rgba(92,107,76,.12)" : "rgba(178,106,74,.12)", color: positive ? "var(--sage)" : "var(--terra)", fontSize: 11, fontWeight: 500 }}>
                {c.delta > 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                {Math.abs(c.delta).toFixed(1)}%
              </span>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.sub}</span>
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

export function CashflowCard() {
  const [range, setRange] = React.useState("1Y");
  const ranges = ["3M", "6M", "1Y"];

  return (
    <div className="card rise" style={{ padding: 22, gridColumn: "span 2" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Arus kas</div>
          <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Pemasukan vs. pengeluaran</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--sage)", display: "inline-block" }} /> Pemasukan</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 2, background: "var(--terra)", display: "inline-block" }} /> Pengeluaran</span>
          </div>
        </div>
        <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: "5px 12px", fontSize: 12, background: range === r ? "var(--ivory)" : "transparent", border: range === r ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: range === r ? "var(--ink)" : "var(--muted)", fontWeight: range === r ? 500 : 400 }}>{r}</button>
          ))}
        </div>
      </div>
      <CashflowChart data={CASHFLOW} range={range} />
    </div>
  );
}

export function SpendingCard() {
  const [hover, setHover] = React.useState(null);
  const total = CATEGORIES.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Rincian pengeluaran</div>
          <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Per kategori</div>
        </div>
        <button style={ghostBtn}>Mei ▾</button>
      </div>

      <SpendingDonut data={CATEGORIES} active={hover} onHover={setHover} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {CATEGORIES.slice(0, 5).map((c, i) => (
          <div key={c.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderRadius: 8, background: hover === i ? "var(--paper)" : "transparent" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>{c.label}</span>
            <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round((c.amount / total) * 100)}%</span>
            <span className="tnum" style={{ fontSize: 12, color: "var(--ink)", minWidth: 92, textAlign: "right" }}>{fmtShort(c.amount)}</span>
          </div>
        ))}
        <button style={{ ...ghostBtn, marginTop: 4, width: "fit-content", padding: "4px 0", border: 0, background: "transparent", color: "var(--muted)" }}>
          + {CATEGORIES.length - 5} kategori lagi
        </button>
      </div>
    </div>
  );
}

export function InsightsCard() {
  const [idx, setIdx] = React.useState(0);
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
    </div>
  );
}

export function BudgetsCard({ onManage }) {
  return (
    <div className="card rise" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Anggaran · Mei</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 2, letterSpacing: "-0.01em" }}>Posisi kamu sekarang</div>
        </div>
        <button style={ghostBtn} onClick={onManage}>Atur</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {BUDGETS.map(b => {
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
    </div>
  );
}

export const ghostBtn = {
  padding: "6px 10px", background: "var(--paper)",
  border: "1px solid var(--line-soft)", borderRadius: 8,
  fontSize: 12, color: "var(--ink-2)",
};
