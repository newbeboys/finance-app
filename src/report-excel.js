// ── Excel report generation (ExcelJS) ──────────────────────────────
// Builds a styled, formula-driven .xlsx with up to 4 sheets and embedded
// chart images. Pulls everything from a `payload` derived from real
// Supabase transactions (see buildPayload in reports.jsx).

// CSS custom-property → hex, so colors resolve outside the DOM (canvas + xlsx).
const COLOR_VARS = {
  '--ink': '#2A2C20', '--muted': '#6E6B58', '--line': '#D8D2BE', '--paper': '#FBF8EE',
  '--sage': '#5C6B4C', '--terra': '#B26A4A', '--gold': '#B68A3E', '--blush': '#C9886D',
  '--cream': '#EAE5D5',
};

function resolveColor(c) {
  if (!c) return '#8C7B5C';
  if (c.startsWith('var(')) {
    const key = c.slice(4, -1).trim();
    return COLOR_VARS[key] || '#8C7B5C';
  }
  return c;
}

// '#5C6B4C' → 'FF5C6B4C'
function argb(hex) {
  const h = resolveColor(hex).replace('#', '');
  return 'FF' + (h.length === 3 ? h.split('').map(x => x + x).join('') : h).toUpperCase();
}

// Cegah formula/CSV injection: teks user yang diawali = + - @ (atau tab/CR)
// bisa dieksekusi sebagai formula saat dibuka di Excel. Prefiks tanda kutip
// agar selalu diperlakukan sebagai teks biasa.
const safeText = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const rupiahShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1_000_000) return (n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  if (a >= 1_000) return (n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
  return String(Math.round(n));
};

const RP_FMT = '"Rp"\\ #,##0;"Rp"\\ -#,##0';
const PCT_FMT = '0.0%';
const INK = '#2A2C20', LINE = '#D8D2BE', CREAM = '#EAE5D5';
const ROW_INCOME = '#E3EFDD', ROW_EXPENSE = '#F6E3DC';

// ── Canvas chart renderers (return PNG data-URLs) ──────────────────
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;          // 2× for crisp embedding
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.textBaseline = 'middle';
  return { c, ctx, w, h };
}

function barChartPNG(income, expense) {
  const { c, ctx, w, h } = makeCanvas(440, 240);
  ctx.fillStyle = '#FBF8EE'; ctx.fillRect(0, 0, w, h);
  const items = [
    { label: 'Pemasukan', value: income, color: resolveColor('var(--sage)') },
    { label: 'Pengeluaran', value: expense, color: resolveColor('var(--terra)') },
  ];
  const pad = { t: 24, r: 20, b: 44, l: 56 };
  const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  const max = Math.max(income, expense, 1);
  // gridlines
  ctx.strokeStyle = LINE; ctx.fillStyle = '#6E6B58'; ctx.font = '10px sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + innerH - (innerH * i / 4);
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'right'; ctx.fillText(rupiahShort(max * i / 4), pad.l - 6, y);
  }
  const slot = innerW / items.length, bw = Math.min(80, slot * 0.5);
  items.forEach((it, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const bh = (it.value / max) * innerH;
    const y = pad.t + innerH - bh;
    ctx.fillStyle = it.color; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = INK; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(rupiahShort(it.value), x + bw / 2, y - 10);
    ctx.fillStyle = '#6E6B58'; ctx.font = '11px sans-serif';
    ctx.fillText(it.label, x + bw / 2, pad.t + innerH + 16);
  });
  return c.toDataURL('image/png');
}

