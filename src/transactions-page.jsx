import React from 'react';
import { TRANSACTIONS, ALL_CATEGORIES, fmt, fmtShort, formatNominal, nominalFontSize } from './data';
import { IconSearch, IconPlus, IconClose, CatIcon } from './icons';
import { useIsMobile } from './use-mobile';
import { AddTransactionModal } from './transactions';

export function TransactionsPage({ accounts, onAdd, transactions: txProp, loading = false, onDelete, onUpdate }) {
  const transactions = txProp ?? TRANSACTIONS;
  const isMobile = useIsMobile();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const [deletingId, setDeletingId] = React.useState(null); // id transaksi yang akan dihapus
  const [editingTx, setEditingTx] = React.useState(null);   // objek transaksi yang akan diedit
  const [cat, setCat] = React.useState("all");
  const [method, setMethod] = React.useState("all");
  const [hover, setHover] = React.useState(null);

  const methods = React.useMemo(() => Array.from(new Set(transactions.map(t => t.method))), [transactions]);

  const filtered = transactions.filter(t => {
    if (type === "expense" && t.amount >= 0) return false;
    if (type === "income"  && t.amount <= 0) return false;
    if (cat !== "all" && t.category !== cat) return false;
    if (method !== "all" && t.method !== method) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      const catLabel = (ALL_CATEGORIES.find(c => c.id === t.category) || {}).label || t.category;
      if (!(`${t.merchant} ${t.note} ${catLabel} ${t.method}`.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const income = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const grouped = [];
  filtered.forEach(t => {
    let g = grouped.find(x => x.date === t.date);
    if (!g) { g = { date: t.date, items: [] }; grouped.push(g); }
    g.items.push(t);
  });

  const catsUsed = ALL_CATEGORIES.filter(c => transactions.some(t => t.category === c.id));
  const reset = () => { setQ(""); setType("all"); setCat("all"); setMethod("all"); };
  const active = q || type !== "all" || cat !== "all" || method !== "all";

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
            Transaksi · {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Riwayat transaksi</h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
              Semua transaksi yang sudah kamu lakukan, dikelompokkan per hari.
            </div>
          )}
        </div>
        <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500 }}>
          <IconPlus size={15} /> Tambah transaksi
        </button>
      </div>

      <div className="tx-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
        {[
          { l: "Pemasukan",   v: income,         c: "var(--sage)",  n: filtered.filter(t => t.amount > 0).length },
          { l: "Pengeluaran", v: expense,        c: "var(--terra)", n: filtered.filter(t => t.amount < 0).length },
          { l: "Selisih",     v: income-expense, c: income >= expense ? "var(--ink)" : "var(--terra)", n: filtered.length },
        ].map((s, i) => (
          <div key={i} className={`card rise tx-stat-card${i === 2 ? " tx-stat-selisih" : ""}`} style={{ padding: 16, animationDelay: `${i * 0.03}s` }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 500 }}>{s.l}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{s.n} transaksi</div>
            <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(s.v), letterSpacing: "-0.01em", marginTop: 8, color: s.c }}>{formatNominal(s.v)}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><IconSearch size={15} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari merchant, catatan, kategori…"
            style={{ width: "100%", padding: "10px 12px 10px 34px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {[{ id: "all", label: "Semua" }, { id: "income", label: "Masuk" }, { id: "expense", label: "Keluar" }].map(tb => (
            <button key={tb.id} onClick={() => setType(tb.id)} style={{ padding: "7px 13px", fontSize: 12.5, background: type === tb.id ? "var(--ivory)" : "transparent", border: type === tb.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: type === tb.id ? "var(--ink)" : "var(--muted)", fontWeight: type === tb.id ? 500 : 400 }}>{tb.label}</button>
          ))}
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)} style={selectStyle}>
          <option value="all">Semua kategori</option>
          {catsUsed.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={method} onChange={e => setMethod(e.target.value)} style={selectStyle}>
          <option value="all">Semua metode</option>
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {active && (
          <button onClick={reset} style={{ padding: "9px 12px", background: "transparent", border: "1px solid var(--line-soft)", borderRadius: 10, fontSize: 12.5, color: "var(--muted)" }}>Reset</button>
        )}
      </div>

      <div className="card" style={{ padding: isMobile ? "6px 14px 12px" : "8px 22px 14px" }}>
        {/* Desktop table header */}
        <div className="tx-header-desktop" style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) 1fr 1fr 0.7fr 150px", padding: "14px 4px 10px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
          <span>Merchant</span><span>Kategori</span><span>Metode</span><span>Waktu</span><span style={{ textAlign: "right" }}>Jumlah</span>
        </div>

        {grouped.length === 0 && (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            Tidak ada transaksi yang cocok dengan filter.
          </div>
        )}

        {grouped.map(g => {
          const dayTotal = g.items.reduce((s, t) => s + t.amount, 0);
          return (
            <div key={g.date}>
              <div style={{ padding: "12px 4px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="serif" style={{ fontSize: 14, color: "var(--ink-2)", fontStyle: "italic" }}>{g.date}</span>
                <span style={{ flex: 1, borderBottom: "1px dashed var(--line-soft)", marginBottom: 4 }} />
                <span className="tnum" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {dayTotal >= 0 ? "+" : "−"}{fmt(Math.abs(dayTotal))}
                </span>
              </div>
              {g.items.map((t, i) => {
                const c = ALL_CATEGORIES.find(x => x.id === t.category);
                const isIncome = t.amount > 0;
                const color = c?.color || (isIncome ? "var(--sage)" : "var(--muted-2)");
                const borderBottom = i < g.items.length - 1 ? "1px solid var(--line-soft)" : 0;
                const isDeleting = deletingId === t.id;

                return (
                  <React.Fragment key={t.id}>
                    {/* ── Mobile compact row ── */}
                    <div className="tx-row-mobile"
                      style={{ alignItems: "center", gap: 10, padding: "12px 2px", borderBottom }}>
                      <span onClick={() => setEditingTx(t)} style={{ width: 38, height: 38, borderRadius: 10, background: `color-mix(in oklch, ${color} 14%, var(--ivory))`, color, display: "grid", placeItems: "center", flexShrink: 0, cursor: "pointer" }}>
                        <CatIcon kind={t.category} size={16} />
                      </span>
                      <div onClick={() => setEditingTx(t)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.merchant}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{c?.label || t.category} · {t.method} · {t.time}</div>
                      </div>
                      <div className="tnum" style={{ fontSize: 13.5, fontWeight: 600, color: isIncome ? "var(--sage)" : "var(--ink)", flexShrink: 0 }}>
                        {isIncome ? "+" : "−"}{fmt(Math.abs(t.amount))}
                      </div>
                      {onDelete && (
                        <button onClick={() => setDeletingId(t.id)} title="Hapus"
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <IconClose size={12} />
                        </button>
                      )}
                    </div>

                    {/* ── Desktop 5-column row ── */}
                    <div className="tx-row-desktop"
                      onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
                      style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.6fr) 1fr 1fr 0.7fr 130px 72px", alignItems: "center", padding: "12px 4px", borderBottom, background: hover === t.id ? "var(--paper)" : "transparent", transition: "background .15s ease" }}>
                      <div onClick={() => setEditingTx(t)} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, cursor: "pointer" }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in oklch, ${color} 14%, var(--ivory))`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <CatIcon kind={t.category} size={15} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.merchant}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.note}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{c?.label || t.category}</div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.method}</div>
                      <div className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.time}</div>
                      <div className="tnum" style={{ textAlign: "right", fontSize: 13.5, fontWeight: 500, color: isIncome ? "var(--sage)" : "var(--ink)", whiteSpace: "nowrap" }}>
                        {isIncome ? "+" : "−"}{fmt(Math.abs(t.amount))}
                      </div>
                      {/* Edit + Hapus — tampil saat hover */}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", opacity: hover === t.id ? 1 : 0, transition: "opacity .15s" }}>
                        {onUpdate && (
                          <button onClick={() => setEditingTx(t)} title="Edit"
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--ink-2)", fontSize: 11, cursor: "pointer" }}>
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button onClick={() => setDeletingId(t.id)} title="Hapus"
                            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                            <IconClose size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}

        {grouped.length > 0 && (
          <div style={{ padding: "14px 4px 4px", fontSize: 12, color: "var(--muted)" }}>
            {filtered.length} transaksi ditampilkan
          </div>
        )}
      </div>

      {/* ── Konfirmasi Hapus ── */}
      {deletingId && (
        <>
          <div onClick={() => setDeletingId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(42,44,32,.45)", zIndex: 150, animation: "rise .2s ease-out" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--ivory)", borderRadius: "16px 16px 0 0", padding: "24px 20px 40px", zIndex: 200, boxShadow: "0 -8px 32px -8px rgba(42,44,32,.2)", animation: "rise .25s ease-out" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--line)", margin: "-12px auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "color-mix(in oklch, var(--terra) 12%, transparent)", color: "var(--terra)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <IconClose size={18} />
              </span>
              <div>
                <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>Hapus transaksi?</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>
                  Tindakan ini tidak dapat dibatalkan. Data akan dihapus permanen dari Supabase.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setDeletingId(null)}
                style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)", fontFamily: "inherit" }}>
                Batal
              </button>
              <button onClick={() => { onDelete?.(deletingId); setDeletingId(null); }}
                style={{ flex: 1, padding: "13px", background: "var(--terra)", color: "#fff", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}>
                Hapus
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Modal ── */}
      <AddTransactionModal
        open={!!editingTx}
        initial={editingTx}
        onClose={() => setEditingTx(null)}
        onUpdate={onUpdate}
      />
    </div>
  );
}

const selectStyle = { padding: "9px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", outline: "none" };
