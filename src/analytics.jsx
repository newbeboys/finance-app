import React from 'react';
import { CASHFLOW, CATEGORIES, fmt, fmtShort } from './data';
import { IconArrowDown } from './icons';
import { SpendingDonut } from './charts';

// ── Halaman Analitik (Analytics) ───────────────────────────────────
// Bar chart + donut + statistical table. The same visuals are embedded
// into the downloadable monthly/yearly reports (see reports.jsx).

// Grouped bar chart — income vs expense per month (React/SVG)
function BarChart({ data, height = 280 }) {
  const W = 760, H = height, P = { t: 16, r: 12, b: 36, l: 52 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const max = Math.ceil(Math.max(...data.map(d => Math.max(d.income, d.expense))) / 5_000_000) * 5_000_000;
  const groupW = innerW / data.length;
  const barW = Math.min(16, groupW / 3);
  const y = (v) => P.t + innerH - (v / max) * innerH;
  const [hover, setHover] = React.useState(null);
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (max / ticks) * i;
        return (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeDasharray="2 4" />
            <text x={P.l - 10} y={y(v)} dy="4" textAnchor="end" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">
              {(v / 1_000_000).toFixed(0)}jt
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = P.l + i * groupW + groupW / 2;
        const active = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
            <rect x={gx - groupW / 2} y={P.t} width={groupW} height={innerH} fill={active ? "var(--cream-soft)" : "transparent"} opacity="0.6" />
            <rect x={gx - barW - 2} y={y(d.income)} width={barW} height={P.t + innerH - y(d.income)} rx="3" fill="var(--sage)" opacity={hover === null || active ? 1 : 0.4} />
            <rect x={gx + 2} y={y(d.expense)} width={barW} height={P.t + innerH - y(d.expense)} rx="3" fill="var(--terra)" opacity={hover === null || active ? 1 : 0.4} />
            <text x={gx} y={H - 12} textAnchor="middle" fontSize="10.5" fill={active ? "var(--ink)" : "var(--muted)"} fontFamily="Geist, sans-serif">{d.m}</text>
          </g>
        );
      })}
      {hover !== null && (() => {
        const gx = P.l + hover * groupW + groupW / 2;
        const tx = Math.min(W - 150, Math.max(P.l, gx - 70));
        return (
          <g transform={`translate(${tx}, ${P.t + 4})`}>
            <rect width="146" height="56" rx="8" fill="var(--paper)" stroke="var(--line-soft)" />
            <text x="10" y="16" fontSize="10.5" fill="var(--muted)" fontFamily="Geist, sans-serif">{data[hover].m} {data[hover].year || ""}</text>
            <circle cx="14" cy="30" r="3" fill="var(--sage)" /><text x="22" y="33" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">Masuk <tspan fontWeight="600">{fmtShort(data[hover].income)}</tspan></text>
            <circle cx="14" cy="46" r="3" fill="var(--terra)" /><text x="22" y="49" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">Keluar <tspan fontWeight="600">{fmtShort(data[hover].expense)}</tspan></text>
          </g>
        );
      })()}
    </svg>
  );
}

export function AnalyticsPage() {
  const [scope, setScope] = React.useState("year"); // year = 12 mo, quarter = last 3
  const [hoverCat, setHoverCat] = React.useState(null);

  const meta = (typeof monthMeta === "function") ? monthMeta() : CASHFLOW.map((c, i) => ({ ...c, idx: i }));
  const bars = scope === "year" ? meta : meta.slice(-3);

  const totalIncome = bars.reduce((s, d) => s + d.income, 0);
  const totalExpense = bars.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;
  const avgExpense = Math.round(totalExpense / bars.length);

  const cats = [...CATEGORIES].sort((a, b) => b.amount - a.amount);
  const catTotal = cats.reduce((s, c) => s + c.amount, 0);
  const swatch = (c) => (c.color && c.color.startsWith("var")) ? null : c.color;

  const stats = [
    { l: "Total pemasukan", v: fmtShort(totalIncome), c: "var(--sage)" },
    { l: "Total pengeluaran", v: fmtShort(totalExpense), c: "var(--terra)" },
    { l: "Selisih bersih", v: fmtShort(net), c: "var(--ink)" },
    { l: "Rata-rata/bulan", v: fmtShort(avgExpense), c: "var(--muted)" },
  ];

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Analitik</div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Statistik keuangan</h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
            Diagram batang, diagram lingkaran, dan tabel rinci. Semua visual ini juga ikut tercetak di laporan bulanan & tahunan yang bisa kamu unduh.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
            {[{ id: "quarter", label: "3 Bulan" }, { id: "year", label: "12 Bulan" }].map(s => (
              <button key={s.id} onClick={() => setScope(s.id)} style={{
                padding: "8px 16px", fontSize: 12.5,
                background: scope === s.id ? "var(--ivory)" : "transparent",
                border: scope === s.id ? "1px solid var(--line-soft)" : "1px solid transparent",
                borderRadius: 8, color: scope === s.id ? "var(--ink)" : "var(--muted)", fontWeight: scope === s.id ? 500 : 400,
              }}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => { if (typeof downloadReport === "function") downloadReport("year", 2026); }} style={{
            padding: "10px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10,
            fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center",
          }}>
            <IconArrowDown size={14} /> Unduh laporan
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="stat-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} className="card rise" style={{ padding: 16, animationDelay: `${i * 0.03}s` }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{s.l}</div>
            <div className="serif tnum" style={{ fontSize: 26, letterSpacing: "-0.01em", marginTop: 6, color: s.c }}>{s.v}</div>
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
        <BarChart data={bars} />
      </div>

      {/* Donut + table */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.9fr) 1.4fr", gap: 16, flexWrap: "wrap" }}
        className="analytics-chart-grid">
        <div className="card rise" style={{ padding: 22 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Diagram lingkaran</div>
          <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 6 }}>Komposisi pengeluaran</div>
          <SpendingDonut data={cats} active={hoverCat} onHover={setHoverCat} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, justifyContent: "center" }}>
            {cats.slice(0, 6).map((c, i) => (
              <span key={c.id} onMouseEnter={() => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)", cursor: "default" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="card rise" style={{ padding: "22px 22px 8px" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Tabel statistik</div>
          <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 12 }}>Rincian per kategori</div>
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
                const pct = Math.round((c.amount / catTotal) * 100);
                return (
                  <tr key={c.id} onMouseEnter={() => setHoverCat(i)} onMouseLeave={() => setHoverCat(null)}
                    style={{ background: hoverCat === i ? "var(--paper)" : "transparent" }}>
                    <td style={{ padding: "10px 0", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
                      </span>
                    </td>
                    <td className="tnum" style={{ textAlign: "right", padding: "10px 0", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0, fontWeight: 500 }}>{fmt(c.amount)}</td>
                    <td style={{ textAlign: "right", padding: "10px 0 10px 16px", borderBottom: i < cats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <span style={{ width: 36, height: 5, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", display: "inline-block" }}>
                          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: c.color }} />
                        </span>
                        <span className="tnum muted" style={{ color: "var(--muted)", minWidth: 28, textAlign: "right" }}>{pct}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>Total</td>
                <td className="tnum" style={{ textAlign: "right", padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{fmt(catTotal)}</td>
                <td style={{ textAlign: "right", padding: "12px 0 12px 16px", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AnalyticsPage, BarChart });