function pieChartPNG(cats) {
  const { c, ctx, w, h } = makeCanvas(460, 260);
  ctx.fillStyle = '#FBF8EE'; ctx.fillRect(0, 0, w, h);
  const total = cats.reduce((s, x) => s + x.amount, 0) || 1;
  const cx = 120, cy = h / 2, R = 92, r = 52;
  let acc = -Math.PI / 2;
  cats.forEach(cat => {
    const ang = (cat.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, acc, acc + ang);
    ctx.closePath();
    ctx.fillStyle = resolveColor(cat.color); ctx.fill();
    acc += ang;
  });
  // donut hole
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#FBF8EE'; ctx.fill();
  // legend
  let ly = 28;
  ctx.textAlign = 'left';
  cats.slice(0, 9).forEach(cat => {
    ctx.fillStyle = resolveColor(cat.color);
    ctx.fillRect(250, ly - 5, 11, 11);
    ctx.fillStyle = INK; ctx.font = '11px sans-serif';
    const pct = Math.round((cat.amount / total) * 100);
    const label = cat.label.length > 20 ? cat.label.slice(0, 19) + '…' : cat.label;
    ctx.fillText(`${label}  ${pct}%`, 268, ly);
    ly += 22;
  });
  return c.toDataURL('image/png');
}

function lineChartPNG(months) {
  const { c, ctx, w, h } = makeCanvas(620, 280);
  ctx.fillStyle = '#FBF8EE'; ctx.fillRect(0, 0, w, h);
  const pad = { t: 28, r: 18, b: 40, l: 56 };
  const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  const max = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  ctx.strokeStyle = LINE; ctx.fillStyle = '#6E6B58'; ctx.font = '10px sans-serif';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + innerH - (innerH * i / 4);
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'right'; ctx.fillText(rupiahShort(max * i / 4), pad.l - 6, y);
  }
  const x = (i) => months.length <= 1 ? pad.l + innerW / 2 : pad.l + (innerW * i) / (months.length - 1);
  const y = (v) => pad.t + innerH - (v / max) * innerH;
  const drawLine = (key, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    months.forEach((m, i) => { const px = x(i), py = y(m[key]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.fillStyle = color;
    months.forEach((m, i) => { ctx.beginPath(); ctx.arc(x(i), y(m[key]), 3, 0, Math.PI * 2); ctx.fill(); });
  };
  drawLine('income', resolveColor('var(--sage)'));
  drawLine('expense', resolveColor('var(--terra)'));
  // x labels
  ctx.fillStyle = '#6E6B58'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  months.forEach((m, i) => ctx.fillText(m.abbr, x(i), pad.t + innerH + 16));
  // legend
  ctx.textAlign = 'left';
  ctx.fillStyle = resolveColor('var(--sage)'); ctx.fillRect(pad.l, 8, 10, 10);
  ctx.fillStyle = INK; ctx.font = '11px sans-serif'; ctx.fillText('Pemasukan', pad.l + 16, 14);
  ctx.fillStyle = resolveColor('var(--terra)'); ctx.fillRect(pad.l + 110, 8, 10, 10);
  ctx.fillStyle = INK; ctx.fillText('Pengeluaran', pad.l + 126, 14);
  return c.toDataURL('image/png');
}

// ── Styling helpers ────────────────────────────────────────────────
function styleHeaderCell(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(INK) } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  border(cell);
}
function border(cell) {
  const side = { style: 'thin', color: { argb: argb(LINE) } };
  cell.border = { top: side, left: side, bottom: side, right: side };
}
function fillRow(row, hex) {
  row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } }; });
}
function borderRow(row) { row.eachCell(border); }

