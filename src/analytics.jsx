import React from 'react';
import { CATEGORIES, fmt, fmtShort, formatNominal, nominalFontSize } from './data';
import { IconArrowDown } from './icons';
import { SpendingDonut } from './charts';

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// ── Helpers ───────────────────────────────────────────────────────────

function computeBarData(transactions, scope, pickedMonth) {
  const now = new Date();

  if (scope === "month") {
    const yr = pickedMonth?.year  ?? now.getFullYear();
    const mo = pickedMonth?.month ?? now.getMonth();
    const days = new Date(yr, mo + 1, 0).getDate();
    const pfx  = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const iso = pfx + String(day).padStart(2, '0');
      const txs = transactions.filter(t => t.dateRaw === iso);
      const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      return { m: String(day), income, expense, year: yr, month: mo };
    });
  }

  // "year" → last 12 months grouped by month
  return Array.from({ length: 12 }, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const yr = d.getFullYear(), mo = d.getMonth();
    const pfx = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    const txs = transactions.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
    const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { m: MONTHS_ID[mo], income, expense, year: yr, month: mo };
  });
}

function computeCatData(transactions, scope, pickedMonth) {
  const now = new Date();
  let txs;

  if (scope === "month") {
    const yr  = pickedMonth?.year  ?? now.getFullYear();
    const mo  = pickedMonth?.month ?? now.getMonth();
    const pfx = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    txs = transactions.filter(t => t.amount < 0 && t.dateRaw && t.dateRaw.startsWith(pfx));
  } else {
    const oldest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const cutoff = `${oldest.getFullYear()}-${String(oldest.getMonth() + 1).padStart(2, '0')}`;
    txs = transactions.filter(t => t.amount < 0 && t.dateRaw && t.dateRaw.slice(0, 7) >= cutoff);
  }

  const map = {};
  txs.forEach(t => { map[t.category] = (map[t.category] || 0) + Math.abs(t.amount); });
  return CATEGORIES
    .filter(c => map[c.id])
    .map(c => ({ ...c, amount: map[c.id] }))
    .sort((a, b) => b.amount - a.amount);
}

// ── Bar Chart ─────────────────────────────────────────────────────────

