import React from 'react';
import { ALL_CATEGORIES, fmtShort } from './data';
import { IconReport, IconArrowDown, IconClose } from './icons';
import { downloadExcel } from './report-excel';

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
  const catMap = {};
  txs.forEach(t => {
    if (t.amount >= 0) { income += t.amount; }
    else { const a = -t.amount; expense += a; catMap[t.category] = (catMap[t.category] || 0) + a; }
  });
  const cats = Object.entries(catMap).map(([id, amount]) => {
    const c = catList.find(x => x.id === id);
    return { id, label: c?.label || id, color: c?.color || '#8C7B5C', amount };
  }).sort((a, b) => b.amount - a.amount);
  return { income, expense, net: income - expense, cats };
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

// Full payload consumed by BOTH the PDF (buildReportDoc) and Excel (downloadExcel).
function buildPayload(transactions, kind, key, customCategories = []) {
  const catList = [...ALL_CATEGORIES, ...customCategories];
  if (kind === "month") {
    const periodTx = sortDesc(transactions.filter(t => (t.dateRaw || '').slice(0, 7) === key));
    const { income, expense, net, cats } = aggregate(periodTx, catList);
    const year = +key.slice(0, 4), month = +key.slice(5, 7) - 1;
    return {
      kind, title: "Laporan Bulanan",
      periodLabel: `${ID_MONTHS_FULL[month]} ${year}`,
      filename: `Laporan-${ID_MONTHS_FULL[month]}-${year}`,
      excelFilename: `FinanceApp_Laporan_${ID_MONTHS_FULL[month]}_${year}.xlsx`,
      income, expense, net, cats, months: null,
      transactions: withLabels(periodTx, catList),
    };
  }
  // year
  const y = +key;
  const periodTx = sortDesc(transactions.filter(t => (t.dateRaw || '').slice(0, 4) === String(y)));
  const { income, expense, net, cats } = aggregate(periodTx, catList);
  const months = monthsIndex(periodTx).filter(m => m.year === y).sort((a, b) => a.month - b.month);
  return {
    kind, title: "Laporan Tahunan",
    periodLabel: `Tahun ${y}`,
    filename: `Laporan-Tahunan-${y}`,
    excelFilename: `FinanceApp_Laporan_${y}.xlsx`,
    income, expense, net, cats, months,
    transactions: withLabels(periodTx, catList),
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
function buildReportDoc({ title, periodLabel, income, expense, net, cats, months }) {
  const savingsRate = income ? Math.round((net / income) * 100) : 0;
  const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));
  const catRows = cats.map(c => {
    const pct = expense ? Math.round((c.amount / expense) * 100) : 0;
    return `<tr><td><span class="dot" style="background:${c.color.startsWith('var') ? '#8C7B5C' : c.color}"></span>${esc(c.label)}</td><td class="num">${rupiah(c.amount)}</td><td class="num muted">${pct}%</td></tr>`;
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

  <div class="kpis">
    <div class="kpi"><div class="l">Pemasukan</div><div class="v pos">${rupiah(income)}</div></div>
    <div class="kpi"><div class="l">Pengeluaran</div><div class="v neg">${rupiah(expense)}</div></div>
    <div class="kpi net"><div class="l">Selisih bersih</div><div class="v">${rupiah(net)}</div></div>
  </div>
  <div class="net-strip"><span>Tingkat menabung (savings rate)</span><strong>${savingsRate}%</strong></div>

  ${months ? `<section class="block"><h2 class="sec">Diagram batang — pemasukan vs pengeluaran</h2><div class="chart-legend"><span><span class="sq" style="background:var(--sage)"></span>Pemasukan</span><span><span class="sq" style="background:var(--terra)"></span>Pengeluaran</span></div>${reportBarSVG(months)}</section>` : `<section class="block"><h2 class="sec">Diagram batang — pengeluaran per kategori</h2>${reportCatBarSVG(cats, expense)}</section>`}

  <section class="block">
    <h2 class="sec">Diagram lingkaran — komposisi pengeluaran</h2>
    ${reportPieSVG(cats, expense)}
  </section>

  <h2 class="sec">Tabel — pengeluaran per kategori</h2>
  <table><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">% dari pengeluaran</th></tr></thead>
  <tbody>${catRows}</tbody>
  <tfoot><tr><td>Total pengeluaran</td><td class="num">${rupiah(expense)}</td><td class="num">100%</td></tr></tfoot></table>

  ${monthRows ? `<h2 class="sec">Tabel — rincian bulanan</h2><table><thead><tr><th>Bulan</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Bersih</th></tr></thead><tbody>${monthRows}</tbody></table>` : ""}

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
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default?.jsPDF ?? jspdfMod.default;

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
    const pageH_px = (pdfH * imgW) / pdfW;    // canvas pixels per PDF page

    // Potong gambar per halaman, tapi hindari memotong di tengah elemen
    // penting (diagram/section/baris tabel) yang ditandai di bawah.
    const scale = imgW / container.offsetWidth;          // canvas px : DOM px
    const contTop = container.getBoundingClientRect().top;
    const atomic = Array.from(container.querySelectorAll('.block, .kpis, .net-strip, tr'))
      .map(el => {
        const rr = el.getBoundingClientRect();
        return { top: (rr.top - contTop) * scale, bottom: (rr.bottom - contTop) * scale };
      })
      .sort((a, b) => a.top - b.top);

    let y = 0, firstPage = true;
    while (y < imgH - 1) {
      let end = Math.min(y + pageH_px, imgH);
      // Jika batas halaman memotong sebuah elemen, mundurkan ke atas elemen itu
      for (const a of atomic) {
        if (a.top > y && a.top < end && a.bottom > end) { end = a.top; break; }
      }
      const sliceH = Math.max(1, Math.round(end - y));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, y, imgW, sliceH, 0, 0, imgW, sliceH);
      if (!firstPage) pdf.addPage();
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, (sliceH * pdfW) / imgW);
      firstPage = false;
      y = end;
    }

    if (isAndroid) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = pdf.output('datauristring').split(',')[1];
      const filename = `${p.filename}.pdf`;
      await Filesystem.writeFile({
        path: `Download/${filename}`,
        data: base64,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      alert(`PDF berhasil disimpan!\nBuka folder Download di HP kamu.\n${filename}`);
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

// ── Preview modal ──────────────────────────────────────────────────
function ReportPreview({ payload, onClose, onDownload }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (payload && ref.current) ref.current.srcdoc = buildReportDoc(payload);
  }, [payload]);
  if (!payload) return null;
  const p = payload;
  return (
    <div className="report-preview-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(42,44,32,.4)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24, animation: "rise .25s ease-out" }}>
      <div className="report-preview-container" onClick={e => e.stopPropagation()} style={{ width: 820, maxWidth: "100%", height: "88vh", display: "flex", flexDirection: "column", background: "var(--ivory)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -20px rgba(42,44,32,.5)" }}>
        <div className="report-preview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{p.title}</div>
            <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.periodLabel}</div>
          </div>
          <div className="report-preview-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button className="report-preview-btn-print" onClick={() => printReport(p)} style={{ padding: "9px 14px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
              <IconReport size={14} /> Cetak / PDF
            </button>
            <button onClick={() => onDownload(p)} style={{ padding: "9px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
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
        {/* Tombol close — selalu terlihat di pojok kanan atas */}
        <button onClick={onClose} disabled={!!busy} aria-label="Tutup" style={{ position: "absolute", top: 12, right: 12, zIndex: 1, width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)", opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer" }}>
          <IconClose size={14} />
        </button>
        <div style={{ marginBottom: 4, paddingRight: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Unduh laporan</div>
          <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Pilih format</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>{payload.periodLabel}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => run("pdf", downloadPdf)} disabled={!!busy} style={{ ...opt, opacity: busy && busy !== "pdf" ? 0.5 : 1 }}>
            <span style={iconWrap("var(--terra)")}><IconPdf size={22} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 500 }}>PDF</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Dokumen siap cetak — rapi & ringkas</span>
            </span>
            {busy === "pdf" && <Spinner />}
          </button>

          <button onClick={() => run("excel", downloadExcel)} disabled={!!busy} style={{ ...opt, opacity: busy && busy !== "excel" ? 0.5 : 1 }}>
            <span style={iconWrap("var(--sage)")}><IconExcel size={22} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 500 }}>Excel</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>4 sheet, formula aktif, grafik & warna</span>
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
export function ReportsPage({ transactions = [], customCategories = [] }) {
  const [scope, setScope] = React.useState("month"); // month | year
  const [preview, setPreview] = React.useState(null);         // payload
  const [downloadTarget, setDownloadTarget] = React.useState(null); // payload

  const months = React.useMemo(() => monthsIndex(transactions), [transactions]);
  const years = React.useMemo(() => yearsIndex(months), [months]);
  const empty = transactions.length === 0;

  const openPreview = (kind, key) => setPreview(buildPayload(transactions, kind, key, customCategories));
  const openDownload = (kind, key) => setDownloadTarget(buildPayload(transactions, kind, key, customCategories));

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Laporan</div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Laporan keuangan</h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            Setiap periode dirangkum otomatis dari transaksimu — pratinjau, unduh PDF atau Excel.
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

      {empty && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em" }}>Belum ada data</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
            Tambahkan transaksi terlebih dahulu — laporan akan otomatis dirangkum di sini.
          </div>
        </div>
      )}

      {!empty && scope === "month" && (
        <div className="report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {months.map((m, i) => (
            <ReportCard key={m.key} eyebrow={`${m.full} ${m.year}`} income={m.income} expense={m.expense} net={m.net}
              latest={i === 0} delay={i * 0.03}
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
              <ReportCard key={y.year} eyebrow={`Tahun ${y.year}`} income={y.income} expense={y.expense} net={y.net}
                big latest={i === 0} delay={i * 0.04} sub={sub}
                onPreview={() => openPreview("year", String(y.year))}
                onDownload={() => openDownload("year", String(y.year))} />
            );
          })}
        </div>
      )}

      <ReportPreview payload={preview} onClose={() => setPreview(null)} onDownload={(p) => setDownloadTarget(p)} />
      <FormatPicker payload={downloadTarget} onClose={() => setDownloadTarget(null)} />
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

Object.assign(window, { ReportsPage, buildPayload, downloadPdf, downloadExcel, printReport, buildReportDoc });
