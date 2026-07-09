import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_CATEGORIES, fmtShort } from './data';
import { IconReport, IconArrowDown, IconClose } from './icons';
import { downloadExcel } from './report-excel';
import { useScrollLock } from './hooks/useScrollLock';
import { usePaywall } from './components/PaywallModal';

// ── Halaman Laporan (Reports) ──────────────────────────────────────
// Generates monthly & yearly financial reports as downloadable, print-ready
// documents (standalone HTML → "Save as PDF").

const ID_MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ID_MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Escape teks yang berasal dari user (mis. nama kategori kustom) sebelum
// disisipkan ke string HTML laporan — cegah HTML/script injection (self-XSS).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Aggregate transactions → income / expense / net + expense-by-category.
// `catList` mencakup kategori bawaan + kustom (dari Supabase) agar nama
// kategori kustom tampil sebagai nama, bukan UUID.
function aggregate(txs, catList = ALL_CATEGORIES) {
  let income = 0, expense = 0;
  const catMap = {}, incomeMap = {};
  txs.forEach(t => {
    if (t.amount >= 0) { income += t.amount; incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount; }
    else { const a = -t.amount; expense += a; catMap[t.category] = (catMap[t.category] || 0) + a; }
  });
  const cats = Object.entries(catMap).map(([id, amount]) => {
    const c = catList.find(x => x.id === id);
    return { id, label: c?.label || id, color: c?.color || '#8C7B5C', amount };
  }).sort((a, b) => b.amount - a.amount);
  const incomeCats = Object.entries(incomeMap).map(([id, amount]) => {
    const c = catList.find(x => x.id === id);
    return { id, label: c?.label || id, color: c?.color || '#5C6B4C', amount };
  }).sort((a, b) => b.amount - a.amount);
  return { income, expense, net: income - expense, cats, incomeCats };
}

// Attach a human-readable category label to each tx (for the Excel detail sheet).
function withLabels(txs, catList = ALL_CATEGORIES) {
  return txs.map(t => {
    const c = catList.find(x => x.id === t.category);
    return { ...t, catLabel: c?.label || t.category || '—' };
  });
}

// Newest → oldest by ISO date then time.
function sortDesc(txs) {
  return [...txs].sort((a, b) => {
    const k = (b.dateRaw || '').localeCompare(a.dateRaw || '');
    return k !== 0 ? k : (b.time || '').localeCompare(a.time || '');
  });
}

// Months present in the data, newest first.
function monthsIndex(transactions) {
  const map = {};
  transactions.forEach(t => {
    const k = (t.dateRaw || '').slice(0, 7);
    if (k.length !== 7) return;
    if (!map[k]) map[k] = { income: 0, expense: 0 };
    if (t.amount >= 0) map[k].income += t.amount;
    else map[k].expense += -t.amount;
  });
  return Object.keys(map).sort().reverse().map(k => {
    const year = +k.slice(0, 4), month = +k.slice(5, 7) - 1;
    const { income, expense } = map[k];
    return { key: k, year, month, abbr: ID_MONTHS_ABBR[month], full: ID_MONTHS_FULL[month], income, expense, net: income - expense };
  });
}

// Years present in the data, newest first (each with its months).
function yearsIndex(months) {
  const ys = [...new Set(months.map(m => m.year))].sort((a, b) => b - a);
  return ys.map(year => {
    const ms = months.filter(m => m.year === year).sort((a, b) => a.month - b.month);
    return {
      year,
      income: ms.reduce((s, m) => s + m.income, 0),
      expense: ms.reduce((s, m) => s + m.expense, 0),
      net: ms.reduce((s, m) => s + m.net, 0),
      months: ms,
    };
  });
}

// Sanitize wallet name for use in filenames: spaces → underscore, strip invalid chars.
function sanitizeFilename(name) {
  return String(name).replace(/\s+/g, '_').replace(/[/\\:*?"<>|]/g, '');
}

// Full payload consumed by BOTH the PDF (buildReportDoc) and Excel (downloadExcel).
// `walletLabel` — null means "Semua Dompet", a string means a specific wallet name.
function buildPayload(transactions, kind, key, customCategories = [], walletLabel = null) {
  const catList = [...ALL_CATEGORIES, ...customCategories];
  const walletSuffix = walletLabel ? `_${sanitizeFilename(walletLabel)}` : '';
  if (kind === "month") {
    const periodTx = sortDesc(transactions.filter(t => (t.dateRaw || '').slice(0, 7) === key));
    const { income, expense, net, cats, incomeCats } = aggregate(periodTx, catList);
    const year = +key.slice(0, 4), month = +key.slice(5, 7) - 1;
    return {
      kind, title: "Laporan Bulanan",
      periodLabel: `${ID_MONTHS_FULL[month]} ${year}`,
      filename: `Laporan-${ID_MONTHS_FULL[month]}-${year}${walletSuffix}`,
      excelFilename: `FinanceApp_Laporan_${ID_MONTHS_FULL[month]}_${year}${walletSuffix}.xlsx`,
      income, expense, net, cats, incomeCats, months: null,
      transactions: withLabels(periodTx, catList),
      walletLabel,
    };
  }
  // year
  const y = +key;
  const periodTx = sortDesc(transactions.filter(t => (t.dateRaw || '').slice(0, 4) === String(y)));
  const { income, expense, net, cats, incomeCats } = aggregate(periodTx, catList);
  const months = monthsIndex(periodTx).filter(m => m.year === y).sort((a, b) => a.month - b.month);
  return {
    kind, title: "Laporan Tahunan",
    periodLabel: `Tahun ${y}`,
    filename: `Laporan-Tahunan-${y}${walletSuffix}`,
    excelFilename: `FinanceApp_Laporan_${y}${walletSuffix}.xlsx`,
    income, expense, net, cats, incomeCats, months,
    transactions: withLabels(periodTx, catList),
    walletLabel,
  };
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
    `<div class="lg"><span class="dot" style="background:${c.color}"></span>${esc(c.label)} <span class="muted">${Math.round((c.amount / total) * 100)}%</span></div>`
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
    return `<div class="hbar"><span class="hlabel">${esc(c.label)}</span><span class="htrack"><span class="hfill" style="width:${w}%;background:${c.color}"></span></span><span class="hval num">${Math.round((c.amount / expense) * 100)}%</span></div>`;
  }).join("");
  return `<div class="hbars">${rows}</div>`;
}