function BarChart({ data }) {
  const [hover, setHover] = React.useState(null);
  if (!data || data.length === 0) return null;

  const W = 760, H = 280, P = { t: 16, r: 12, b: 36, l: 52 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;

  const rawMax = Math.max(...data.map(d => Math.max(d.income || 0, d.expense || 0)));
  const base   = rawMax < 1_000_000 ? 500_000 : 5_000_000;
  const max    = rawMax === 0 ? base : Math.ceil(rawMax / base) * base + base;
  const fmtY   = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : `${(v / 1_000).toFixed(0)}rb`;

  const groupW = innerW / data.length;
  const barW   = Math.min(16, Math.max(4, groupW / 3));
  const y      = (v) => P.t + innerH - ((v || 0) / max) * innerH;

  // For daily mode (>12 points), only label every 5th day
  const showLabel = (i) => data.length <= 12 || i % 5 === 0 || i === data.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const v = (max / 4) * i;
        return (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeDasharray="2 4" />
            <text x={P.l - 10} y={y(v)} dy="4" textAnchor="end" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">{fmtY(v)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = P.l + i * groupW + groupW / 2;
        const active = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
            <rect x={gx - groupW / 2} y={P.t} width={groupW} height={innerH} fill={active ? "var(--cream-soft)" : "transparent"} opacity="0.6" />
            <rect x={gx - barW - 2} y={y(d.income)}  width={barW} height={Math.max(0, P.t + innerH - y(d.income))}  rx="3" fill="var(--sage)"  opacity={hover === null || active ? 1 : 0.4} />
            <rect x={gx + 2}        y={y(d.expense)} width={barW} height={Math.max(0, P.t + innerH - y(d.expense))} rx="3" fill="var(--terra)" opacity={hover === null || active ? 1 : 0.4} />
            {showLabel(i) && (
              <text x={gx} y={H - 12} textAnchor="middle" fontSize="10.5" fill={active ? "var(--ink)" : "var(--muted)"} fontFamily="Geist, sans-serif">{d.m}</text>
            )}
          </g>
        );
      })}
      {hover !== null && (() => {
        const gx = P.l + hover * groupW + groupW / 2;
        const tx = Math.min(W - 150, Math.max(P.l, gx - 70));
        const d  = data[hover];
        return (
          <g transform={`translate(${tx}, ${P.t + 4})`}>
            <rect width="146" height="56" rx="8" fill="var(--paper)" stroke="var(--line-soft)" />
            <text x="10" y="16" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">
              {d.m}{data.length > 12 ? ` ${MONTHS_ID[d.month]} ${d.year}` : ` ${d.year || ""}`}
            </text>
            <circle cx="14" cy="30" r="3" fill="var(--sage)" />
            <text x="22" y="33" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">Masuk <tspan fontWeight="600">{fmtShort(d.income)}</tspan></text>
            <circle cx="14" cy="46" r="3" fill="var(--terra)" />
            <text x="22" y="49" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">Keluar <tspan fontWeight="600">{fmtShort(d.expense)}</tspan></text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── Analytics Page ────────────────────────────────────────────────────

export function AnalyticsPage({ transactions = [] }) {
  const [scope, setScope] = React.useState("year"); // "year" | "month"
  const [pickedMonth, setPickedMonth] = React.useState(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [hoverCat, setHoverCat] = React.useState(null);

  const now = new Date();
  const activePicked = pickedMonth || { year: now.getFullYear(), month: now.getMonth() };

  const bars = React.useMemo(() => computeBarData(transactions, scope, scope === "month" ? activePicked : null), [transactions, scope, activePicked]);
  const cats = React.useMemo(() => computeCatData(transactions, scope, scope === "month" ? activePicked : null), [transactions, scope, activePicked]);

  const totalIncome  = bars.reduce((s, d) => s + (d.income  || 0), 0);
  const totalExpense = bars.reduce((s, d) => s + (d.expense || 0), 0);
  const net          = totalIncome - totalExpense;

  // Avg: for year = total/12, for month = total/days
  const avgDenominator = scope === "year" ? 12 : new Date(activePicked.year, activePicked.month + 1, 0).getDate();
  const avgExpense     = avgDenominator > 0 ? Math.round(totalExpense / avgDenominator) : 0;
  const avgLabel       = scope === "year" ? "Rata-rata/bulan" : "Rata-rata/hari";

  const catTotal = cats.reduce((s, c) => s + (c.amount || 0), 0);

  const stats = [
    { l: "Total pemasukan",  v: totalIncome  || 0, c: "var(--sage)" },
    { l: "Total pengeluaran",v: totalExpense || 0, c: "var(--terra)" },
    { l: "Selisih bersih",   v: net          || 0, c: net >= 0 ? "var(--ink)" : "var(--terra)" },
    { l: avgLabel,           v: avgExpense   || 0, c: "var(--muted)" },
  ];

  // Available months for picker
  const availableMonths = React.useMemo(() => {
    const set = new Set();
    transactions.forEach(t => { if (t.dateRaw) set.add(t.dateRaw.slice(0, 7)); });
    if (set.size === 0) {
      for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    return Array.from(set).sort().reverse().map(s => {
      const [yr, mo] = s.split('-');
      return { year: +yr, month: +mo - 1 };
    });
  }, [transactions]);

  const byYear = {};
  availableMonths.forEach(m => { (byYear[m.year] ||= []).push(m); });

  const pickedLabel = `${MONTHS_ID[activePicked.month]} ${activePicked.year}`;
  const rangeLabel  = scope === "year" ? "1 Tahun terakhir" : pickedLabel;

  const hasData = totalIncome > 0 || totalExpense > 0;

  return (
    <>
      <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Analitik · {rangeLabel}</div>
            <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Statistik keuangan</h2>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
              Diagram batang, diagram lingkaran, dan tabel rinci. Semua visual ini juga ikut tercetak di laporan yang bisa kamu unduh.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Scope filter */}
            <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              <button onClick={() => setScope("year")} style={{ padding: "8px 16px", fontSize: 12.5, background: scope === "year" ? "var(--ivory)" : "transparent", border: scope === "year" ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: scope === "year" ? "var(--ink)" : "var(--muted)", fontWeight: scope === "year" ? 500 : 400 }}>
                1 Tahun
              </button>
              <button onClick={() => { setScope("month"); setSheetOpen(true); }} style={{ padding: "8px 16px", fontSize: 12.5, background: scope === "month" ? "var(--ivory)" : "transparent", border: scope === "month" ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: scope === "month" ? "var(--ink)" : "var(--muted)", fontWeight: scope === "month" ? 500 : 400 }}>
                {scope === "month" ? pickedLabel : "1 Bulan"} ▾
              </button>
            </div>
            <button onClick={() => { if (typeof downloadReport === "function") downloadReport("year", now.getFullYear()); }} style={{ padding: "10px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
              <IconArrowDown size={14} /> Unduh laporan
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="stat-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
          {stats.map((s, i) => (
            <div key={i} className="card rise" style={{ padding: 16, animationDelay: `${i * 0.03}s` }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{s.l}</div>
              <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(s.v), letterSpacing: "-0.01em", marginTop: 6, color: s.c }}>{formatNominal(s.v)}</div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="card rise" style={{ padding: 22, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Diagram batang</div>
              <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2 }}>Pemasukan vs pengeluaran</div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--sage)" }} /> Masuk</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--terra)" }} /> Keluar</span>
            </div>
          </div>
          {!hasData ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 160, color: "var(--muted)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>
              <div style={{ fontSize: 13 }}>Belum ada data untuk periode ini</div>
            </div>
          ) : (
            <BarChart data={bars} />
          )}
        </div>

        {/* Donut + table */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.9fr) 1.4fr", gap: 16 }} className="analytics-chart-grid">
          <div className="card rise" style={{ padding: 22 }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Diagram lingkaran</div>
            <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 6 }}>Komposisi pengeluaran</div>
            {cats.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180, color: "var(--muted)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                <div style={{ fontSize: 13 }}>Belum ada pengeluaran</div>
              </div>
            ) : (
              <>
                <SpendingDonut data={cats} active={hoverCat} onHover={setHoverCat} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, justifyContent: "center" }}>
                  {cats.slice(0, 6).map((c, i) => (
                    <span key={c.id} onMouseEnter={() => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)", cursor: "default" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card rise" style={{ padding: "22px 22px 8px" }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Tabel statistik</div>
            <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 12 }}>Rincian per kategori</div>
            {cats.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Belum ada data kategori untuk periode ini.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
                    <th style={{ textAlign: "left", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>Kategori</th>
                    <th style={{ textAlign: "right", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>Jumlah</th>
                    <th style={{ textAlign: "right", padding: "0 0 10px 16px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500, width: 90 }}>Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c, i) => {
                    const pct = catTotal > 0 ? Math.round((c.amount / catTotal) * 100) : 0;
                    return (
                      <tr key={c.id} onMouseEnter={() => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}
                        style={{ background: hoverCat === i ? "var(--paper)" : "transparent" }}>
                        <td style={{ padding: "10px 0", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
                          </span>
                        </td>
                        <td className="tnum" style={{ textAlign: "right", padding: "10px 0", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0, fontWeight: 500 }}>{fmtShort(c.amount)}</td>
                        <td style={{ textAlign: "right", padding: "10px 0 10px 16px", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                            <span style={{ width: 36, height: 5, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", display: "inline-block" }}>
                              <span style={{ display: "block", height: "100%", width: `${pct}%`, background: c.color }} />
                            </span>
                            <span className="tnum" style={{ color: "var(--muted)", minWidth: 28, textAlign: "right" }}>{pct}%</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>Total</td>
                    <td className="tnum" style={{ textAlign: "right", padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{fmtShort(catTotal)}</td>
                    <td style={{ textAlign: "right", padding: "12px 0 12px 16px", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sheet — Pilih Bulan */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "20px 16px 80px", zIndex: 200, maxHeight: "55vh", overflowY: "auto", boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-8px auto 16px" }} />
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Pilih bulan</div>
            {Object.entries(byYear).sort((a, b) => b[0] - a[0]).map(([yr, months]) => (
              <div key={yr} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{yr}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {months.map(m => {
                    const active = m.year === activePicked.year && m.month === activePicked.month;
                    return (
                      <button key={`${m.year}-${m.month}`}
                        onClick={() => { setPickedMonth(m); setSheetOpen(false); }}
                        style={{ padding: "10px 0", borderRadius: 10, border: active ? 0 : "1px solid var(--line-soft)", background: active ? "var(--ink)" : "var(--paper)", color: active ? "var(--cream)" : "var(--ink)", fontSize: 13.5, fontWeight: active ? 600 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                        {MONTHS_ID[m.month]}
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

Object.assign(window, { AnalyticsPage, BarChart });