function autoWidth(ws, mins = {}) {
  ws.columns.forEach((col, i) => {
    let max = mins[i + 1] || 8;
    col.eachCell({ includeEmpty: false }, cell => {
      const v = cell.value;
      let len = 0;
      if (v == null) len = 0;
      else if (typeof v === 'object' && v.formula) len = String(v.result ?? '').length + 2;
      else len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 3, 48);
  });
}

// ── Sheet builders ─────────────────────────────────────────────────
function buildSummarySheet(wb, p, refs) {
  const ws = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: argb(INK) } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 26 }, { width: 22 }, { width: 4 }, { width: 16 }, { width: 16 }, { width: 16 }];

  ws.mergeCells('A1:F1');
  const t1 = ws.getCell('A1');
  t1.value = 'FinanceApp';
  t1.font = { bold: true, size: 22, color: { argb: argb(INK) } };
  t1.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:F2');
  const t2 = ws.getCell('A2');
  t2.value = `Laporan Keuangan — ${p.periodLabel}`;
  t2.font = { size: 13, color: { argb: argb('--muted') } };

  ws.mergeCells('A3:F3');
  ws.getCell('A3').value = 'Less spending · More living';
  ws.getCell('A3').font = { italic: true, size: 10, color: { argb: argb('--muted') } };

  // KPI table (rows 5–8) with live formulas referencing the Detail sheet
  const dn = refs.detailLast; // last detail data row
  const hasData = dn >= 2;
  const incomeF = hasData ? `SUMIFS('Detail Transaksi'!$F$2:$F$${dn},'Detail Transaksi'!$E$2:$E$${dn},"Pemasukan")` : '0';
  const expenseF = hasData ? `SUMIFS('Detail Transaksi'!$F$2:$F$${dn},'Detail Transaksi'!$E$2:$E$${dn},"Pengeluaran")` : '0';

  const rows = [
    ['Total Pemasukan', { formula: incomeF, result: p.income }],
    ['Total Pengeluaran', { formula: expenseF, result: p.expense }],
    ['Selisih Bersih', { formula: 'B5-B6', result: p.net }],
    ['Tingkat Menabung', { formula: 'IF(B5=0,0,B7/B5)', result: p.income ? p.net / p.income : 0 }],
  ];
  let r = 5;
  rows.forEach(([label, val]) => {
    const lc = ws.getCell(`A${r}`), vc = ws.getCell(`B${r}`);
    lc.value = label; lc.font = { bold: r === 7, color: { argb: argb(INK) } };
    lc.alignment = { vertical: 'middle' };
    vc.value = val;
    vc.numFmt = r === 8 ? PCT_FMT : RP_FMT;
    vc.alignment = { horizontal: 'right', vertical: 'middle' };
    vc.font = { bold: r === 7, color: { argb: r === 5 ? argb('--sage') : r === 6 ? argb('--terra') : argb(INK) } };
    border(lc); border(vc);
    if (r === 7) { lc.fill = vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(CREAM) } }; }
    r++;
  });

  // Bar chart image — Pemasukan vs Pengeluaran
  ws.getCell('A10').value = 'Diagram batang — Pemasukan vs Pengeluaran';
  ws.getCell('A10').font = { bold: true, size: 12, color: { argb: argb(INK) } };
  const img = wb.addImage({ base64: barChartPNG(p.income, p.expense).split(',')[1], extension: 'png' });
  ws.addImage(img, { tl: { col: 0, row: 10 }, ext: { width: 440, height: 240 } });
}

