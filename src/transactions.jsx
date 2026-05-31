import React from 'react';
import { TRANSACTIONS, CATEGORIES, fmt } from './data';
import { IconFilter, IconPlus, IconArrowRight, IconClose, CatIcon } from './icons';
import { ghostBtn } from './widgets';

export function TransactionsCard({ onAdd, limit, onSeeAll }) {
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);

  const filteredAll = TRANSACTIONS.filter(t => {
    if (filter === "expense") return t.amount < 0;
    if (filter === "income")  return t.amount > 0;
    return true;
  });
  const filtered = limit ? filteredAll.slice(0, limit) : filteredAll;

  const tabs = [
    { id: "all",     label: "Semua",       count: TRANSACTIONS.length },
    { id: "expense", label: "Pengeluaran", count: TRANSACTIONS.filter(t => t.amount < 0).length },
    { id: "income",  label: "Pemasukan",   count: TRANSACTIONS.filter(t => t.amount > 0).length },
  ];

  const grouped = filtered.reduce((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="card rise" style={{ padding: "22px 22px 8px", gridColumn: "span 2" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Aktivitas terbaru</div>
          <div className="serif" style={{ fontSize: 26, marginTop: 2, letterSpacing: "-0.01em" }}>Beberapa hari terakhir</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)} style={{ padding: "6px 12px", fontSize: 12, background: filter === t.id ? "var(--ivory)" : "transparent", border: filter === t.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: filter === t.id ? "var(--ink)" : "var(--muted)", fontWeight: filter === t.id ? 500 : 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t.label}
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.count}</span>
              </button>
            ))}
          </div>
          <button style={ghostBtn}><IconFilter size={13} /></button>
          <button onClick={onAdd} style={{ padding: "7px 12px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={13} /> Tambah
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 1fr 1fr 1fr 140px", padding: "0 4px 8px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
        <span>Merchant</span><span>Kategori</span><span>Metode</span><span>Waktu</span>
        <span style={{ textAlign: "right" }}>Jumlah</span>
      </div>

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div style={{ padding: "14px 4px 6px", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="serif" style={{ fontSize: 14, color: "var(--ink-2)", fontStyle: "italic", letterSpacing: 0 }}>{date}</span>
            <span style={{ flex: 1, borderBottom: "1px dashed var(--line-soft)", marginBottom: 4 }} />
            <span className="tnum">
              {items.reduce((s, t) => s + t.amount, 0) >= 0 ? "+" : "−"}
              {fmt(Math.abs(items.reduce((s, t) => s + t.amount, 0)))}
            </span>
          </div>

          {items.map((t, i) => {
            const cat = CATEGORIES.find(c => c.id === t.category);
            const isIncome = t.amount > 0;
            const color = cat?.color || (isIncome ? "var(--sage)" : "var(--muted-2)");
            return (
              <div key={t.id} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
                style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 1fr 1fr 1fr 140px", alignItems: "center", padding: "12px 4px", borderBottom: i < items.length - 1 ? "1px solid var(--line-soft)" : 0, background: hover === t.id ? "var(--paper)" : "transparent", transition: "background .15s ease", cursor: "pointer" }}>
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
            );
          })}
        </div>
      ))}

      <div style={{ padding: "16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Menampilkan {filtered.length} dari {TRANSACTIONS.length} transaksi</div>
        <button onClick={onSeeAll} style={{ ...ghostBtn, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Lihat semua transaksi <IconArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

export function AddTransactionModal({ open, onClose }) {
  const [type, setType] = React.useState("expense");
  const [amount, setAmount] = React.useState("");
  const [cat, setCat] = React.useState("food");
  const [merchant, setMerchant] = React.useState("");
  const [note, setNote] = React.useState("");
  const [recurring, setRecurring] = React.useState(false);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20, animation: "rise .25s ease-out" }} onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ width: 480, padding: 28, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Entri baru</div>
            <div className="serif" style={{ fontSize: 28, marginTop: 4, letterSpacing: "-0.01em" }}>Catat transaksi</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, marginTop: 18 }}>
          {[{ id: "expense", label: "Pengeluaran" }, { id: "income", label: "Pemasukan" }].map(opt => (
            <button key={opt.id} onClick={() => setType(opt.id)} style={{ padding: "8px 10px", fontSize: 13, background: type === opt.id ? "var(--ivory)" : "transparent", border: type === opt.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 9, color: type === opt.id ? "var(--ink)" : "var(--muted)", fontWeight: type === opt.id ? 500 : 400 }}>{opt.label}</button>
          ))}
        </div>

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Jumlah</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
            <span className="serif" style={{ fontSize: 32, color: "var(--muted)" }}>{type === "expense" ? "−" : "+"}Rp</span>
            <input autoFocus value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0"
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: 44, lineHeight: 1, color: "var(--ink)", background: "transparent", border: 0, outline: "none", width: 240, textAlign: "left", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
          <Field label="Merchant">
            <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="contoh: Kopi Tetangga" style={inputStyle} />
          </Field>
          <Field label="Kategori">
            <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Catatan (opsional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Untuk apa?" style={inputStyle} />
          </Field>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Tandai sebagai berulang
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>Batal</button>
          <button onClick={onClose} style={{ flex: 2, padding: "11px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500 }}>Simpan transaksi</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 13, fontFamily: "inherit", outline: "none" };

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
