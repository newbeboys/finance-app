import React from 'react';
import { TRANSACTIONS, CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, fmt } from './data';

import { IconFilter, IconPlus, IconArrowRight, IconClose, CatIcon } from './icons';
import { ghostBtn } from './widgets';
import { useIsMobile } from './use-mobile';

export function TransactionsCard({ onAdd, limit, onSeeAll, transactions: txProp, loading = false }) {
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
    { id: "all",     label: "Semua",   count: transactions.length },
    { id: "expense", label: "Keluar",  count: transactions.filter(t => t.amount < 0).length },
    { id: "income",  label: "Masuk",   count: transactions.filter(t => t.amount > 0).length },
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
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Aktivitas terbaru</div>
          <div className="serif" style={{ fontSize: isMobile ? 20 : 26, marginTop: 2, letterSpacing: "-0.01em" }}>Beberapa hari terakhir</div>
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
          <button onClick={onAdd} style={{ padding: isMobile ? "8px 12px" : "7px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={13} /> Tambah
          </button>
        </div>
      </div>

      {/* Desktop table header */}
      <div className="tx-header-desktop" style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 1fr 1fr 1fr 140px", padding: "0 4px 8px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
        <span>Merchant</span><span>Kategori</span><span>Metode</span><span>Waktu</span>
        <span style={{ textAlign: "right" }}>Jumlah</span>
      </div>

      {/* Mobile: simple divider */}
      {isMobile && <div style={{ borderBottom: "1px solid var(--line-soft)", marginBottom: 2 }} />}

      {loading && transactions.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", color: "var(--muted)", fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Memuat transaksi…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "32px 16px", textAlign: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>Belum ada transaksi</div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>Mulai tambahkan transaksi pertamamu</div>
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
            const cat = ALL_CATEGORIES.find(c => c.id === t.category);
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
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{cat?.label || t.category} · {t.time}</div>
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
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", textTransform: "capitalize" }}>{cat?.label || t.category}</div>
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
          {isMobile ? `${filtered.length} transaksi` : `Menampilkan ${filtered.length} dari ${transactions.length} transaksi`}
        </div>
        <button onClick={onSeeAll} style={{ ...ghostBtn, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Lihat semua <IconArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

export function AddTransactionModal({ open, onClose, onSave }) {
  const [type, setType] = React.useState("expense");
  const [amount, setAmount] = React.useState("");
  const [cat, setCat] = React.useState("food");
  const [merchant, setMerchant] = React.useState("");
  const [note, setNote] = React.useState("");
  const [recurring, setRecurring] = React.useState(false);

  if (!open) return null;

  const activeCats = type === "income" ? INCOME_CATEGORIES : CATEGORIES;

  const switchType = (newType) => {
    setType(newType);
    // Reset ke default kategori sesuai jenis baru
    if (newType === "income") setCat(INCOME_CATEGORIES[0].id);
    else setCat(CATEGORIES[0].id);
  };

  const submit = () => {
    const now = new Date();
    const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const date = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const tx = {
      id: "tx-" + Date.now(),
      date,
      time,
      merchant: merchant.trim() || "—",
      note: note.trim(),
      category: cat,
      method: "Tunai",
      amount: type === "expense" ? -(+amount || 0) : (+amount || 0),
    };
    onSave?.(tx);
    onClose();
  };

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 16, animation: "rise .25s ease-out" }} onClick={onClose}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: "min(480px, 100%)", padding: 24, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Entri baru</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 4, letterSpacing: "-0.01em" }}>Catat transaksi</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, marginTop: 18 }}>
          {[{ id: "expense", label: "Pengeluaran" }, { id: "income", label: "Pemasukan" }].map(opt => (
            <button key={opt.id} onClick={() => switchType(opt.id)} style={{ padding: "10px 10px", fontSize: 13, background: type === opt.id ? "var(--ivory)" : "transparent", border: type === opt.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 9, color: type === opt.id ? "var(--ink)" : "var(--muted)", fontWeight: type === opt.id ? 500 : 400 }}>{opt.label}</button>
          ))}
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Jumlah</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
            <span className="serif" style={{ fontSize: 28, color: "var(--muted)" }}>{type === "expense" ? "−" : "+"}Rp</span>
            <input autoFocus value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0"
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: 40, lineHeight: 1, color: "var(--ink)", background: "transparent", border: 0, outline: "none", width: "min(240px, 55vw)", textAlign: "left", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Field label="Merchant">
            <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="nama merchant" style={inputStyle} />
          </Field>
          <Field label="Kategori">
            <CategorySelect value={cat} onChange={setCat} categories={activeCats} />
          </Field>
          <Field label="Catatan (opsional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Untuk apa?" style={inputStyle} />
          </Field>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Tandai sebagai berulang
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)" }}>Batal</button>
          <button onClick={submit} style={{ flex: 2, padding: "13px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500 }}>Simpan transaksi</button>
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

function CategorySelect({ value, onChange, categories = CATEGORIES }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const wrapRef = React.useRef(null);
  const selected = categories.find(c => c.id === value);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div ref={wrapRef}>
      <button type="button" onClick={toggle}
        style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {selected && (
            <span style={{ width: 10, height: 10, borderRadius: 3, background: selected.color, flexShrink: 0 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected?.label || "Pilih kategori"}
          </span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && pos && (
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: 200,
          overflowY: "auto",
          background: "var(--paper)",
          border: "1px solid var(--line-soft)",
          borderRadius: 10,
          boxShadow: "0 8px 28px -8px rgba(42,44,32,.3)",
          zIndex: 9999,
        }}>
          {categories.map((c, i) => (
            <button key={c.id} type="button"
              onClick={() => { onChange(c.id); setOpen(false); }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: c.id === value ? "var(--ivory)" : "transparent",
                border: 0,
                borderBottom: i < categories.length - 1 ? "1px solid var(--line-soft)" : 0,
                fontSize: 14,
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
              {c.label}
              {c.id === value && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", color: "var(--sage)" }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
