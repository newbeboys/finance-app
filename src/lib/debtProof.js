import i18n from '../i18n';
import { logError } from './errorLogger';

// ════════════════════════════════════════════════════════════════════
//  debtProof — generate PDF "bukti catatan" untuk satu hutang/piutang.
//  Fungsi murni: TIDAK menyentuh komponen UI apapun, TIDAK query Supabase
//  (payments/debt diterima penuh dari pemanggil). Pola PDF native (autotable,
//  tanpa raster/html2canvas) mengikuti downloadPdf() di reports.jsx — beda
//  dari reports.jsx, dokumen ini SEPENUHNYA native (tidak ada bagian yang
//  dirender via html2canvas sama sekali), jadi tidak butuh atomic-slicing.
//
//  i18n: modul-level (bukan komponen React) → i18n.t() di-resolve SAAT
//  DIPANGGIL, bukan konstanta modul-level, supaya ikut bahasa aktif.
//  Pola sama persis dengan LOCKED_MSG di useDebts.js / T = {...} di reports.jsx.
// ════════════════════════════════════════════════════════════════════

// Hex sama persis dengan PDF_COLORS di reports.jsx — subset yang dipakai di sini.
const PDF_COLORS = {
  '--ink': '#2A2C20', '--muted': '#6E6B58', '--line': '#D8D2BE', '--paper': '#FBF8EE',
  '--sage': '#5C6B4C', '--terra': '#B26A4A', '--gold': '#B68A3E',
};

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function resolveColor(c, fb = '#8C7B5C') {
  if (typeof c !== 'string') return hexToRgb(fb);
  if (c.startsWith('var(')) return hexToRgb(PDF_COLORS[c.slice(4, -1).trim()] || fb);
  if (c.startsWith('#')) return hexToRgb(c);
  return hexToRgb(fb);
}

// Currency SENGAJA terkunci id-ID/"Rp" — tidak ikut bahasa UI (lihat CLAUDE.md
// § Currency). Replika fmt() dari data.jsx, bukan import — mengikuti presedan
// rupiah() lokal di reports.jsx (juga "locked, not migrated"), supaya lib ini
// tidak menyeret data.jsx (berisi definisi ikon JSX) hanya untuk satu formatter.
const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