// ── Build the standalone report document (returns an HTML string) ──
function buildReportDoc({ title, periodLabel, income, expense, net, cats, months, incomeCats = [], transactions = [], walletLabel = null }) {
  const savingsRate = income ? Math.round((net / income) * 100) : 0;
  const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
  const catRows = cats.map(c => {
    const pct = expense ? Math.round((c.amount / expense) * 100) : 0;
    return `<tr><td><span class="dot" style="background:${c.color.startsWith('var') ? '#8C7B5C' : c.color}"></span>${esc(c.label)}</td><td class="num">${rupiah(c.amount)}</td><td class="num muted">${pct}%</td></tr>`;
  }).join("");

  const monthRows = (months || []).map(m =>
    `<tr><td>${m.full} ${m.year}</td><td class="num pos">${rupiah(m.income)}</td><td class="num neg">${rupiah(m.expense)}</td><td class="num">${rupiah(m.net)}</td></tr>`
  ).join("");

  const incomeRows = incomeCats.map(c => {
    const pct = income ? Math.round((c.amount / income) * 100) : 0;
    const bg = c.color && !c.color.startsWith('var') ? c.color : '#5C6B4C';
    return `<tr><td><span class="dot" style="background:${bg}"></span>${esc(c.label)}</td><td class="num">${rupiah(c.amount)}</td><td class="num muted">${pct}%</td></tr>`;
  }).join("");

  const fmtDay = (iso) => { const p = (iso || '').split('-'); return p[2] && p[1] ? `${p[2]}/${p[1]}` : '—'; };
  const mkTxRow = (t) => {
    const name = [t.merchant, t.note].filter(Boolean).join(' · ') || '—';
    return `<tr><td class="muted" style="white-space:nowrap;padding-right:14px;min-width:44px">${fmtDay(t.dateRaw)}</td><td style="word-break:break-word">${esc(name)}</td><td style="padding-right:14px">${esc(t.catLabel || '—')}</td><td class="num">${rupiah(Math.abs(t.amount))}</td></tr>`;
  };
  const incomeTxRows = transactions.filter(t => t.amount >= 0).map(mkTxRow).join("");
  const expenseTxRows = transactions.filter(t => t.amount < 0).map(mkTxRow).join("");

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
  .period{font-size:14px;color:var(--muted);margin-bottom:6px;}
  .wallet-line{font-size:12px;color:var(--muted);margin-bottom:22px;}
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
  /* ── Kontrol page-break: cegah section/diagram terpotong di tengah halaman ── */
  .block{page-break-inside:avoid;break-inside:avoid;page-break-before:auto;}
  h2.sec{page-break-after:avoid;break-after:avoid;}
  .kpis,.net-strip,.chart-row{page-break-inside:avoid;break-inside:avoid;}
  .chart-row svg{max-height:240px;height:auto;}      /* diagram tidak melebihi tinggi halaman */
  table{page-break-inside:auto;}
  tr{page-break-inside:avoid;break-inside:avoid;}     /* jangan potong di tengah baris */
  thead{display:table-header-group;}                  /* ulangi header tabel tiap halaman */
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
    <div class="meta">Dibuat ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}<br/>FinanceApp</div>
  </div>
  <div class="eyebrow">${title}</div>
  <div class="serif title">Laporan Keuangan</div>
  <div class="period">${periodLabel}</div>
  <div class="wallet-line">Dompet: ${esc(walletLabel || 'Semua Dompet')}</div>

  <div class="kpis">
    <div class="kpi"><div class="l">Pemasukan</div><div class="v pos">${rupiah(income)}</div></div>
    <div class="kpi"><div class="l">Pengeluaran</div><div class="v neg">${rupiah(expense)}</div></div>
    <div class="kpi net"><div class="l">Selisih bersih</div><div class="v">${rupiah(net)}</div></div>
  </div>
  <div class="net-strip"><span>Tingkat menabung (savings rate)</span><strong>${savingsRate}%</strong></div>

  ${walletLabel !== null && income === 0 && expense === 0 && transactions.length === 0 ? `
  <div style="background:rgba(178,106,74,.08);border:1px solid rgba(178,106,74,.2);border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:var(--muted)">
    Tidak ada transaksi pada periode ini untuk dompet yang dipilih.
  </div>
  ` : ''}

  ${(months && months.length > 0) ? `<section class="block"><h2 class="sec">Diagram batang — pemasukan vs pengeluaran</h2><div class="chart-legend"><span><span class="sq" style="background:var(--sage)"></span>Pemasukan</span><span><span class="sq" style="background:var(--terra)"></span>Pengeluaran</span></div>${reportBarSVG(months)}</section>` : `<section class="block"><h2 class="sec">Diagram batang — pengeluaran per kategori</h2>${reportCatBarSVG(cats, expense)}</section>`}

  ${incomeCats.length ? `
  <section class="block">
    <h2 class="sec">Diagram lingkaran — komposisi pemasukan</h2>
    ${reportPieSVG(incomeCats, income)}
  </section>
  ` : ''}

  <section class="block">
    <h2 class="sec">Diagram lingkaran — komposisi pengeluaran</h2>
    ${reportPieSVG(cats, expense)}
  </section>

  ${incomeCats.length ? `
  <h2 class="sec">Tabel — pemasukan per kategori</h2>
  <table><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">% dari pemasukan</th></tr></thead>
  <tbody>${incomeRows}</tbody>
  <tfoot><tr><td>Total pemasukan</td><td class="num pos">${rupiah(income)}</td><td class="num">100%</td></tr></tfoot></table>
  ` : ''}

  <h2 class="sec">Tabel — pengeluaran per kategori</h2>
  <table><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">% dari pengeluaran</th></tr></thead>
  <tbody>${catRows}</tbody>
  <tfoot><tr><td>Total pengeluaran</td><td class="num">${rupiah(expense)}</td><td class="num">100%</td></tr></tfoot></table>

  ${monthRows ? `<h2 class="sec">Tabel — rincian bulanan</h2><table><thead><tr><th>Bulan</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Bersih</th></tr></thead><tbody>${monthRows}</tbody></table>` : ""}

  ${transactions.length ? `
  <h2 class="sec">Bagian 4 — Rincian Transaksi</h2>
  ${incomeTxRows ? `
  <h2 class="sec" style="font-size:18px">Transaksi Pemasukan</h2>
  <table><thead><tr><th>Tanggal</th><th>Nama</th><th>Kategori</th><th class="num">Jumlah</th></tr></thead>
  <tbody>${incomeTxRows}</tbody>
  <tfoot><tr><td colspan="3">Total Pemasukan</td><td class="num pos">${rupiah(income)}</td></tr></tfoot></table>
  ` : ''}
  ${expenseTxRows ? `
  <h2 class="sec" style="font-size:18px">Transaksi Pengeluaran</h2>
  <table><thead><tr><th>Tanggal</th><th>Nama</th><th>Kategori</th><th class="num">Jumlah</th></tr></thead>
  <tbody>${expenseTxRows}</tbody>
  <tfoot><tr><td colspan="3">Total Pengeluaran</td><td class="num neg">${rupiah(expense)}</td></tr></tfoot></table>
  ` : ''}
  ` : ''}

  <div class="foot"><span>FinanceApp — Laporan dibuat otomatis</span><span>Dokumen ini bersifat informatif, bukan dokumen pajak resmi.</span></div>