function buildDetailSheet(wb, p, refs) {
  const ws = wb.addWorksheet('Detail Transaksi', { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
  const headers = ['No', 'Tanggal', 'Kategori', 'Keterangan', 'Tipe', 'Jumlah'];
  const hr = ws.addRow(headers);
  hr.eachCell(styleHeaderCell);
  hr.height = 22;

  const txs = p.transactions; // already newest → oldest
  txs.forEach((t, i) => {
    const isIncome = t.amount >= 0;
    const ket = [t.merchant, t.note].filter(Boolean).join(' · ') || '—';
    const d = t.dateRaw ? new Date(t.dateRaw + 'T00:00:00') : null;
    const row = ws.addRow([
      i + 1,
      d || t.date,
      safeText(t.catLabel),
      safeText(ket),
      isIncome ? 'Pemasukan' : 'Pengeluaran',
      Math.abs(t.amount),
    ]);
    row.getCell(1).alignment = { horizontal: 'center' };
    if (d) row.getCell(2).numFmt = 'dd mmm yyyy';
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).numFmt = RP_FMT;
    row.getCell(6).alignment = { horizontal: 'right' };
    fillRow(row, isIncome ? ROW_INCOME : ROW_EXPENSE);
    borderRow(row);
  });

  refs.detailLast = txs.length + 1; // last data row index (1 header + N rows)
  const dn = refs.detailLast;

  // Totals — live SUMIFS by type
  const blank = ws.addRow([]); // spacer
  const totIn = ws.addRow(['', '', '', '', 'TOTAL PEMASUKAN',
    txs.length ? { formula: `SUMIFS($F$2:$F$${dn},$E$2:$E$${dn},"Pemasukan")`, result: p.income } : 0]);
  const totEx = ws.addRow(['', '', '', '', 'TOTAL PENGELUARAN',
    txs.length ? { formula: `SUMIFS($F$2:$F$${dn},$E$2:$E$${dn},"Pengeluaran")`, result: p.expense } : 0]);
  [totIn, totEx].forEach(row => {
    row.getCell(5).font = { bold: true, color: { argb: argb(INK) } };
    row.getCell(5).alignment = { horizontal: 'right' };
    const v = row.getCell(6);
    v.numFmt = RP_FMT; v.alignment = { horizontal: 'right' };
    v.font = { bold: true, color: { argb: row === totIn ? argb('--sage') : argb('--terra') } };
    [5, 6].forEach(ci => { border(row.getCell(ci)); row.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(CREAM) } }; });
  });

  autoWidth(ws, { 4: 28 });
}

function buildCategorySheet(wb, p, refs) {
  const ws = wb.addWorksheet('Per Kategori', { views: [{ showGridLines: false }] });
  const hr = ws.addRow(['Kategori', 'Total', 'Persentase']);
  hr.eachCell(styleHeaderCell);
  hr.height = 22;

  const dn = refs.detailLast;
  const cats = p.cats; // sorted desc already
  const firstRow = 2;
  cats.forEach((cat, i) => {
    const rowIdx = firstRow + i;
    const totalF = dn >= 2
      ? { formula: `SUMIFS('Detail Transaksi'!$F$2:$F$${dn},'Detail Transaksi'!$C$2:$C$${dn},A${rowIdx},'Detail Transaksi'!$E$2:$E$${dn},"Pengeluaran")`, result: cat.amount }
      : cat.amount;
    const row = ws.addRow([safeText(cat.label), totalF, null]);
    row.getCell(2).numFmt = RP_FMT;
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).value = { formula: `IF(B${rowIdx}=0,0,B${rowIdx}/$B$${firstRow + cats.length})`, result: p.expense ? cat.amount / p.expense : 0 };
    row.getCell(3).numFmt = PCT_FMT;
    row.getCell(3).alignment = { horizontal: 'right' };
    borderRow(row);
  });

  // Total row
  const totalRowIdx = firstRow + cats.length;
  const tr = ws.addRow(['Total Pengeluaran',
    cats.length ? { formula: `SUM(B${firstRow}:B${totalRowIdx - 1})`, result: p.expense } : 0,
    cats.length ? { formula: `SUM(C${firstRow}:C${totalRowIdx - 1})`, result: 1 } : 1]);
  tr.getCell(1).font = { bold: true };
  tr.getCell(2).numFmt = RP_FMT; tr.getCell(2).alignment = { horizontal: 'right' }; tr.getCell(2).font = { bold: true };
  tr.getCell(3).numFmt = PCT_FMT; tr.getCell(3).alignment = { horizontal: 'right' }; tr.getCell(3).font = { bold: true };
  fillRow(tr, CREAM); borderRow(tr);

  autoWidth(ws, { 1: 24 });

  // Pie chart image
  if (cats.length) {
    const anchorRow = totalRowIdx + 2;
    ws.getCell(`A${anchorRow}`).value = 'Diagram lingkaran — komposisi pengeluaran';
    ws.getCell(`A${anchorRow}`).font = { bold: true, size: 12, color: { argb: argb(INK) } };
    const img = wb.addImage({ base64: pieChartPNG(cats).split(',')[1], extension: 'png' });
    ws.addImage(img, { tl: { col: 0, row: anchorRow }, ext: { width: 460, height: 260 } });
  }
}

