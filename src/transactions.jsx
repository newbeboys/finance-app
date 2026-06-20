import React from 'react';
import { useTranslation } from 'react-i18next';
import { TRANSACTIONS, CATEGORIES, INCOME_CATEGORIES, fmt } from './data';

import { IconFilter, IconPlus, IconArrowRight, IconClose, IconCalendar, IconChev, CatIcon } from './icons';
import { ghostBtn } from './widgets';
import { ScanStrukButton } from './components/ScanStruk';
import { useIsMobile } from './use-mobile';
import { useScrollLock } from './hooks/useScrollLock';
import { CategoryField, CUSTOM_ID, CUSTOM_COLORS, resolveCategory, categoryLabel } from './category-field';
import { playSound } from './lib/sound';
import incomeSound from './assets/sound/incom-sound.wav';
import { formatRupiahInput } from './utils/numberFormat';

export function TransactionsCard({ onAdd, onScan, scanLocked = false, limit, onSeeAll, transactions: txProp, loading = false, customCategories = [] }) {
  const { t: tr } = useTranslation();
  const transactions = txProp ?? TRANSACTIONS;
  const isMobile = useIsMobile();
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);

  const filteredAll = transactions.filter(t => {
    if (filter === "expense") return t.amount < 0;
    if (filter === "income")  return t.amount > 0;
    return true;
  });
  const filtered = limit ? filteredAll.slice(0, limit) : filteredAll;

  const tabs = [
    { id: "all",     label: tr('transaksi.semua'),  count: transactions.length },
    { id: "expense", label: tr('transaksi.keluar'), count: transactions.filter(t => t.amount < 0).length },
    { id: "income",  label: tr('transaksi.masuk'),  count: transactions.filter(t => t.amount > 0).length },
  ];

  const grouped = filtered.reduce((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="card rise span-2" style={{ padding: isMobile ? "16px 14px 8px" : "22px 22px 8px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('transaksi.aktivitasTerbaru')}</div>
          <div className="serif" style={{ fontSize: isMobile ? 20 : 26, marginTop: 2, letterSpacing: "-0.01em" }}>{tr('transaksi.beberapaHariTerakhir')}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)} style={{ padding: isMobile ? "7px 10px" : "6px 12px", fontSize: isMobile ? 12 : 12, background: filter === t.id ? "var(--ivory)" : "transparent", border: filter === t.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: filter === t.id ? "var(--ink)" : "var(--muted)", fontWeight: filter === t.id ? 500 : 400, display: "inline-flex", alignItems: "center", gap: 5 }}>
                {t.label}
                {!isMobile && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.count}</span>}
              </button>
            ))}
          </div>
          {!isMobile && <button style={ghostBtn}><IconFilter size={13} /></button>}
          {onScan && <ScanStrukButton onClick={onScan} isMobile={isMobile} locked={scanLocked} />}
          <button onClick={onAdd} style={{ padding: isMobile ? "8px 12px" : "7px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={13} /> {tr('transaksi.tambah')}
          </button>
        </div>
      </div>

      {/* Desktop table header */}
      <div className="tx-header-desktop" style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 1fr 1fr 1fr 140px", padding: "0 4px 8px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
        <span>{tr('transaksi.merchant')}</span><span>{tr('transaksi.kategori')}</span><span>{tr('transaksi.metode')}</span><span>{tr('transaksi.waktu')}</span>
        <span style={{ textAlign: "right" }}>{tr('transaksi.jumlah')}</span>
      </div>

      {/* Mobile: simple divider */}
      {isMobile && <div style={{ borderBottom: "1px solid var(--line-soft)", marginBottom: 2 }} />}

      {loading && transactions.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", color: "var(--muted)", fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {tr('umum.memuat')}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 16px", textAlign: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>{tr('transaksi.belumAdaTransaksi')}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{tr('transaksi.mulaiTambahkan')}</div>
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div style={{ padding: "12px 4px 6px", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="serif" style={{ fontSize: 14, color: "var(--ink-2)", fontStyle: "italic", letterSpacing: 0 }}>{date}</span>
            <span style={{ flex: 1, borderBottom: "1px dashed var(--line-soft)", marginBottom: 4 }} />
            <span className="tnum">
              {items.reduce((s, t) => s + t.amount, 0) >= 0 ? "+" : "−"}
              {fmt(Math.abs(items.reduce((s, t) => s + t.amount, 0)))}
            </span>
          </div>

          {items.map((t, i) => {
            const cat = resolveCategory(t.category, customCategories);
            const isIncome = t.amount > 0;
            const color = cat?.color || (isIncome ? "var(--sage)" : "var(--muted-2)");
            const borderBottom = i < items.length - 1 ? "1px solid var(--line-soft)" : 0;

            return (
              <React.Fragment key={t.id}>
                {/* ── Mobile row ── */}
                <div className="tx-row-mobile"
                  style={{ alignItems: "center", gap: 12, padding: "11px 2px", borderBottom }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in oklch, ${color} 14%, var(--ivory))`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <CatIcon kind={t.category} size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{categoryLabel(cat, tr, t.category)} · {t.time}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: isIncome ? "var(--sage)" : "var(--ink)", flexShrink: 0 }}>
                    {isIncome ? "+" : "−"}{fmt(Math.abs(t.amount))}
                  </div>
                </div>

                {/* ── Desktop row ── */}
                <div className="tx-row-desktop"
                  onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
                  style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 1fr 1fr 1fr 140px", alignItems: "center", padding: "12px 4px", borderBottom, background: hover === t.id ? "var(--paper)" : "transparent", transition: "background .15s ease", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in oklch, ${color} 14%, var(--ivory))`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <CatIcon kind={t.category} size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.merchant}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", textTransform: "capitalize" }}>{categoryLabel(cat, tr, t.category)}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.method}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }} className="tnum">{t.time}</div>
                  <div className="tnum" style={{ textAlign: "right", fontSize: 13.5, fontWeight: 500, color: isIncome ? "var(--sage)" : "var(--ink)", whiteSpace: "nowrap" }}>
                    {isIncome ? "+" : "−"}{fmt(Math.abs(t.amount))}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ))}

      <div style={{ padding: "14px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {isMobile ? tr('transaksi.transaksiCount', { count: filtered.length }) : tr('transaksi.menampilkanDari', { n: filtered.length, total: transactions.length })}
        </div>
        <button onClick={onSeeAll} style={{ ...ghostBtn, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {tr('umum.lihatSemua')} <IconArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Helpers tanggal (lokal, tanpa pergeseran timezone) ──
const DAY_NAMES   = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WEEKDAYS    = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]; // mulai Senin

const dateToISO  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoToDate  = iso => new Date(iso + "T00:00:00");
const todayISO   = () => dateToISO(new Date());
const formatLong = iso => {
  const d = isoToDate(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

// Date picker popup — tema mengikuti CSS variable aplikasi (light/dark)
export function DatePickerPopup({ valueISO, onConfirm, onClose }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'id-ID';
  const [sel, setSel] = React.useState(valueISO || todayISO());
  const todayIso = todayISO();
  const selDate = isoToDate(sel);
  const [view, setView] = React.useState(() => new Date(selDate.getFullYear(), selDate.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Nama hari (Sen-first) & bulan terlokalisasi mengikuti bahasa aktif
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' }));
  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' });

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const navBtn = {
    width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line-soft)",
    background: "var(--paper)", color: "var(--ink-2)", display: "grid", placeItems: "center", cursor: "pointer",
  };

  return (
    <>
      {/* penangkap klik di luar + dim ringan */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(42,44,32,.18)" }} />
      <div onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 61, width: "min(320px, 90vw)", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
          background: "var(--ivory)", border: "1px solid var(--line-soft)", borderRadius: 16,
          padding: 14, boxShadow: "0 24px 60px -18px rgba(42,44,32,.45)", animation: "fade-in .18s ease-out",
        }}>
        {/* Navigasi bulan */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setView(new Date(year, month - 1, 1))} style={navBtn}>
            <IconChev size={15} className="" style={{ transform: "rotate(90deg)" }} />
          </button>
          <div className="serif" style={{ fontSize: 16, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {monthLabel} {year}
          </div>
          <button onClick={() => setView(new Date(year, month + 1, 1))} style={navBtn}>
            <IconChev size={15} className="" style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>

        {/* Hari */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {weekdays.map(w => (
            <div key={w} style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)", padding: "4px 0", letterSpacing: ".03em" }}>{w}</div>
          ))}
        </div>

        {/* Tanggal */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={"e" + i} />;
            const iso = dateToISO(new Date(year, month, d));
            const isSel = iso === sel;
            const isToday = iso === todayIso;
            return (
              <button key={iso} onClick={() => setSel(iso)}
                style={{
                  height: 34, borderRadius: 9, fontSize: 13, cursor: "pointer",
                  fontVariantNumeric: "tabular-nums",
                  border: isToday && !isSel ? "1px solid var(--sage)" : "1px solid transparent",
                  background: isSel ? "var(--ink)" : "transparent",
                  color: isSel ? "var(--cream)" : "var(--ink-2)",
                  fontWeight: isSel ? 600 : 400,
                }}>
                {d}
              </button>
            );
          })}
        </div>

        {/* Aksi */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => { const today = todayIso; setSel(today); setView(isoToDate(today)); }}
            style={{ flex: 1, padding: "10px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>
            {t('transaksi.hariIni')}
          </button>
          <button onClick={() => onConfirm(sel)}
            style={{ flex: 1.4, padding: "10px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
            {t('transaksi.pilihTanggal')}
          </button>
        </div>
      </div>
    </>
  );
}

export function AddTransactionModal({ open, onClose, onSave, onUpdate, initial = null, customCategories = [], onCreateCustom, onDeleteCustom, prefill = null, notice = null, previewImage = null, isPro = false, isBasicAtMax = false, userId }) {
  const { t: tr, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'id-ID';
  useScrollLock(open);   // kunci scroll latar saat modal terbuka
  const isEdit = !!initial;
  const [type, setType] = React.useState("expense");
  const [amount, setAmount] = React.useState("");
  const [cat, setCat] = React.useState("food");
  const [pendingCustom, setPendingCustom] = React.useState(null); // { name, color } saat pilih Kustom
  const [merchant, setMerchant] = React.useState("");
  const [note, setNote] = React.useState("");
  const [recurring, setRecurring] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');       // pesan error simpan ke Supabase
  const [dateRaw, setDateRaw] = React.useState(todayISO());   // tanggal transaksi (ISO)
  const [showPicker, setShowPicker] = React.useState(false);

  // Pre-fill saat mode edit atau reset saat modal buka baru
  React.useEffect(() => {
    if (!open) return;
    setPendingCustom(null);
    setSaving(false);
    setSaveError('');
    setShowPicker(false);
    if (initial) {
      const t = initial.amount < 0 ? "expense" : "income";
      setType(t);
      setAmount(String(Math.abs(initial.amount)));
      // Data lama: kategori pemasukan custom disimpan sebagai free-text (bukan UUID)
      const isKnownCustom = customCategories.some(c => c.id === initial.category);
      if (t === "income" && initial.category && !INCOME_CATEGORIES.some(c => c.id === initial.category) && !isKnownCustom) {
        setCat(CUSTOM_ID);
        setPendingCustom({ name: initial.category, color: CUSTOM_COLORS[0] });
      } else {
        setCat(initial.category);
      }
      setMerchant(initial.merchant === '—' ? '' : (initial.merchant || ''));
      setNote(initial.note || '');
      setRecurring(false);
      setDateRaw(initial.dateRaw || todayISO());
    } else if (prefill) {
      // Prefill dari Scan Struk — tetap mode tambah (bukan edit) & sepenuhnya bisa diedit user.
      setType(prefill.type || "expense");
      setAmount(prefill.amount != null && prefill.amount !== "" ? String(prefill.amount) : "");
      setCat(prefill.category || (prefill.type === "income" ? INCOME_CATEGORIES[0].id : "food"));
      setMerchant(prefill.merchant || "");
      setNote(prefill.note || "");
      setRecurring(false);
      setDateRaw(prefill.dateRaw || todayISO());   // tanggal tak terdeteksi → hari ini
    } else {
      setType("expense"); setAmount(""); setCat("food");
      setMerchant(""); setNote(""); setRecurring(false);
      setDateRaw(todayISO());   // default = hari ini
    }
  }, [open, initial, prefill]);

  if (!open) return null;

  const activeCats = type === "income" ? INCOME_CATEGORIES : CATEGORIES;
  const activeCustom = customCategories.filter(c => c.type === type && !c.is_deleted);
  const isCustom = cat === CUSTOM_ID;

  const switchType = (newType) => {
    setType(newType);
    setPendingCustom(null);
    if (newType === "income") setCat(INCOME_CATEGORIES[0].id);
    else setCat(CATEGORIES[0].id);
  };

  const valid = (+amount > 0) && (!isCustom || (pendingCustom?.name || '').trim().length > 0);

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setSaveError('');

    let categoryId = cat;
    if (isCustom) {
      if (!onCreateCustom) { setSaving(false); return; }
      const res = await onCreateCustom({ name: pendingCustom.name, color: pendingCustom.color, type });
      if (res?.limitReached) { setSaving(false); return; }
      const { category, error } = res;
      if (error || !category) {
        setSaveError(tr('transaksi.gagalKategoriKustom'));
        setSaving(false);
        return;
      }
      categoryId = category.id;
    }

    const now = new Date();
    const d = isoToDate(dateRaw);
    const date = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const tx = {
      id:       initial?.id || "tx-" + Date.now(),
      date,                       // string tampil (dibangun ulang dari dateRaw saat reload)
      dateRaw,                    // ISO tanggal pilihan user → disimpan ke Supabase
      time:     initial?.time || time,
      merchant: merchant.trim() || "—",
      note:     note.trim(),
      category: categoryId,
      method:   initial?.method || "Tunai",
      amount:   type === "expense" ? -(+amount || 0) : (+amount || 0),
    };
    const res = isEdit ? await onUpdate?.(initial.id, tx) : await onSave?.(tx);
    if (res?.error) {
      // Simpan gagal → tetap buka modal, beri tahu user (data tidak hilang)
      setSaveError(tr('transaksi.gagalSimpan'));
      setSaving(false);
      return;
    }
    // Sound khusus pemasukan (bukan pengeluaran)
    if (type === 'income') playSound(incomeSound);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 16, animation: "rise .25s ease-out" }} onClick={onClose}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: "min(480px, 100%)", padding: 24, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{isEdit ? tr('transaksi.editTransaksi') : tr('transaksi.entriBaru')}</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 4, letterSpacing: "-0.01em" }}>{isEdit ? tr('transaksi.perbaruiData') : tr('transaksi.catatTransaksi')}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }} className="serif">{isoToDate(dateRaw).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Pilih tanggal */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowPicker(v => !v)} title={tr('transaksi.pilihTanggal')} aria-label={tr('transaksi.pilihTanggal')}
                style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line-soft)", background: showPicker ? "var(--ink)" : "var(--paper)", display: "grid", placeItems: "center", color: showPicker ? "var(--cream)" : "var(--ink-2)", cursor: "pointer" }}>
                <IconCalendar size={15} />
              </button>
              {showPicker && (
                <DatePickerPopup
                  valueISO={dateRaw}
                  onConfirm={iso => { setDateRaw(iso); setShowPicker(false); }}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* Hasil Scan Struk: preview foto + status baca (success/warning) */}
        {(previewImage || notice) && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            {previewImage && (
              <img src={previewImage} alt={tr('transaksi.pratinjauStruk')}
                style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line-soft)", flexShrink: 0 }} />
            )}
            {notice && (
              <div role="status" style={{
                flex: 1, fontSize: 12.5, lineHeight: 1.4, borderRadius: 10, padding: "10px 12px",
                color: notice.type === "success" ? "var(--sage)" : "var(--gold)",
                background: `color-mix(in oklch, ${notice.type === "success" ? "var(--sage)" : "var(--gold)"} 12%, transparent)`,
                border: `1px solid color-mix(in oklch, ${notice.type === "success" ? "var(--sage)" : "var(--gold)"} 28%, transparent)`,
              }}>
                {notice.text}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, marginTop: 18 }}>
          {[{ id: "expense", label: tr('transaksi.pengeluaran') }, { id: "income", label: tr('transaksi.pemasukan') }].map(opt => (
            <button key={opt.id} onClick={() => switchType(opt.id)} style={{ padding: "10px 10px", fontSize: 13, background: type === opt.id ? "var(--ivory)" : "transparent", border: type === opt.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 9, color: type === opt.id ? "var(--ink)" : "var(--muted)", fontWeight: type === opt.id ? 500 : 400 }}>{opt.label}</button>
          ))}
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{tr('transaksi.jumlah')}</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
            <span className="serif" style={{ fontSize: 28, color: "var(--muted)" }}>{type === "expense" ? "−" : "+"}Rp</span>
            <input autoFocus inputMode="numeric" value={formatRupiahInput(amount)} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0"
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, lineHeight: 1, color: "var(--ink)", background: "transparent", border: 0, outline: "none", width: "min(240px, 55vw)", textAlign: "left", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Field label={tr('transaksi.merchant')}>
            <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder={tr('transaksi.namaMerchant')} style={inputStyle} />
          </Field>
          <Field label={tr('transaksi.kategori')}>
            <CategoryField
              value={cat}
              onChange={setCat}
              categories={activeCats}
              customCategories={activeCustom}
              allowCustom
              pending={pendingCustom}
              onPendingChange={setPendingCustom}
              onDeleteCustom={onDeleteCustom}
              isPro={isPro}
              isBasicAtMax={isBasicAtMax}
              userId={userId}
            />
          </Field>
          <Field label={tr('transaksi.catatanOpsional')}>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr('transaksi.catatanPlaceholder')} style={inputStyle} />
          </Field>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            {tr('transaksi.tandaiBerulang')}
          </label>
        </div>

        {saveError && (
          <div role="alert" style={{ marginTop: 16, fontSize: 13, color: "var(--terra)", background: "color-mix(in oklch, var(--terra) 10%, transparent)", border: "1px solid color-mix(in oklch, var(--terra) 25%, transparent)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>
            {saveError}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)" }}>{tr('umum.batal')}</button>
          <button onClick={submit} disabled={!valid || saving}
            style={{ flex: 2, padding: "13px", background: (valid && !saving) ? "var(--ink)" : "var(--line-soft)", color: (valid && !saving) ? "var(--cream)" : "var(--muted-2)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: (valid && !saving) ? "pointer" : "default" }}>
            {saving ? tr('umum.menyimpan') : (isEdit ? tr('transaksi.simpanPerubahan') : tr('transaksi.simpanTransaksi'))}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "11px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 14, fontFamily: "inherit", outline: "none" };

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