</div></body></html>`;
}

// Resolve CSS custom properties to literal values so html2canvas can render them
const PDF_COLORS = {
  '--ink': '#2A2C20', '--muted': '#6E6B58', '--line': '#D8D2BE', '--paper': '#FBF8EE',
  '--sage': '#5C6B4C', '--terra': '#B26A4A', '--gold': '#B68A3E', '--blush': '#C9886D',
  '--cream': '#EAE5D5', '--line-soft': '#E4DEC8',
};
function resolveCssVars(html) {
  return Object.entries(PDF_COLORS).reduce(
    (s, [k, v]) => s.replaceAll(`var(${k})`, v), html
  );
}

async function downloadPdf(p) {
  const isAndroid = window.Capacitor?.getPlatform?.() === 'android';

  // Dynamic import keeps the initial bundle small
  const [{ default: html2canvas }, jspdfMod, autoTableMod] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default?.jsPDF ?? jspdfMod.default;
  const autoTable = autoTableMod.default ?? autoTableMod;

  const resolvedHtml = resolveCssVars(buildReportDoc(p));
  const parsed = new DOMParser().parseFromString(resolvedHtml, 'text/html');

  // Build an off-screen container with the report's own <style> injected
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:760px;z-index:-1;background:#FBF8EE;';
  const styleEl = document.createElement('style');
  styleEl.textContent = Array.from(parsed.querySelectorAll('style')).map(s => s.textContent).join('\n');
  container.appendChild(styleEl);
  const page = parsed.querySelector('.page');
  if (page) container.appendChild(page);
  // Tabel & penutup dirender ulang secara native (autotable) di bawah agar
  // header kolom berulang tiap halaman → buang dari porsi yang diraster.
  // (Judul diagram di dalam <section.block> aman karena bukan anak langsung .page.)
  container.querySelectorAll('.page > h2.sec, .page > table, .page > .foot').forEach(el => el.remove());
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 350)); // let fonts/layout settle

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#FBF8EE', logging: false,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW   = pdf.internal.pageSize.getWidth();
    const pdfH   = pdf.internal.pageSize.getHeight();
    const imgW   = canvas.width;
    const imgH   = canvas.height;

    // Margin tetap untuk header & footer yang digambar di SETIAP halaman PDF.
    const HEADER_MM = 18, FOOTER_MM = 14, SIDE_MM = 14;
    const PAPER = [251, 248, 238];   // #FBF8EE
    const INK   = [42, 44, 32];      // #2A2C20
    const MUTED = [110, 107, 88];    // #6E6B58
    const LINE  = [216, 210, 190];   // #D8D2BE
    const TW    = pdfW - 2 * SIDE_MM; // lebar area tabel
    const tableMargin = { top: HEADER_MM, bottom: FOOTER_MM, left: SIDE_MM, right: SIDE_MM };

    // ── Bagian 1: porsi visual (kop, KPI, diagram) diraster lalu dipotong ──
    const contentH_mm = pdfH - HEADER_MM - FOOTER_MM;
    const pageContentH_px = (contentH_mm * imgW) / pdfW;

    // Elemen yang tak boleh terpotong saat ganti halaman (diagram, KPI, judul).
    const scale = imgW / container.offsetWidth;          // canvas px : DOM px
    const contTop = container.getBoundingClientRect().top;
    const atomic = Array.from(container.querySelectorAll('.block, .kpis, .net-strip, h2.sec'))
      .map(el => {
        const rr = el.getBoundingClientRect();
        return { top: (rr.top - contTop) * scale, bottom: (rr.bottom - contTop) * scale };
      })
      .sort((a, b) => a.top - b.top);

    let y = 0, firstPage = true;
    while (y < imgH - 1) {
      let end = Math.min(y + pageContentH_px, imgH);
      if (end < imgH) {
        for (const a of atomic) {
          if (a.top > y && a.top < end && a.bottom > end) { end = a.top; break; }
        }
        if (end <= y) end = Math.min(y + pageContentH_px, imgH); // pengaman elemen tinggi
      }
      const sliceH = Math.max(1, Math.round(end - y));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, y, imgW, sliceH, 0, 0, imgW, sliceH);
      if (!firstPage) pdf.addPage();
      pdf.setFillColor(...PAPER);
      pdf.rect(0, 0, pdfW, pdfH, 'F');
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, HEADER_MM, pdfW, (sliceH * pdfW) / imgW);
      firstPage = false;
      y = end;
    }

    // ── Bagian 2: tabel native via autotable (header kolom berulang otomatis) ──
    const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
    const fmtDay = (iso) => { const a = (iso || '').split('-'); return a[2] && a[1] ? `${a[2]}/${a[1]}` : '—'; };
    const txName = (t) => [t.merchant, t.note].filter(Boolean).join(' · ') || '—';
    const hexToRgb = (hex) => {
      const m = hex.replace('#', '');
      const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
      return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
    };
    const resolveColor = (c, fb = '#8C7B5C') => {
      if (typeof c !== 'string') return hexToRgb(fb);
      if (c.startsWith('var(')) return hexToRgb(PDF_COLORS[c.slice(4, -1).trim()] || fb);
      if (c.startsWith('#')) return hexToRgb(c);
      return hexToRgb(fb);
    };

    let cursorY = HEADER_MM;
    const fillPaper = () => { pdf.setFillColor(...PAPER); pdf.rect(0, 0, pdfW, pdfH, 'F'); };
    const addPaperPage = () => { pdf.addPage(); fillPaper(); cursorY = HEADER_MM; };
    addPaperPage();                // tabel selalu mulai di halaman baru (latar krem konsisten)

    const ensureRoom = (need) => {
      if (cursorY > pdfH - FOOTER_MM - need) addPaperPage();
    };
    const drawTitle = (text, big = false) => {
      ensureRoom(big ? 16 : 26);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(big ? 13 : 11);
      pdf.setTextColor(...INK);
      pdf.text(text, SIDE_MM, cursorY + 4);
      cursorY += big ? 9 : 7;
    };
    const runTable = ({ head, body, foot, columnStyles, colors = null }) => {
      autoTable(pdf, {
        head, body, foot,
        startY: cursorY,
        margin: tableMargin,
        theme: 'plain',
        showHead: 'everyPage',          // ← header kolom berulang di setiap halaman
        showFoot: foot ? 'lastPage' : 'never',
        rowPageBreak: 'avoid',          // ← jangan potong baris di tengah
        willDrawPage: (data) => { if (data.pageNumber > 1) fillPaper(); }, // latar krem halaman lanjutan
        styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fontStyle: 'bold', fontSize: 7.5, textColor: MUTED, cellPadding: { top: 1, bottom: 2.8, left: 1.5, right: 1.5 } },
        footStyles: { fontStyle: 'bold', fontSize: 9, textColor: INK },
        columnStyles,
        didDrawCell: (data) => {
          const { x, y: cy, width, height } = data.cell;
          if (data.section === 'head') {
            pdf.setDrawColor(...INK); pdf.setLineWidth(0.4);
            pdf.line(x, cy + height, x + width, cy + height);
          } else if (data.section === 'body') {
            pdf.setDrawColor(...LINE); pdf.setLineWidth(0.1);
            pdf.line(x, cy + height, x + width, cy + height);
            if (colors && data.column.index === 0 && colors[data.row.index]) {
              pdf.setFillColor(...colors[data.row.index]);
              pdf.roundedRect(x + 1.6, cy + height / 2 - 1.4, 2.8, 2.8, 0.6, 0.6, 'F');
            }
          } else if (data.section === 'foot') {
            pdf.setDrawColor(...INK); pdf.setLineWidth(0.5);
            pdf.line(x, cy, x + width, cy);
          }
        },
      });
      cursorY = pdf.lastAutoTable.finalY + 11;
    };

    const catCols = {
      0: { halign: 'left',  cellWidth: TW * 0.5, cellPadding: { left: 5.8, top: 2.2, bottom: 2.2, right: 1.5 } },
      1: { halign: 'right', cellWidth: TW * 0.3 },
      2: { halign: 'right', cellWidth: TW * 0.2 },
    };
    const txCols = {
      0: { halign: 'left',  cellWidth: TW * 0.15 },
      1: { halign: 'left',  cellWidth: TW * 0.35 },
      2: { halign: 'left',  cellWidth: TW * 0.30 },
      3: { halign: 'right', cellWidth: TW * 0.20 },
    };
    const moCols = {
      0: { halign: 'left',  cellWidth: TW * 0.40 },
      1: { halign: 'right', cellWidth: TW * 0.20 },
      2: { halign: 'right', cellWidth: TW * 0.20 },
      3: { halign: 'right', cellWidth: TW * 0.20 },
    };

    // Tabel pemasukan per kategori
    if (p.incomeCats?.length) {
      drawTitle('Tabel — Pemasukan per kategori');
      runTable({
        head: [['KATEGORI', 'JUMLAH', '% DARI PEMASUKAN']],
        body: p.incomeCats.map(c => [c.label, rupiah(c.amount), (p.income ? Math.round(c.amount / p.income * 100) : 0) + '%']),
        foot: [['Total pemasukan', rupiah(p.income), '100%']],
        columnStyles: catCols,
        colors: p.incomeCats.map(c => resolveColor(c.color, '#5C6B4C')),
      });
    }

    // Tabel pengeluaran per kategori
    if (p.cats?.length) {
      drawTitle('Tabel — Pengeluaran per kategori');
      runTable({
        head: [['KATEGORI', 'JUMLAH', '% DARI PENGELUARAN']],
        body: p.cats.map(c => [c.label, rupiah(c.amount), (p.expense ? Math.round(c.amount / p.expense * 100) : 0) + '%']),
        foot: [['Total pengeluaran', rupiah(p.expense), '100%']],
        columnStyles: catCols,
        colors: p.cats.map(c => resolveColor(c.color, '#8C7B5C')),
      });
    }

    // Tabel rincian bulanan (hanya laporan tahunan)
    if (p.months?.length) {
      drawTitle('Tabel — Rincian bulanan');
      runTable({
        head: [['BULAN', 'MASUK', 'KELUAR', 'BERSIH']],
        body: p.months.map(m => [`${m.full} ${m.year}`, rupiah(m.income), rupiah(m.expense), rupiah(m.net)]),
        columnStyles: moCols,
      });
    }

    // Rincian transaksi (pemasukan & pengeluaran)
    const incomeTx  = (p.transactions || []).filter(t => t.amount >= 0);
    const expenseTx = (p.transactions || []).filter(t => t.amount < 0);
    if (incomeTx.length || expenseTx.length) {
      drawTitle('Bagian 4 — Rincian Transaksi', true);
      if (incomeTx.length) {
        drawTitle('Transaksi Pemasukan');
        runTable({
          head: [['TANGGAL', 'NAMA', 'KATEGORI', 'JUMLAH']],
          body: incomeTx.map(t => [fmtDay(t.dateRaw), txName(t), t.catLabel || '—', rupiah(Math.abs(t.amount))]),
          foot: [[{ content: 'Total Pemasukan', colSpan: 3, styles: { halign: 'right' } }, rupiah(p.income)]],
          columnStyles: txCols,
        });
      }
      if (expenseTx.length) {
        drawTitle('Transaksi Pengeluaran');
        runTable({
          head: [['TANGGAL', 'NAMA', 'KATEGORI', 'JUMLAH']],
          body: expenseTx.map(t => [fmtDay(t.dateRaw), txName(t), t.catLabel || '—', rupiah(Math.abs(t.amount))]),
          foot: [[{ content: 'Total Pengeluaran', colSpan: 3, styles: { halign: 'right' } }, rupiah(p.expense)]],
          columnStyles: txCols,
        });
      }
    }

    // ── Penutup ──
    ensureRoom(30);
    cursorY += 4;
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.3);
    pdf.line(SIDE_MM, cursorY, pdfW - SIDE_MM, cursorY);
    cursorY += 7;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...INK);
    pdf.text('Penutup', SIDE_MM, cursorY); cursorY += 6;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...MUTED);
    pdf.text('Dokumen ini bersifat informatif, bukan dokumen pajak resmi.', SIDE_MM, cursorY); cursorY += 5;
    pdf.text(`Laporan dibuat otomatis oleh FinanceApp pada ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`, SIDE_MM, cursorY);

    // ── Header + footer + nomor halaman di SETIAP halaman (pass terakhir) ──
    const headerRight = `Laporan ${p.periodLabel}`;
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      if (i > 1) {  // halaman 1 sudah punya kop lengkap di isinya
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(...INK);
        pdf.text('FinanceApp', SIDE_MM, 11);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...MUTED);
        pdf.text(headerRight, pdfW - SIDE_MM, 11, { align: 'right' });
        pdf.setDrawColor(...LINE);
        pdf.setLineWidth(0.3);
        pdf.line(SIDE_MM, 14, pdfW - SIDE_MM, 14);
      }
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.3);
      pdf.line(SIDE_MM, pdfH - 10, pdfW - SIDE_MM, pdfH - 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      pdf.text('FinanceApp — Laporan dibuat otomatis', SIDE_MM, pdfH - 5);
      pdf.text(`Hal. ${i} dari ${total}`, pdfW - SIDE_MM, pdfH - 5, { align: 'right' });
    }

    if (isAndroid) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = pdf.output('datauristring').split(',')[1];
      const filename = `${p.filename}.pdf`;
      // Android 10+ (scoped storage) melarang tulis langsung ke /Download →
      // EACCES. Simpan ke cache app (tanpa izin), lalu buka dialog Android
      // agar user bisa simpan ke Files / bagikan ke WhatsApp, email, dll.
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      try {
        await Share.share({
          title: filename,
          url: uri,
          dialogTitle: 'Simpan atau bagikan laporan',
        });
      } catch (err) {
        // User menutup dialog bagikan — bukan kegagalan.
        if (!/cancel/i.test(err?.message || '')) throw err;
      }
    } else {
      pdf.save(`${p.filename}.pdf`);
    }
  } finally {
    document.body.removeChild(container);
  }
}

function printReport(p) {
  const html = buildReportDoc(p);
  const w = window.open("", "_blank");
  if (!w) { downloadPdf(p); return; } // popup blocked → fallback
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), 400);
}

// ── Excel preview — HTML table representation of the report data ───
function ExcelPreviewRenderer({ payload }) {
  const { income, expense, net, cats, incomeCats, transactions, months, periodLabel, walletLabel = null } = payload;
  const savingsRate = income ? Math.round((net / income) * 100) : 0;
  const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const fmtDay = (iso) => { const parts = (iso || '').split('-'); return parts[2] && parts[1] ? `${parts[2]}/${parts[1]}/${parts[0]}` : '—'; };
  const resolveDotColor = (color, fallback) => color && !color.startsWith('var') ? color : fallback;

  const TH  = { background: '#2A2C20', color: '#fff', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', border: '1px solid #D8D2BE', textAlign: 'left' };
  const THR = { ...TH, textAlign: 'right' };
  const TD  = { padding: '7px 12px', fontSize: 12.5, border: '1px solid #D8D2BE', color: '#2A2C20', background: '#FBF8EE' };
  const TDR = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const TDF = { ...TD, fontWeight: 700, background: '#EAE5D5' };
  const TDFR = { ...TDF, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  const sectionHead = (title) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2C20', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #2A2C20' }}>{title}</div>
  );

  return (
    <div style={{ fontFamily: "'Geist', -apple-system, sans-serif", maxWidth: 760, margin: '0 auto', paddingBottom: 16 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6E6B58', marginBottom: 4 }}>FinanceApp — Pratinjau Excel</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#2A2C20', letterSpacing: '-.01em' }}>Laporan Keuangan</div>
        <div style={{ fontSize: 13, color: '#6E6B58', marginTop: 2 }}>{periodLabel}</div>
        <div style={{ fontSize: 12, color: '#6E6B58', marginTop: 2 }}>Dompet: {walletLabel || 'Semua Dompet'}</div>
      </div>

      {walletLabel !== null && income === 0 && expense === 0 && transactions.length === 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(178,106,74,.08)', border: '1px solid rgba(178,106,74,.2)', borderRadius: 10, fontSize: 13, color: '#6E6B58', marginBottom: 20 }}>
          Tidak ada transaksi pada periode ini untuk dompet yang dipilih.
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        {sectionHead('Ringkasan')}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={TD}>Total Pemasukan</td><td style={{ ...TDR, color: '#5C6B4C', fontWeight: 600 }}>{rupiah(income)}</td></tr>
            <tr><td style={TD}>Total Pengeluaran</td><td style={{ ...TDR, color: '#B26A4A', fontWeight: 600 }}>{rupiah(expense)}</td></tr>
            <tr><td style={TDF}>Selisih Bersih</td><td style={TDFR}>{rupiah(net)}</td></tr>
            <tr><td style={TD}>Tingkat Menabung</td><td style={TDR}>{savingsRate}%</td></tr>
          </tbody>
        </table>
      </div>

      {months && months.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {sectionHead('Tren Bulanan')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Bulan</th><th style={THR}>Pemasukan</th><th style={THR}>Pengeluaran</th><th style={THR}>Selisih</th></tr></thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i}>
                  <td style={TD}>{m.full} {m.year}</td>
                  <td style={{ ...TDR, color: '#5C6B4C' }}>{rupiah(m.income)}</td>
                  <td style={{ ...TDR, color: '#B26A4A' }}>{rupiah(m.expense)}</td>
                  <td style={TDR}>{rupiah(m.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td style={TDF}>Total</td><td style={{ ...TDFR, color: '#5C6B4C' }}>{rupiah(income)}</td><td style={{ ...TDFR, color: '#B26A4A' }}>{rupiah(expense)}</td><td style={TDFR}>{rupiah(net)}</td></tr></tfoot>
          </table>
        </div>
      )}

      {incomeCats && incomeCats.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {sectionHead('Pemasukan per Kategori')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Kategori</th><th style={THR}>Total</th><th style={THR}>%</th></tr></thead>
            <tbody>
              {incomeCats.map((cat, i) => (
                <tr key={i}>
                  <td style={TD}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: resolveDotColor(cat.color, '#5C6B4C'), marginRight: 8, verticalAlign: 'middle' }} />
                    {cat.label}
                  </td>
                  <td style={{ ...TDR, color: '#5C6B4C' }}>{rupiah(cat.amount)}</td>
                  <td style={TDR}>{income ? Math.round(cat.amount / income * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td style={TDF}>Total Pemasukan</td><td style={{ ...TDFR, color: '#5C6B4C' }}>{rupiah(income)}</td><td style={TDFR}>100%</td></tr></tfoot>
          </table>
        </div>
      )}

      {cats && cats.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {sectionHead('Pengeluaran per Kategori')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>Kategori</th><th style={THR}>Total</th><th style={THR}>%</th></tr></thead>
            <tbody>
              {cats.map((cat, i) => (
                <tr key={i}>
                  <td style={TD}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: resolveDotColor(cat.color, '#8C7B5C'), marginRight: 8, verticalAlign: 'middle' }} />
                    {cat.label}
                  </td>
                  <td style={{ ...TDR, color: '#B26A4A' }}>{rupiah(cat.amount)}</td>
                  <td style={TDR}>{expense ? Math.round(cat.amount / expense * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td style={TDF}>Total Pengeluaran</td><td style={{ ...TDFR, color: '#B26A4A' }}>{rupiah(expense)}</td><td style={TDFR}>100%</td></tr></tfoot>
          </table>
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          {sectionHead('Detail Transaksi')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 36 }}>No</th>
                <th style={TH}>Tanggal</th>
                <th style={TH}>Kategori</th>
                <th style={TH}>Keterangan</th>
                <th style={TH}>Tipe</th>
                <th style={THR}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => {
                const isIncome = t.amount >= 0;
                const ket = [t.merchant, t.note].filter(Boolean).join(' · ') || '—';
                const rowBg = isIncome ? '#E3EFDD' : '#F6E3DC';
                return (
                  <tr key={i}>
                    <td style={{ ...TD, background: rowBg, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...TD, background: rowBg }}>{fmtDay(t.dateRaw)}</td>
                    <td style={{ ...TD, background: rowBg }}>{t.catLabel || '—'}</td>
                    <td style={{ ...TD, background: rowBg, maxWidth: 200, wordBreak: 'break-word' }}>{ket}</td>
                    <td style={{ ...TD, background: rowBg, textAlign: 'center' }}>{isIncome ? 'Pemasukan' : 'Pengeluaran'}</td>
                    <td style={{ ...TDR, background: rowBg, color: isIncome ? '#5C6B4C' : '#B26A4A' }}>{rupiah(Math.abs(t.amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Preview modal ──────────────────────────────────────────────────
// Receives raw data (transactions, accounts) and builds the payload internally
// so that the wallet filter, preview, and download all share ONE data source.
function ReportPreview({ previewMeta, transactions, customCategories, accounts, onClose, canExport }) {
  const { t: tr } = useTranslation();
  const { openPaywall } = usePaywall();
  const [selectedWalletId, setSelectedWalletId] = React.useState("all");
  const [selectedFormat, setSelectedFormat] = React.useState('pdf');
  const [downloading, setDownloading] = React.useState(false);
  const iframeRef = React.useRef(null);

  // Reset wallet filter to "all" each time a new report preview is opened
  React.useEffect(() => {
    if (previewMeta) setSelectedWalletId("all");
  }, [previewMeta]);

  // Edge case: selected wallet deleted → fall back to "all"
  React.useEffect(() => {
    if (selectedWalletId === "all") return;
    if (!accounts.some(a => a.id === selectedWalletId)) setSelectedWalletId("all");
  }, [accounts, selectedWalletId]);

  // ── Single filtered-transaction source shared by preview AND download ──
  const filteredTransactions = React.useMemo(
    () => selectedWalletId === "all"
      ? transactions
      : transactions.filter(t => t.wallet_id === selectedWalletId),
    [transactions, selectedWalletId]
  );

  const walletLabel = selectedWalletId === "all"
    ? null
    : (accounts.find(a => a.id === selectedWalletId)?.name ?? null);

  const payload = React.useMemo(
    () => previewMeta
      ? buildPayload(filteredTransactions, previewMeta.kind, previewMeta.key, customCategories, walletLabel)
      : null,
    [filteredTransactions, previewMeta, customCategories, walletLabel]
  );

  useScrollLock(!!previewMeta);

  React.useEffect(() => {
    if (payload && iframeRef.current && selectedFormat === 'pdf') {
      iframeRef.current.srcdoc = buildReportDoc(payload);
    }
  }, [payload, selectedFormat]);

  if (!previewMeta || !payload) return null;
  const p = payload;

  const handleDownload = async () => {
    if (!canExport) { openPaywall('Unduh laporan PDF/Excel'); return; }
    setDownloading(true);
    try {
      if (selectedFormat === 'pdf') await downloadPdf(p);
      else await downloadExcel(p);
    } catch (e) {
      alert("Gagal membuat file: " + (e?.message || e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="report-preview-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(42,44,32,.4)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24, animation: "rise .25s ease-out" }}>
      <div className="report-preview-container" onClick={e => e.stopPropagation()} style={{ width: 820, maxWidth: "100%", height: "88vh", display: "flex", flexDirection: "column", background: "var(--ivory)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -20px rgba(42,44,32,.5)" }}>

        <div className="report-preview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{p.title}</div>
            <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.periodLabel}</div>
          </div>

          {/* Wallet filter — hanya tampil jika user punya lebih dari 1 dompet */}
          {accounts.length > 1 && (
            <select
              value={selectedWalletId}
              onChange={e => setSelectedWalletId(e.target.value)}
              style={{
                padding: "7px 10px",
                background: "var(--paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: 10,
                color: "var(--ink)",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
                maxWidth: "min(180px, calc(50vw - 24px))",
                flexShrink: 0,
              }}
            >
              <option value="all">Semua Dompet</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {/* Format selector — PDF / Excel toggle */}
          <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, flexShrink: 0 }}>
            {[{ id: "pdf", label: "PDF" }, { id: "excel", label: "Excel" }].map(f => (
              <button key={f.id} onClick={() => setSelectedFormat(f.id)} style={{
                padding: "6px 14px", fontSize: 12, cursor: "pointer",
                background: selectedFormat === f.id ? "var(--ivory)" : "transparent",
                border: selectedFormat === f.id ? "1px solid var(--line-soft)" : "1px solid transparent",
                borderRadius: 8, color: selectedFormat === f.id ? "var(--ink)" : "var(--muted)",
                fontWeight: selectedFormat === f.id ? 500 : 400,
              }}>{f.label}</button>
            ))}
          </div>

          <div className="report-preview-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {selectedFormat === 'pdf' && (
              <button className="report-preview-btn-print" onClick={() => printReport(p)} style={{ padding: "9px 14px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
                <IconReport size={14} /> {tr('laporan.cetakPdf')}
              </button>
            )}
            {canExport && (
              <button onClick={handleDownload} disabled={downloading} style={{ padding: "9px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center", opacity: downloading ? 0.7 : 1, cursor: downloading ? "default" : "pointer" }}>
                {downloading ? <Spinner /> : <IconArrowDown size={14} />}
                <span className="report-preview-btn-label">{tr('laporan.unduh')} ({selectedFormat.toUpperCase()})</span>
              </button>
            )}
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
              <IconClose size={15} />
            </button>
          </div>
        </div>

        {/* Preview content — iframe for PDF, HTML table for Excel */}
        {selectedFormat === 'pdf' ? (
          <iframe ref={iframeRef} title="preview" style={{ flex: 1, border: 0, background: "#cfc9b8" }} />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#f0ece0" }}>
            <ExcelPreviewRenderer payload={p} />
          </div>
        )}

        {/* Upgrade hint — shown only for Basic users */}
        {!canExport && (
          <div style={{ padding: "10px 20px", textAlign: "center", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line-soft)", background: "var(--paper)" }}>
            Upgrade ke Pro untuk download laporan.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Format picker (PDF / Excel) ────────────────────────────────────
const IconPdf = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" />
    <text x="12" y="17" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="700">PDF</text>
  </svg>
);
const IconExcel = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" />
    <path d="M10 12l4 5M14 12l-4 5" />
  </svg>
);

function FormatPicker({ payload, onClose }) {
  const { t: tr } = useTranslation();
  useScrollLock(!!payload);
  const [busy, setBusy] = React.useState(null); // 'pdf' | 'excel' | null
  if (!payload) return null;

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(payload);
      onClose();
    } catch (e) {
      alert("Gagal membuat file: " + (e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const opt = {
    display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
    padding: "16px 18px", borderRadius: 14, border: "1px solid var(--line-soft)",
    background: "var(--paper)", cursor: "pointer", fontSize: 14, color: "var(--ink)",
    boxSizing: "border-box", minWidth: 0,
  };
  const iconWrap = (bg) => ({ width: 44, height: 44, borderRadius: 12, background: bg, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 });

  return (
    <div onClick={() => busy || onClose()} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(42,44,32,.45)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24, animation: "rise .2s ease-out" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "min(400px, 90vw)", background: "var(--ivory)", borderRadius: 18, padding: 20, boxSizing: "border-box", boxShadow: "0 30px 80px -20px rgba(42,44,32,.5)" }}>
        <button onClick={onClose} disabled={!!busy} aria-label={tr('umum.tutup')} style={{ position: "absolute", top: 12, right: 12, zIndex: 1, width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)", opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer" }}>
          <IconClose size={14} />
        </button>
        <div style={{ marginBottom: 4, paddingRight: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('laporan.unduhLaporan')}</div>
          <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{tr('laporan.pilihFormat')}</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>{payload.periodLabel}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => run("pdf", downloadPdf)} disabled={!!busy} style={{ ...opt, opacity: busy && busy !== "pdf" ? 0.5 : 1 }}>
            <span style={iconWrap("var(--terra)")}><IconPdf size={22} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 500 }}>PDF</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{tr('laporan.pdfDesc')}</span>
            </span>
            {busy === "pdf" && <Spinner />}
          </button>

          <button onClick={() => run("excel", downloadExcel)} disabled={!!busy} style={{ ...opt, opacity: busy && busy !== "excel" ? 0.5 : 1 }}>
            <span style={iconWrap("var(--sage)")}><IconExcel size={22} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 500 }}>Excel</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{tr('laporan.excelDesc')}</span>
            </span>
            {busy === "excel" && <Spinner />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ width: 18, height: 18, border: "2px solid var(--line)", borderTopColor: "var(--ink)", borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0 }} />;
}

// ── Reports page ───────────────────────────────────────────────────
export function ReportsPage({ transactions = [], customCategories = [], canExport = true, accounts = [] }) {
  const { t: tr } = useTranslation();
  const { openPaywall } = usePaywall();
  const [scope, setScope] = React.useState("month"); // month | year
  const [preview, setPreview] = React.useState(null); // { kind, key } — raw meta only
  const [downloadTarget, setDownloadTarget] = React.useState(null);

  const months = React.useMemo(() => monthsIndex(transactions), [transactions]);
  const years = React.useMemo(() => yearsIndex(months), [months]);
  const empty = transactions.length === 0;

  // Gate unduh laporan (PDF/Excel) — fitur khusus Pro. Basic → PaywallModal,
  // generator tidak pernah jalan.
  const requestDownload = (payload) => {
    if (!canExport) { openPaywall('Unduh laporan PDF/Excel'); return; }
    setDownloadTarget(payload);
  };

  const openPreview = (kind, key) => setPreview({ kind, key });
  const openDownload = (kind, key) => requestDownload(buildPayload(transactions, kind, key, customCategories));

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('nav.laporan')}</div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>{tr('laporan.judulHalaman')}</h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            {tr('laporan.deskripsi')}
          </div>
        </div>
        <div data-tour="laporan-scope-toggle" style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {[{ id: "month", labelKey: "laporan.bulanan" }, { id: "year", labelKey: "laporan.tahunan" }].map(s => (
            <button key={s.id} onClick={() => setScope(s.id)} style={{
              padding: "8px 16px", fontSize: 12.5,
              background: scope === s.id ? "var(--ivory)" : "transparent",
              border: scope === s.id ? "1px solid var(--line-soft)" : "1px solid transparent",
              borderRadius: 8, color: scope === s.id ? "var(--ink)" : "var(--muted)",
              fontWeight: scope === s.id ? 500 : 400,
            }}>{tr(s.labelKey)}</button>
          ))}
        </div>
      </div>

      {empty && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>{tr('laporan.belumAdaData')}</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
            {tr('laporan.belumAdaDataDesc')}
          </div>
        </div>
      )}

      {!empty && scope === "month" && (
        <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {months.map((m, i) => (
            <ReportCard key={m.key} eyebrow={`${m.full} ${m.year}`} income={m.income} expense={m.expense} net={m.net}
              latest={i === 0} delay={i * 0.03} big={false} tourTarget={i === 0}
              onPreview={() => openPreview("month", m.key)}
              onDownload={() => openDownload("month", m.key)} />
          ))}
        </div>
      )}

      {!empty && scope === "year" && (
        <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {years.map((y, i) => {
            const ms = y.months;
            const sub = ms.length ? `${ms[0].abbr} – ${ms[ms.length - 1].abbr} ${y.year}` : null;
            return (
              <ReportCard key={y.year} eyebrow={tr('laporan.tahun', { tahun: y.year })} income={y.income} expense={y.expense} net={y.net}
                big latest={i === 0} delay={i * 0.04} sub={sub} tourTarget={i === 0}
                onPreview={() => openPreview("year", String(y.year))}
                onDownload={() => openDownload("year", String(y.year))} />
            );
          })}
        </div>
      )}

      <ReportPreview
        previewMeta={preview}
        transactions={transactions}
        customCategories={customCategories}
        accounts={accounts}
        onClose={() => setPreview(null)}
        canExport={canExport}
      />
      <FormatPicker payload={downloadTarget} onClose={() => setDownloadTarget(null)} />
    </div>
  );
}

function ReportCard({ eyebrow, sub, income, expense, net, latest, big, delay, onPreview, onDownload, tourTarget }) {
  const { t: tr } = useTranslation();
  const rate = income ? Math.round((net / income) * 100) : 0;
  return (
    <div className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${delay}s`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: big ? "22px 22px 18px" : "18px 18px 16px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
              {latest ? `${tr('laporan.terbaru')} · ` : ""}{big ? tr('laporan.laporanTahunan') : tr('laporan.laporanBulanan')}
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
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('laporan.masuk')}</div>
            <div className="tnum" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--sage)" }}>{fmtShort(income)}</div>
          </div>
          <div style={{ minWidth: 60 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('laporan.keluar')}</div>
            <div className="tnum" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--terra)" }}>{fmtShort(expense)}</div>
          </div>
          <div style={{ minWidth: 60 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('laporan.bersih')} · {rate}%</div>
            <div className="tnum serif" style={{ fontSize: 16, letterSpacing: "-0.01em" }}>{fmtShort(net)}</div>
          </div>
        </div>
      </div>

      <div data-tour={tourTarget ? "laporan-aksi" : undefined} className="hairline" style={{ display: "flex" }}>
        <button onClick={onPreview} style={{ flex: 1, padding: "12px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink-2)", display: "inline-flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
          {tr('laporan.pratinjau')}
        </button>
        <div style={{ width: 1, background: "var(--line-soft)" }} />
        <button onClick={onDownload} style={{ flex: 1, padding: "12px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink)", fontWeight: 500, display: "inline-flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
          <IconArrowDown size={14} /> {tr('laporan.unduh')}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ReportsPage, buildPayload, downloadPdf, downloadExcel, printReport, buildReportDoc });