// Sanitize nama orang untuk nama file: spasi → underscore, buang karakter invalid.
// Sama pola dengan sanitizeFilename() di reports.jsx.
function sanitizeFilename(name) {
  return String(name || '').trim().replace(/\s+/g, '_').replace(/[/\\:*?"<>|]/g, '') || 'catatan';
}

// Tanggal ikut bahasa UI (bukan currency) — pola dateLocale()/longDate() reports.jsx.
const dateLocale = () => (i18n.language === 'en' ? 'en-US' : 'id-ID');
function fmtDateLong(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Generate PDF bukti catatan hutang/piutang dan simpan/bagikan.
 *
 * @param {object} debt - bentuk toAppDebt() dari useDebts.js (id, type,
 *   person_name, note, amount, paid, remaining, date, due_date, status, …).
 * @param {Array}  payments - riwayat cicilan (baris debt_payments), DIOPER
 *   dari komponen pemanggil — fungsi ini TIDAK query ulang ke Supabase.
 * @param {object} opts - { isPro: boolean } — isPro=false → tambah watermark halus.
 * @returns {Promise<{error: null|Error}>}
 */
export async function generateDebtProof(debt, payments = [], opts = {}) {
  try {
    const isAndroid = window.Capacitor?.getPlatform?.() === 'android';
    const isReceivable = debt.type === 'receivable';
    const accent = resolveColor(isReceivable ? 'var(--sage)' : 'var(--terra)', isReceivable ? '#5C6B4C' : '#B26A4A');

    // Dynamic import — menjaga bundle awal tetap kecil (pola downloadPdf() reports.jsx).
    const [jspdfMod, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default?.jsPDF ?? jspdfMod.default;
    const autoTable = autoTableMod.default ?? autoTableMod;

    // Semua label statis di-resolve sekali di sini, bukan inline berulang.
    const T = {
      docTitle:      i18n.t('debts.proof.docTitle'),
      typeLabel:     i18n.t(`debts.badge.${isReceivable ? 'receivable' : 'payable'}`),
      partyLabel:    i18n.t(isReceivable ? 'debts.field.lentTo' : 'debts.field.borrowedFrom'),
      labelAmount:   i18n.t('debts.proof.labelAmount'),
      labelPaid:     i18n.t('debts.proof.labelPaid'),
      labelRemaining: i18n.t('debts.proof.labelRemaining'),
      labelDate:     i18n.t('debts.proof.labelDate'),
      labelDueDate:  i18n.t('debts.field.dueDate'),
      labelStatus:   i18n.t('debts.proof.labelStatus'),
      statusActive:  i18n.t('debts.proof.statusActive'),
      statusPaid:    i18n.t('debts.badge.paid'),
      historyTitle:  i18n.t('debts.history.title'),
      historyEmpty:  i18n.t('debts.history.empty'),
      colDate:       i18n.t('debts.proof.colDate'),
      colNote:       i18n.t('debts.proof.colNote'),
      colAmount:     i18n.t('debts.proof.colAmount'),
      closing:       i18n.t('debts.proof.closing'),
      disclaimer:    i18n.t('debts.proof.disclaimer'),
      generatedOn:   i18n.t('debts.proof.generatedOn', { tanggal: fmtDateLong(new Date().toISOString().slice(0, 10)) }),
      watermark:     i18n.t('debts.proof.watermark'),
      shareDialogTitle: i18n.t('debts.proof.shareDialogTitle'),
      notYetBilled:     i18n.t('debts.badge.notYetBilled'),
      notYetBilledHint: i18n.t('debts.badge.notYetBilledHint'),
    };

    // Piutang berupa tagihan yang belum dibayar — belum ada uang berpindah
    // saat catatan dibuat (lihat cash_disbursed_at_creation di toAppDebt(),
    // useDebts.js). Sudah terbawa apa adanya di object `debt` yang diterima,
    // tidak perlu query tambahan.
    const notYetBilled = isReceivable && debt.cash_disbursed_at_creation === false;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const SIDE_MM = 16, TOP_MM = 20, FOOTER_MM = 14;
    const TW = pdfW - 2 * SIDE_MM;
    const INK = resolveColor('var(--ink)'), MUTED = resolveColor('var(--muted)'), LINE = resolveColor('var(--line)');

    let cursorY = TOP_MM;
    const row = (label, value, big = false) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...MUTED);
      pdf.text(label, SIDE_MM, cursorY);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(big ? 15 : 11);
      pdf.setTextColor(...INK);
      pdf.text(String(value), SIDE_MM, cursorY + (big ? 7 : 6));
      cursorY += big ? 13 : 10;
    };

    // ── Header ──
    pdf.setFillColor(...accent);
    pdf.rect(0, 0, pdfW, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    pdf.text('FinanceApp', SIDE_MM, cursorY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...MUTED);
    pdf.text(`${T.docTitle} — ${T.typeLabel}`, pdfW - SIDE_MM, cursorY, { align: 'right' });
    cursorY += 4;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(SIDE_MM, cursorY, pdfW - SIDE_MM, cursorY);
    cursorY += 10;

    // ── Pihak ──
    row(T.partyLabel, debt.person_name || '—', true);
    if (notYetBilled) {
      // Badge "Belum Ditagih" — reuse teks i18n yang sudah ada di DebtDetailSheet.jsx,
      // bukan teks baru. Piutang jenis ini: uang belum berpindah saat dibuat.
      // stripForPdf: helvetica bawaan jsPDF cuma dukung Latin-1, jadi karakter di
      // luar range itu (emoji 📋, em dash —, dst.) dibuang KHUSUS untuk versi yang
      // masuk PDF — key i18n & tampilan UI (DebtDetailSheet.jsx) tetap apa adanya.
      const stripForPdf = (s) => s.replace(/[^\x00-\xFF]/g, '').trim();
      const badgeText = stripForPdf(T.notYetBilled);
      const hintText = stripForPdf(T.notYetBilledHint);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      const badgeW = pdf.getTextWidth(badgeText) + 6;
      pdf.setFillColor(...resolveColor('var(--gold)'));
      pdf.roundedRect(SIDE_MM, cursorY - 4.2, badgeW, 6, 1.2, 1.2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text(badgeText, SIDE_MM + 3, cursorY);
      cursorY += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      const hintLines = pdf.splitTextToSize(hintText, TW);
      pdf.text(hintLines, SIDE_MM, cursorY);
      cursorY += hintLines.length * 3.8 + 3;
    }
    if (debt.note) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...MUTED);
      pdf.text(debt.note, SIDE_MM, cursorY);
      cursorY += 9;
    }
    cursorY += 2;

    // ── Ringkasan jumlah (3 kolom) ──
    const colW = TW / 3;
    const summaryTop = cursorY;
    const summaryCols = [
      [T.labelAmount, rupiah(debt.amount)],
      [T.labelPaid, rupiah(debt.paid)],
      [T.labelRemaining, rupiah(debt.remaining ?? Math.max(0, (debt.amount || 0) - (debt.paid || 0)))],
    ];
    summaryCols.forEach(([label, value], i) => {
      const x = SIDE_MM + i * colW;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text(label, x, summaryTop);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12.5);
      pdf.setTextColor(...(i === 2 ? accent : INK));
      pdf.text(value, x, summaryTop + 7);
    });
    cursorY = summaryTop + 15;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(SIDE_MM, cursorY, pdfW - SIDE_MM, cursorY);
    cursorY += 10;

    // ── Tanggal & status ──
    row(T.labelDate, fmtDateLong(debt.date));
    if (debt.due_date) row(T.labelDueDate, fmtDateLong(debt.due_date));
    row(T.labelStatus, debt.status === 'paid' ? T.statusPaid : T.statusActive);
    cursorY += 4;

    // ── Riwayat cicilan ──
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text(T.historyTitle, SIDE_MM, cursorY);
    cursorY += 6;

    if (!payments.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...MUTED);
      pdf.text(T.historyEmpty, SIDE_MM, cursorY);
      cursorY += 8;
    } else {
      autoTable(pdf, {
        head: [[T.colDate.toUpperCase(), T.colNote.toUpperCase(), T.colAmount.toUpperCase()]],
        body: payments.map(p => [fmtDateShort(p.date), p.note || '—', rupiah(p.amount)]),
        startY: cursorY,
        margin: { top: TOP_MM, bottom: FOOTER_MM, left: SIDE_MM, right: SIDE_MM },
        theme: 'plain',
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 }, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fontStyle: 'bold', fontSize: 7.5, textColor: MUTED, cellPadding: { top: 1, bottom: 2.8, left: 1.5, right: 1.5 } },
        columnStyles: {
          0: { halign: 'left', cellWidth: TW * 0.25 },
          1: { halign: 'left', cellWidth: TW * 0.45 },
          2: { halign: 'right', cellWidth: TW * 0.30 },
        },
        didDrawCell: (data) => {
          const { x, y: cy, width, height } = data.cell;
          if (data.section === 'head') {
            pdf.setDrawColor(...INK); pdf.setLineWidth(0.4);
            pdf.line(x, cy + height, x + width, cy + height);
          } else if (data.section === 'body') {
            pdf.setDrawColor(...LINE); pdf.setLineWidth(0.1);
            pdf.line(x, cy + height, x + width, cy + height);
          }
        },
      });
      cursorY = pdf.lastAutoTable.finalY + 10;
    }

    // ── Penutup (disclaimer wajib — bukan dokumen hukum) ──
    if (cursorY > pdfH - FOOTER_MM - 30) { pdf.addPage(); cursorY = TOP_MM; }
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(SIDE_MM, cursorY, pdfW - SIDE_MM, cursorY);
    cursorY += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(T.closing, SIDE_MM, cursorY);
    cursorY += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    const disclaimerLines = pdf.splitTextToSize(T.disclaimer, TW);
    pdf.text(disclaimerLines, SIDE_MM, cursorY);
    cursorY += disclaimerLines.length * 4.2;

    // ── Footer tiap halaman: tanggal + no. halaman, + watermark halus kalau Basic ──
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.3);
      pdf.line(SIDE_MM, pdfH - 10, pdfW - SIDE_MM, pdfH - 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(T.generatedOn, SIDE_MM, pdfH - 5);
      pdf.text(i18n.t('debts.proof.pageOf', { n: i, total }), pdfW - SIDE_MM, pdfH - 5, { align: 'right' });

      // Watermark HALUS Basic-tier — teks kecil terpisah, bukan stempel diagonal.
      // Sengaja tidak mengorbankan keterbacaan dokumen sebagai "bukti".
      if (!opts.isPro) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...MUTED);
        pdf.text(T.watermark, pdfW / 2, pdfH - 3, { align: 'center' });
      }
    }

    // ── Simpan / bagikan ──
    const filename = `Bukti-${sanitizeFilename(debt.person_name)}-${String(debt.id).slice(0, 8)}`;
    if (isAndroid) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = pdf.output('datauristring').split(',')[1];
      const fullFilename = `${filename}.pdf`;
      const { uri } = await Filesystem.writeFile({
        path: fullFilename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      try {
        await Share.share({
          title: fullFilename,
          url: uri,
          dialogTitle: T.shareDialogTitle,
        });
      } catch (err) {
        // User menutup dialog bagikan — bukan kegagalan.
        if (!/cancel/i.test(err?.message || '')) throw err;
      }
    } else {
      pdf.save(`${filename}.pdf`);
    }

    return { error: null };
  } catch (err) {
    logError('debtProof', err?.message || String(err), { debt_id: debt?.id }, 'medium');
    return { error: err };
  }
}