function buildTrendSheet(wb, p) {
  const ws = wb.addWorksheet('Tren Bulanan', { views: [{ showGridLines: false }] });
  const hr = ws.addRow(['Bulan', 'Pemasukan', 'Pengeluaran', 'Selisih']);
  hr.eachCell(styleHeaderCell);
  hr.height = 22;

  const months = p.months;
  const firstRow = 2;
  months.forEach((m, i) => {
    const rowIdx = firstRow + i;
    const row = ws.addRow([`${m.full} ${m.year}`, m.income, m.expense,
      { formula: `B${rowIdx}-C${rowIdx}`, result: m.income - m.expense }]);
    [2, 3, 4].forEach(ci => { row.getCell(ci).numFmt = RP_FMT; row.getCell(ci).alignment = { horizontal: 'right' }; });
    row.getCell(2).font = { color: { argb: argb('--sage') } };
    row.getCell(3).font = { color: { argb: argb('--terra') } };
    borderRow(row);
  });

  const lastRow = firstRow + months.length - 1;
  const tr = ws.addRow(['Total',
    { formula: `SUM(B${firstRow}:B${lastRow})`, result: months.reduce((s, m) => s + m.income, 0) },
    { formula: `SUM(C${firstRow}:C${lastRow})`, result: months.reduce((s, m) => s + m.expense, 0) },
    { formula: `SUM(D${firstRow}:D${lastRow})`, result: months.reduce((s, m) => s + (m.income - m.expense), 0) }]);
  tr.getCell(1).font = { bold: true };
  [2, 3, 4].forEach(ci => { tr.getCell(ci).numFmt = RP_FMT; tr.getCell(ci).alignment = { horizontal: 'right' }; tr.getCell(ci).font = { bold: true }; });
  fillRow(tr, CREAM); borderRow(tr);

  autoWidth(ws, { 1: 18 });

  // Line chart image
  const anchorRow = lastRow + 3;
  ws.getCell(`A${anchorRow}`).value = 'Grafik garis — tren bulanan';
  ws.getCell(`A${anchorRow}`).font = { bold: true, size: 12, color: { argb: argb(INK) } };
  const img = wb.addImage({ base64: lineChartPNG(months).split(',')[1], extension: 'png' });
  ws.addImage(img, { tl: { col: 0, row: anchorRow }, ext: { width: 620, height: 280 } });
}

// ── Public API ─────────────────────────────────────────────────────
async function buildWorkbook(p) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FinanceApp';
  wb.created = new Date();

  const refs = { detailLast: 1 };
  // Detail first so its row count is known to formula refs on other sheets…
  buildDetailSheet(wb, p, refs);
  buildSummarySheet(wb, p, refs);
  buildCategorySheet(wb, p, refs);
  if (p.kind === 'year' && p.months && p.months.length) buildTrendSheet(wb, p);

  // …then reorder so Ringkasan opens first (Excel honors worksheet order)
  wb.worksheets.forEach((ws, i) => { ws.orderNo = i; });
  const order = ['Ringkasan', 'Detail Transaksi', 'Per Kategori', 'Tren Bulanan'];
  wb.worksheets.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    .forEach((ws, i) => { ws.orderNo = i; });

  return wb;
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export async function downloadExcel(p) {
  const wb = await buildWorkbook(p);
  const buf = await wb.xlsx.writeBuffer();
  const filename = p.excelFilename;
  const isAndroid = window.Capacitor?.getPlatform?.() === 'android';

  if (isAndroid) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path: `Download/${filename}`,
      data: bufToBase64(buf),
      directory: Directory.ExternalStorage,
      recursive: true,
    });
    alert(`Excel berhasil disimpan!\nBuka folder Download di HP kamu.\n${filename}`);
  } else {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
