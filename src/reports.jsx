import React from 'react';
import { CASHFLOW, CATEGORIES, fmtShort } from './data';
import { IconReport, IconArrowDown, IconClose } from './icons';

// ── Halaman Laporan (Reports) ──────────────────────────────────────
// Generates monthly & yearly financial reports as downloadable, print-ready
// documents (standalone HTML → "Save as PDF").

const ID_MONTHS = { Jan: "Januari", Feb: "Februari", Mar: "Maret", Apr: "April", May: "Mei", Jun: "Juni", Jul: "Juli", Aug: "Agustus", Sep: "September", Oct: "Oktober", Nov: "November", Dec: "Desember" };

// Map CASHFLOW (Jun..May) onto calendar years: Jun–Dec = 2025, Jan–May = 2026.
function monthMeta() {
  const yearOf = { Jun: 2025, Jul: 2025, Aug: 2025, Sep: 2025, Oct: 2025, Nov: 2025, Dec: 2025, Jan: 2026, Feb: 2026, Mar: 2026, Apr: 2026, May: 2026 };
  return CASHFLOW.map((c, i) => ({
    idx: i, abbr: c.m, full: ID_MONTHS[c.m], year: yearOf[c.m],
    income: c.income, expense: c.expense, net: c.income - c.expense,
  }));
}

// Category breakdown for a given month, scaled from the reference month.
function categoriesFor(monthExpense) {
  const refTotal = CATEGORIES.reduce((s, c) => s + c.amount, 0);
  const k = monthExpense / refTotal;
  return CATEGORIES.map(c => ({ ...c, amount: Math.round(c.amount * k / 1000) * 1000 }))
    .sort((a, b) => b.amount - a.amount);
}

// ── SVG chart builders for the report document (return SVG strings) ─
function reportPieSVG(cats, total) {
  const R = 70, r = 44, cx = 90, cy = 90;
  let acc = 0;
  const arcs = cats.map(c => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2; acc += c.amount;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(start), y0 = cy + R * Math.sin(start);
    const x1 = cx + R * Math.cos(end), y1 = cy + R * Math.sin(end);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const x3 = cx + r * Math.cos(start), y3 = cy + r * Math.sin(start);
    return `<path d="M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z" fill="${c.color}"/>`;
  }).join("");
  const legend = cats.slice(0, 8).map(c =>
    `<div class="lg"><span class="dot" style="background:${c.color}"></span>${c.label} <span class="muted">${Math.round((c.amount / total) * 100)}%</span></div>`
  ).join("");
  return `<div class="chart-row"><svg viewBox="0 0 180 180" width="180" height="180">${arcs}<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="var(--paper)"/></svg><div class="legend">${legend}</div></div>`;
}

