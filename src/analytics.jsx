import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, INCOME_CATEGORIES, fmtShort, formatNominal, nominalFontSize } from './data';
import { IconArrowDown } from './icons';
import { SpendingDonut } from './charts';
import { useScrollLock } from './hooks/useScrollLock';
import { InsightsCard, WeeklySummaryCard } from './widgets';
import { MonthYearPicker } from './components/MonthYearPicker';

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Helpers ───────────────────────────────────────────────────────────

function computeBarData(transactions, scope, pickedMonth, monthsArr) {
  const now = new Date();
  const months = monthsArr || MONTHS_ID;

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

  return Array.from({ length: 12 }, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const yr = d.getFullYear(), mo = d.getMonth();
    const pfx = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    const txs = transactions.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
    const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { m: months[mo], income, expense, year: yr, month: mo };
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

function computeIncomeData(transactions, scope, pickedMonth, customCategories = []) {
  const now = new Date();
  let txs;
  if (scope === "month") {
    const yr  = pickedMonth?.year  ?? now.getFullYear();
    const mo  = pickedMonth?.month ?? now.getMonth();
    const pfx = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    txs = transactions.filter(t => t.amount > 0 && t.dateRaw && t.dateRaw.startsWith(pfx));
  } else {
    const oldest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const cutoff = `${oldest.getFullYear()}-${String(oldest.getMonth() + 1).padStart(2, '0')}`;
    txs = transactions.filter(t => t.amount > 0 && t.dateRaw && t.dateRaw.slice(0, 7) >= cutoff);
  }
  // Lookup dari semua kategori (bawaan + kustom) agar nama/warna terbaca;
  // build dari map entries (bukan filter allCats) supaya kategori custom
  // dengan UUID tak hilang meski tidak ada di INCOME_CATEGORIES.
  const allCats = [...CATEGORIES, ...INCOME_CATEGORIES, ...customCategories];
  const map = {};
  txs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  return Object.entries(map)
    .map(([id, amount]) => {
      const c = allCats.find(x => x.id === id);
      return { id, label: c?.label || id, color: c?.color || 'var(--sage)', amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ── Bar Chart ─────────────────────────────────────────────────────────

function BarChart({ data }) {
  const { t } = useTranslation();
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
            <text x="22" y="33" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">{t('analitik.masuk')} <tspan fontWeight="600">{fmtShort(d.income)}</tspan></text>
            <circle cx="14" cy="46" r="3" fill="var(--terra)" />
            <text x="22" y="49" fontSize="11" fill="var(--ink)" fontFamily="Geist, sans-serif">{t('analitik.keluar')} <tspan fontWeight="600">{fmtShort(d.expense)}</tspan></text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── Analytics Page ────────────────────────────────────────────────────

export function AnalyticsPage({ transactions = [], customCategories = [], accounts = [], limits = null }) {
  const { t, i18n } = useTranslation();
  const monthsArr = i18n.language === 'en' ? MONTHS_EN : MONTHS_ID;
  const locale = i18n.language === 'en' ? 'en-US' : 'id-ID';
  const [scope, setScope] = React.useState("year");
  const [pickedMonth, setPickedMonth] = React.useState(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [hoverCat, setHoverCat] = React.useState(null);
  const [hoverIncomeCat, setHoverIncomeCat] = React.useState(null);
  // Filter dompet — default "all"; reset ke "all" setiap kali halaman dibuka (state lokal)
  const [selectedWalletId, setSelectedWalletId] = React.useState("all");

  // Edge case: dompet yang dipilih dihapus → fallback ke "all" tanpa error
  React.useEffect(() => {
    if (selectedWalletId === "all") return;
    if (!accounts.some(a => a.id === selectedWalletId)) setSelectedWalletId("all");
  }, [accounts, selectedWalletId]);

  const now = new Date();
  const activePicked = pickedMonth || { year: now.getFullYear(), month: now.getMonth() };

  // ── useMemo: subset transaksi berdasarkan filter dompet aktif ──────────
  // Semua kalkulasi grafik dan Money IQ dijalankan pada subset ini.
  const filteredByWallet = React.useMemo(
    () => selectedWalletId === "all"
      ? transactions
      : transactions.filter(t => t.wallet_id === selectedWalletId),
    [transactions, selectedWalletId]
  );

  // ── useMemo: transaksi dalam scope tanggal aktif (AND logic dengan filter dompet) ──
  // Dipakai untuk threshold Money IQ (<5 → tampilkan pesan sparse).
  const txInScope = React.useMemo(() => {
    if (scope === "month") {
      const pfx = `${activePicked.year}-${String(activePicked.month + 1).padStart(2, '0')}`;
      return filteredByWallet.filter(t => t.dateRaw && t.dateRaw.startsWith(pfx));
    }
    const oldest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const cutoff = `${oldest.getFullYear()}-${String(oldest.getMonth() + 1).padStart(2, '0')}`;
    return filteredByWallet.filter(t => t.dateRaw && t.dateRaw.slice(0, 7) >= cutoff);
  }, [filteredByWallet, scope, activePicked]); // eslint-disable-line react-hooks/exhaustive-deps

  const bars = React.useMemo(() => computeBarData(filteredByWallet, scope, scope === "month" ? activePicked : null, monthsArr), [filteredByWallet, scope, activePicked, monthsArr]);
  const cats = React.useMemo(() => computeCatData(filteredByWallet, scope, scope === "month" ? activePicked : null), [filteredByWallet, scope, activePicked]);

  const totalIncome  = bars.reduce((s, d) => s + (d.income  || 0), 0);
  const totalExpense = bars.reduce((s, d) => s + (d.expense || 0), 0);
  const net          = totalIncome - totalExpense;

  // Avg: for year = total/12, for month = total/days
  const avgDenominator = scope === "year" ? 12 : new Date(activePicked.year, activePicked.month + 1, 0).getDate();
  const avgExpense     = avgDenominator > 0 ? Math.round(totalExpense / avgDenominator) : 0;
  const avgLabel       = scope === "year" ? t('analitik.rataBulan') : t('analitik.rataHari');

  const catTotal = cats.reduce((s, c) => s + (c.amount || 0), 0);

  const incomeCats = React.useMemo(() => computeIncomeData(filteredByWallet, scope, scope === "month" ? activePicked : null, customCategories), [filteredByWallet, scope, activePicked, customCategories]);
  const incomeCatTotal = incomeCats.reduce((s, c) => s + (c.amount || 0), 0);

  const stats = [
    { l: t('analitik.totalPemasukan'),  v: totalIncome  || 0, c: "var(--sage)" },
    { l: t('analitik.totalPengeluaran'), v: totalExpense || 0, c: "var(--terra)" },
    { l: t('analitik.selisihBersih'),   v: net          || 0, c: net >= 0 ? "var(--ink)" : "var(--terra)" },
    { l: avgLabel,                       v: avgExpense   || 0, c: "var(--muted)" },
  ];

  // Available months for picker — selalu dari semua transaksi, bukan filteredByWallet,
  // supaya pilihan bulan tidak berubah saat user ganti filter dompet.
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
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const byYear = {};
  availableMonths.forEach(m => { (byYear[m.year] ||= []).push(m); });

  const pickedLabel = `${monthsArr[activePicked.month]} ${activePicked.year}`;
  const rangeLabel  = scope === "year" ? t('analitik.sataTahunTerakhir') : pickedLabel;

  const hasData           = totalIncome > 0 || totalExpense > 0;
  // Threshold: kurang dari 5 transaksi dalam scope aktif → Money IQ sparse
  const isDataSparse      = txInScope.length < 5;
  // Empty state khusus dompet: wallet dipilih tapi 0 transaksi di scope ini
  const showWalletEmpty   = selectedWalletId !== "all" && txInScope.length === 0;

  return (
    <>
      <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.eyebrow', { range: rangeLabel })}</div>
            <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>{t('analitik.judulHalaman')}</h2>
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
              {t('analitik.deskripsi')}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Scope filter */}
            <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              <button onClick={() => setScope("year")} style={{ padding: "8px 16px", fontSize: 12.5, background: scope === "year" ? "var(--ivory)" : "transparent", border: scope === "year" ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: scope === "year" ? "var(--ink)" : "var(--muted)", fontWeight: scope === "year" ? 500 : 400 }}>
                {t('analitik.saTahun')}
              </button>
              <button onClick={() => { setScope("month"); setSheetOpen(true); }} style={{ padding: "8px 16px", fontSize: 12.5, background: scope === "month" ? "var(--ivory)" : "transparent", border: scope === "month" ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: scope === "month" ? "var(--ink)" : "var(--muted)", fontWeight: scope === "month" ? 500 : 400 }}>
                {scope === "month" ? pickedLabel : t('analitik.saBulan')} ▾
              </button>
            </div>

            {/* Wallet filter — HANYA tampil jika user punya lebih dari 1 dompet */}
            {accounts.length > 1 && (
              <select
                value={selectedWalletId}
                onChange={e => setSelectedWalletId(e.target.value)}
                style={{
                  padding: "9px 12px",
                  background: "var(--paper)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 10,
                  color: "var(--ink)",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                  maxWidth: "min(200px, calc(50vw - 24px))",
                }}
              >
                <option value="all">{t('analitik.semuaDompet')}</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}

            <button onClick={() => { if (window.buildPayload && window.downloadPdf) window.downloadPdf(window.buildPayload(transactions, "year", String(now.getFullYear()))); }} style={{ padding: "10px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", gap: 7, alignItems: "center" }}>
              <IconArrowDown size={14} /> {t('analitik.unduhLaporan')}
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

        {/* Grafik + Money IQ: tampilkan empty state khusus jika dompet dipilih tapi kosong di periode ini */}
        {showWalletEmpty ? (
          <div className="card rise" style={{ padding: 48, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ink-2)" }}>{t('analitik.belumAdaTransaksiDompet')}</div>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="card rise" style={{ padding: 22, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.diagramBatang')}</div>
                  <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2 }}>{t('analitik.pemasukVsKeluar')}</div>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--sage)" }} /> {t('analitik.masuk')}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--terra)" }} /> {t('analitik.keluar')}</span>
                </div>
              </div>
              {!hasData ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 160, color: "var(--muted)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="13" width="4" height="8" rx="1"/></svg>
                  <div style={{ fontSize: 13 }}>{t('analitik.belumAdaData')}</div>
                </div>
              ) : (
                <BarChart data={bars} />
              )}
            </div>

            {/* ── Diagram lingkaran + Tabel: Pemasukan & Pengeluaran ── */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.9fr) 1.4fr", gap: 16 }} className="analytics-chart-grid">

              {/* Donut pemasukan — mobile: order 1 */}
              {incomeCats.length > 0 && (
                <div className="card rise analytics-income-donut" style={{ padding: 22 }}>
                  <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.diagramLingkaran')}</div>
                  <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 6 }}>{t('analitik.komposisiPemasukan')}</div>
                  <SpendingDonut data={incomeCats} active={hoverIncomeCat} onHover={setHoverIncomeCat} fmtFn={fmtShort} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, justifyContent: "center" }}>
                    {incomeCats.slice(0, 6).map((c, i) => (
                      <span key={c.id} onMouseEnter={() => setHoverIncomeCat(i)} onMouseLeave={() => setHoverIncomeCat(null)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)", cursor: "default" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabel pemasukan — mobile: order 3 */}
              {incomeCats.length > 0 && (
                <div className="card rise analytics-income-table" style={{ padding: "22px 22px 8px" }}>
                  <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.tabelStatistik')}</div>
                  <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 12 }}>{t('analitik.pemasukPerKategori')}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
                        <th style={{ textAlign: "left", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>{t('analitik.kategori')}</th>
                        <th style={{ textAlign: "right", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>{t('analitik.jumlah')}</th>
                        <th style={{ textAlign: "right", padding: "0 0 10px 16px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500, width: 90 }}>{t('analitik.porsi')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeCats.map((c, i) => {
                        const pct = incomeCatTotal > 0 ? Math.round((c.amount / incomeCatTotal) * 100) : 0;
                        return (
                          <tr key={c.id} onMouseEnter={() => setHoverIncomeCat(i)} onMouseLeave={() => setHoverIncomeCat(null)}
                            style={{ background: hoverIncomeCat === i ? "var(--paper)" : "transparent" }}>
                            <td style={{ padding: "10px 0", borderBottom: i < incomeCats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                                <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} /> {c.label}
                              </span>
                            </td>
                            <td className="tnum" style={{ textAlign: "right", padding: "10px 0", borderBottom: i < incomeCats.length - 1 ? "1px solid var(--line-soft)" : 0, fontWeight: 500 }}>{fmtShort(c.amount)}</td>
                            <td style={{ textAlign: "right", padding: "10px 0 10px 16px", borderBottom: i < incomeCats.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
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
                        <td style={{ padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{t('analitik.total')}</td>
                        <td className="tnum" style={{ textAlign: "right", padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{fmtShort(incomeCatTotal)}</td>
                        <td style={{ textAlign: "right", padding: "12px 0 12px 16px", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Donut pengeluaran — mobile: order 2 */}
              <div className="card rise analytics-expense-donut" style={{ padding: 22 }}>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.diagramLingkaran')}</div>
                <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 6 }}>{t('analitik.komposisiPengeluaran')}</div>
                {cats.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180, color: "var(--muted)" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                    <div style={{ fontSize: 13 }}>{t('analitik.belumAdaPengeluaran')}</div>
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

              {/* Tabel pengeluaran — mobile: order 4 */}
              <div className="card rise analytics-expense-table" style={{ padding: "22px 22px 8px" }}>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('analitik.tabelStatistik')}</div>
                <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.01em", marginTop: 2, marginBottom: 12 }}>{t('analitik.rincianPerKategori')}</div>
                {cats.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t('analitik.belumAdaKategori')}</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
                        <th style={{ textAlign: "left", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>{t('analitik.kategori')}</th>
                        <th style={{ textAlign: "right", padding: "0 0 10px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500 }}>{t('analitik.jumlah')}</th>
                        <th style={{ textAlign: "right", padding: "0 0 10px 16px", borderBottom: "1px solid var(--line-soft)", fontWeight: 500, width: 90 }}>{t('analitik.porsi')}</th>
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
                        <td style={{ padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{t('analitik.total')}</td>
                        <td className="tnum" style={{ textAlign: "right", padding: "12px 0", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>{fmtShort(catTotal)}</td>
                        <td style={{ textAlign: "right", padding: "12px 0 12px 16px", borderTop: "2px solid var(--ink)", fontWeight: 600 }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

            </div>

            {/* ── Money IQ (InsightsCard) ─────────────────────────────────────
                Threshold: jika transaksi dalam scope aktif < 5, tampilkan
                pesan sparse sebagai ganti insight (hindari insight misleading). */}
            <div style={{ marginTop: 16 }}>
              {isDataSparse ? (
                <div className="card rise" style={{ padding: 22, display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em", marginBottom: 8 }}>Money IQ</div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                      {t('analitik.dataTerlaluSedikit')}
                    </div>
                  </div>
                </div>
              ) : (
                <InsightsCard transactions={txInScope} customCategories={customCategories} limits={limits} />
              )}
            </div>
          </>
        )}

        {/* ── WeeklySummaryCard ───────────────────────────────────────────────
            Selalu tampil (dihitung berdasarkan filteredByWallet, bukan txInScope).
            key={selectedWalletId} → paksa remount saat wallet berubah supaya
            useState initializer membaca dismissKey yang benar dari localStorage. */}
        <div style={{ marginTop: 16 }}>
          <WeeklySummaryCard
            key={selectedWalletId}
            walletId={selectedWalletId}
            transactions={filteredByWallet}
          />
        </div>
      </div>

      <MonthYearPicker
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={(month, year) => {
          setPickedMonth({ year, month });
          setSheetOpen(false);
        }}
        locale={locale}
      />
    </>
  );
}

Object.assign(window, { AnalyticsPage, BarChart });