function reportBarSVG(months) {
  const W = 600, H = 220, P = { t: 14, r: 10, b: 28, l: 46 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const max = Math.ceil(Math.max(...months.map(d => Math.max(d.income, d.expense))) / 5_000_000) * 5_000_000 || 5_000_000;
  const groupW = innerW / months.length, barW = Math.min(14, groupW / 3);
  const y = (v) => P.t + innerH - (v / max) * innerH;
  const grid = [0, 1, 2, 3, 4].map(i => {
    const v = (max / 4) * i;
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="2 4"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${(v / 1_000_000).toFixed(0)}jt</text>`;
  }).join("");
  const bars = months.map((d, i) => {
    const gx = P.l + i * groupW + groupW / 2;
    return `<rect x="${gx - barW - 2}" y="${y(d.income)}" width="${barW}" height="${P.t + innerH - y(d.income)}" rx="2" fill="var(--sage)"/><rect x="${gx + 2}" y="${y(d.expense)}" width="${barW}" height="${P.t + innerH - y(d.expense)}" rx="2" fill="var(--terra)"/><text x="${gx}" y="${H - 10}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.abbr}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${grid}${bars}</svg>`;
}

function reportCatBarSVG(cats, expense) {
  const top = cats.slice(0, 8);
  const max = Math.max(...top.map(c => c.amount)) || 1;
  const rows = top.map(c => {
    const w = Math.round((c.amount / max) * 100);
    return `<div class="hbar"><span class="hlabel">${c.label}</span><span class="htrack"><span class="hfill" style="width:${w}%;background:${c.color}"></span></span><span class="hval num">${Math.round((c.amount / expense) * 100)}%</span></div>`;
  }).join("");
  return `<div class="hbars">${rows}</div>`;
}

// ── Build the standalone report document (returns an HTML string) ──
function buildReportDoc({ title, periodLabel, income, expense, net, cats, months }) {
  const savingsRate = income ? Math.round((net / income) * 100) : 0;
  const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
  const catRows = cats.map(c => {
    const pct = expense ? Math.round((c.amount / expense) * 100) : 0;
    return `<tr><td><span class="dot" style="background:${c.color.startsWith('var') ? '#8C7B5C' : c.color}"></span>${c.label}</td><td class="num">${rupiah(c.amount)}</td><td class="num muted">${pct}%</td></tr>`;
  }).join("");

  const monthRows = (months || []).map(m =>
    `<tr><td>${m.full} ${m.year}</td><td class="num pos">${rupiah(m.income)}</td><td class="num neg">${rupiah(m.expense)}</td><td class="num">${rupiah(m.net)}</td></tr>`
  ).join("");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — FinanceApp</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
  :root{--ink:#2A2C20;--muted:#6E6B58;--line:#D8D2BE;--paper:#FBF8EE;--sage:#5C6B4C;--terra:#B26A4A;--gold:#B68A3E;--blush:#C9886D;--cream:#EAE5D5;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Geist',-apple-system,sans-serif;color:var(--ink);background:#cfc9b8;padding:40px 20px;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;}
  .serif{font-family:'Instrument Serif',serif;font-weight:400;}
  .page{max-width:760px;margin:0 auto;background:var(--paper);padding:56px 56px 48px;box-shadow:0 20px 60px -20px rgba(0,0,0,.35);}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--ink);padding-bottom:20px;margin-bottom:28px;}
  .brand{display:flex;align-items:center;gap:12px;}
  .mark{width:40px;height:40px;border-radius:11px;background:var(--ink);color:var(--cream);display:grid;place-items:center;font-family:'Instrument Serif',serif;font-style:italic;font-size:26px;}
  .brand h1{font-size:22px;font-weight:500;letter-spacing:-.01em;}
  .brand .tag{font-size:10.5px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:2px;}
  .meta{text-align:right;font-size:11.5px;color:var(--muted);line-height:1.6;}
  .eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
  .title{font-size:34px;letter-spacing:-.015em;margin:4px 0 2px;}
  .period{font-size:14px;color:var(--muted);margin-bottom:28px;}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px;}
  .kpi{border:1px solid var(--line);border-radius:14px;padding:16px;}
  .kpi .l{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
  .kpi .v{font-family:'Instrument Serif',serif;font-size:26px;letter-spacing:-.01em;margin-top:6px;}
  .kpi.net{background:var(--ink);color:var(--cream);border-color:var(--ink);}
  .kpi.net .l,.kpi.net .v{color:var(--cream);}
  .pos{color:var(--sage);} .neg{color:var(--terra);}
  .net-strip{display:flex;justify-content:space-between;align-items:center;background:rgba(92,107,76,.12);border-radius:12px;padding:12px 16px;font-size:12.5px;color:var(--ink);margin-bottom:30px;}
  h2.sec{font-family:'Instrument Serif',serif;font-size:22px;letter-spacing:-.01em;margin:26px 0 12px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:0 0 8px;border-bottom:1px solid var(--line);}
  td{padding:9px 0;border-bottom:1px solid var(--line);}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;}
  .muted{color:var(--muted);}
  .dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:9px;vertical-align:middle;}
  tfoot td{font-weight:600;border-bottom:0;border-top:2px solid var(--ink);}
  .chart-row{display:flex;align-items:center;gap:28px;}
  .legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;flex:1;}
  .lg{font-size:12px;color:var(--ink);} .lg .muted{float:right;}
  .chart-legend{display:flex;gap:18px;font-size:11.5px;color:var(--muted);margin:6px 0 14px;}
  .chart-legend span{display:inline-flex;align-items:center;gap:6px;}
  .sq{width:10px;height:10px;border-radius:3px;display:inline-block;}
  .hbars{display:flex;flex-direction:column;gap:9px;margin-top:4px;}
  .hbar{display:flex;align-items:center;gap:12px;font-size:12px;}
  .hlabel{width:140px;flex:0 0 140px;color:var(--ink);}
  .htrack{flex:1;height:9px;background:#e8e2cf;border-radius:99px;overflow:hidden;}
  .hfill{display:block;height:100%;border-radius:99px;}
  .hval{width:40px;text-align:right;color:var(--muted);}
  .foot{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted);display:flex;justify-content:space-between;}
  .badge{display:inline-block;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--sage);background:rgba(92,107,76,.14);padding:3px 9px;border-radius:999px;}
  @media print{body{background:#fff;padding:0;}.page{box-shadow:none;max-width:none;padding:40px;}@page{margin:14mm;}}
  @media(max-width:600px){
    body{padding:0;background:var(--paper);}
    .page{max-width:100%;padding:20px 16px 28px;box-shadow:none;}
    .top{flex-direction:column;gap:10px;}.meta{text-align:left;}
    .kpis{grid-template-columns:1fr 1fr;gap:8px;}.kpi .v{font-size:20px;}
    h2.sec{font-size:16px;word-break:break-word;white-space:normal;}
    .chart-row{flex-direction:column;align-items:flex-start;gap:12px;}.legend{grid-template-columns:1fr;}
    .hlabel{width:90px;flex:0 0 90px;font-size:11px;}
    .hval{width:32px;}
  }
</style></head><body>
<div class="page">
  <div class="top">
    <div class="brand"><div class="mark">F</div><div><h1>FinanceApp</h1><div class="tag">Less spending · More living</div></div></div>
    <div class="meta">Dibuat ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br/>FinanceApp<br/><span class="badge">Gratis untuk semua</span></div>
  </div>
  <div class="eyebrow">${title}</div>
  <div class="serif title">Laporan Keuangan</div>
  <div class="period">${periodLabel}</div>

  <div class="kpis">
    <div class="kpi"><div class="l">Pemasukan</div><div class="v pos">${rupiah(income)}</div></div>
    <div class="kpi"><div class="l">Pengeluaran</div><div class="v neg">${rupiah(expense)}</div></div>
    <div class="kpi net"><div class="l">Selisih bersih</div><div class="v">${rupiah(net)}</div></div>
  </div>
  <div class="net-strip"><span>Tingkat menabung (savings rate)</span><strong>${savingsRate}%</strong></div>

  ${months ? `<h2 class="sec">Diagram batang — pemasukan vs pengeluaran</h2><div class="chart-legend"><span><span class="sq" style="background:var(--sage)"></span>Pemasukan</span><span><span class="sq" style="background:var(--terra)"></span>Pengeluaran</span></div>${reportBarSVG(months)}` : `<h2 class="sec">Diagram batang — pengeluaran per kategori</h2>${reportCatBarSVG(cats, expense)}`}

  <h2 class="sec">Diagram lingkaran — komposisi pengeluaran</h2>
  ${reportPieSVG(cats, expense)}

  <h2 class="sec">Tabel — pengeluaran per kategori</h2>
  <table><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">% dari pengeluaran</th></tr></thead>
  <tbody>${catRows}</tbody>
  <tfoot><tr><td>Total pengeluaran</td><td class="num">${rupiah(expense)}</td><td class="num">100%</td></tr></tfoot></table>

  ${monthRows ? `<h2 class="sec">Tabel — rincian bulanan</h2><table><thead><tr><th>Bulan</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Bersih</th></tr></thead><tbody>${monthRows}</tbody></table>` : ""}

  <div class="foot"><span>FinanceApp — Laporan dibuat otomatis</span><span>Dokumen ini bersifat informatif, bukan dokumen pajak resmi.</span></div>
</div></body></html>`;
}

// Build report payload for a month or a year
function reportPayload(kind, key) {
  const meta = monthMeta();
  if (kind === "month") {
    const m = meta.find(x => x.idx === key);
    return {
      title: "Laporan Bulanan",
      periodLabel: `${m.full} ${m.year}`,
      filename: `Laporan-${m.abbr}-${m.year}`,
      income: m.income, expense: m.expense, net: m.net,
      cats: categoriesFor(m.expense), months: null,
    };
  }
  // year
  const months = meta.filter(x => x.year === key);
  const income = months.reduce((s, x) => s + x.income, 0);
  const expense = months.reduce((s, x) => s + x.expense, 0);
  return {
    title: "Laporan Tahunan",
    periodLabel: `Tahun ${key}${key === 2025 ? " (Jun–Des)" : " (Jan–Mei)"}`,
    filename: `Laporan-Tahunan-${key}`,
    income, expense, net: income - expense,
    cats: categoriesFor(expense), months,
  };
}

function downloadReport(kind, key) {
  const p = reportPayload(kind, key);
  const html = buildReportDoc(p);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = p.filename + ".html";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function printReport(kind, key) {
  const p = reportPayload(kind, key);
  const html = buildReportDoc(p);
  const w = window.open("", "_blank");
  if (!w) { downloadReport(kind, key); return; } // popup blocked → fallback
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}

// ── Preview modal ──────────────────────────────────────────────────
function ReportPreview({ open, kind, rkey, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (open && ref.current) {
      const p = reportPayload(kind, rkey);
      ref.current.srcdoc = buildReportDoc(p);
    }
  }, [open, kind, rkey]);
  if (!open) return null;
  const p = reportPayload(kind, rkey);
  return (
    <div className="report-preview-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.4)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24, animation: "rise .25s ease-out" }}>
      <div className="report-preview-container" onClick={e => e.stopPropagation()} style={{ width: 820, maxWidth: "100%", height: "88vh", display: "flex", flexDirection: "column", background: "var(--ivory)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -20px rgba(42,44,32,.5)" }}>
        <div className="report-preview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{p.title}</div>
            <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.periodLabel}</div>
          </div>
          <div className="report-preview-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button className="report-preview-btn-print" onClick={() => printReport(kind, rkey)} style={{ padding: "9px 14px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
              <IconReport size={14} /> Cetak / PDF
            </button>
            <button onClick={() => downloadReport(kind, rkey)} style={{ padding: "9px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
              <IconArrowDown size={14} /> <span className="report-preview-btn-label">Unduh</span>
            </button>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
              <IconClose size={15} />
            </button>
          </div>
        </div>
        <iframe ref={ref} title="preview" style={{ flex: 1, border: 0, background: "#cfc9b8" }} />
      </div>
    </div>
  );
}

// ── Reports page ───────────────────────────────────────────────────
export function ReportsPage() {
  const [scope, setScope] = React.useState("month"); // month | year
  const [preview, setPreview] = React.useState(null); // { kind, key }
  const meta = monthMeta();

  const monthlyCards = [...meta].reverse(); // newest first
  const years = [2026, 2025];

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Laporan</div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Laporan keuangan</h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            Setiap bulan dirangkum otomatis — pratinjau, unduh PDF, gratis.
          </div>
        </div>
        <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {[{ id: "month", label: "Bulanan" }, { id: "year", label: "Tahunan" }].map(s => (
            <button key={s.id} onClick={() => setScope(s.id)} style={{
              padding: "8px 16px", fontSize: 12.5,
              background: scope === s.id ? "var(--ivory)" : "transparent",
              border: scope === s.id ? "1px solid var(--line-soft)" : "1px solid transparent",
              borderRadius: 8, color: scope === s.id ? "var(--ink)" : "var(--muted)",
              fontWeight: scope === s.id ? 500 : 400,
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {scope === "month" && (
        <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {monthlyCards.map((m, i) => (
            <ReportCard key={m.idx} eyebrow={`${m.full} ${m.year}`} income={m.income} expense={m.expense} net={m.net}
              latest={i === 0} delay={i * 0.03}
              onPreview={() => setPreview({ kind: "month", key: m.idx })}
              onDownload={() => downloadReport("month", m.idx)} />
          ))}
        </div>
      )}

      {scope === "year" && (
        <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {years.map((y, i) => {
            const p = reportPayload("year", y);
            return (
              <ReportCard key={y} eyebrow={`Tahun ${y}`} income={p.income} expense={p.expense} net={p.net}
                big latest={i === 0} delay={i * 0.04} sub={y === 2025 ? "Jun – Des 2025" : "Jan – Mei 2026"}
                onPreview={() => setPreview({ kind: "year", key: y })}
                onDownload={() => downloadReport("year", y)} />
            );
          })}
        </div>
      )}

      <ReportPreview open={!!preview} kind={preview?.kind} rkey={preview?.key} onClose={() => setPreview(null)} />
    </div>
  );
}

function ReportCard({ eyebrow, sub, income, expense, net, latest, big, delay, onPreview, onDownload }) {
  const rate = income ? Math.round((net / income) * 100) : 0;
  return (
    <div className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${delay}s`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: big ? "22px 22px 18px" : "18px 18px 16px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
              {latest ? "Terbaru · " : ""}Laporan {big ? "tahunan" : "bulanan"}
            </div>
            <div className="serif" style={{ fontSize: big ? 30 : 24, letterSpacing: "-0.01em", marginTop: 3 }}>{eyebrow}</div>
            {sub && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
          </div>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconReport size={17} />
          </span>
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 60 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Masuk</div>
            <div className="tnum" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--sage)" }}>{fmtShort(income)}</div>
          </div>
          <div style={{ minWidth: 60 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Keluar</div>
            <div className="tnum" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--terra)" }}>{fmtShort(expense)}</div>
          </div>
          <div style={{ minWidth: 60 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Bersih · {rate}%</div>
            <div className="tnum serif" style={{ fontSize: 16, letterSpacing: "-0.01em" }}>{fmtShort(net)}</div>
          </div>
        </div>
      </div>

      <div className="hairline" style={{ display: "flex" }}>
        <button onClick={onPreview} style={{ flex: 1, padding: "12px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink-2)", display: "inline-flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
          Pratinjau
        </button>
        <div style={{ width: 1, background: "var(--line-soft)" }} />
        <button onClick={onDownload} style={{ flex: 1, padding: "12px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink)", fontWeight: 500, display: "inline-flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
          <IconArrowDown size={14} /> Unduh
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ReportsPage, monthMeta, downloadReport, printReport, buildReportDoc, reportPayload });
