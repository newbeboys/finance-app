import React from 'react';
import { fmt, fmtShort, CATEGORIES } from './data';
import { IconPlus, IconSpark, IconClose, CatIcon } from './icons';
import { useIsMobile } from './use-mobile';

const STORAGE_KEY = 'finance_budgets';

function loadBudgets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function BudgetsPage({ transactions = [] }) {
  const isMobile = useIsMobile();

  const [rows, setRows] = React.useState(loadBudgets);
  const [editing, setEditing] = React.useState(null);
  const [period, setPeriod] = React.useState("monthly");
  const [showAddModal, setShowAddModal] = React.useState(false);

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch {}
  }, [rows]);

  // Hitung pengeluaran aktual per category dari transaksi bulan ini
  const spentByCategory = React.useMemo(() => {
    const now = new Date();
    const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = {};
    transactions.forEach(tx => {
      if (tx.amount < 0 && tx.dateRaw && tx.dateRaw.startsWith(pfx)) {
        map[tx.category] = (map[tx.category] || 0) + Math.abs(tx.amount);
      }
    });
    return map;
  }, [transactions]);

  const getSpent = (r) => spentByCategory[r.categoryId] ?? r.spent ?? 0;

  const setLimit  = (id, limit) => setRows(rs => rs.map(r => r.id === id ? { ...r, limit: Math.max(0, limit) } : r));
  const toggle    = (id)        => setRows(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const deleteRow = (id)        => setRows(rs => rs.filter(r => r.id !== id));

  // Filter sesuai tab periode aktif; row lama tanpa field periode default ke "monthly"
  const visibleRows = rows.filter(r => (r.periode || "monthly") === period);
  const active      = visibleRows.filter(r => r.enabled);
  const totalLimit  = active.reduce((s, r) => s + r.limit, 0);
  const totalSpent  = active.reduce((s, r) => s + getSpent(r), 0);
  const totalPct    = totalLimit ? totalSpent / totalLimit : 0;
  const overCount   = active.filter(r => getSpent(r) > r.limit).length;

  // Tanggal otomatis
  const monthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: 1180, margin: "0 auto" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Anggaran · {monthLabel}</div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Atur anggaran bulanan</h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>
              Tetapkan batas pengeluaran untuk tiap kategori. Geser slider atau ketik angka — perubahan langsung terlihat di kartu Beranda.
            </div>
          )}
        </div>
        <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {[{ id: "monthly", label: "Bulanan" }, { id: "weekly", label: "Mingguan" }].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: isMobile ? "9px 16px" : "7px 14px", fontSize: isMobile ? 13 : 12.5, background: period === p.id ? "var(--ivory)" : "transparent", border: period === p.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: period === p.id ? "var(--ink)" : "var(--muted)", fontWeight: period === p.id ? 500 : 400 }}>{p.label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        /* ── Empty state ── */
        <div className="card rise" style={{ padding: isMobile ? "40px 24px" : "60px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <div className="serif" style={{ fontSize: isMobile ? 22 : 28, letterSpacing: "-0.01em" }}>Belum ada anggaran</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, maxWidth: 380 }}>
            Tambahkan kategori anggaran untuk mulai melacak dan membatasi pengeluaranmu setiap bulan.
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
            <IconPlus size={15} /> Tambah kategori anggaran
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary card ── */}
          {isMobile ? (
            <div className="card rise" style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Total anggaran {period === "monthly" ? "bulanan" : "mingguan"}</div>
                <div className="serif tnum" style={{ fontSize: 30, letterSpacing: "-0.02em", marginTop: 4 }}>{fmtShort(totalLimit)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{active.length} kategori aktif</div>
                <div style={{ marginTop: 12, height: 8, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(totalPct, 1) * 100}%`, background: totalPct > 1 ? "var(--terra)" : "var(--sage)", borderRadius: 99, transition: "width .5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  <span>Terpakai {fmtShort(totalSpent)}</span>
                  <span>{Math.round(totalPct * 100)}%</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Sisa</div>
                  <div className="serif tnum" style={{ fontSize: 22, letterSpacing: "-0.02em", marginTop: 4, color: totalLimit - totalSpent < 0 ? "var(--terra)" : "var(--ink)" }}>{fmtShort(totalLimit - totalSpent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Status</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: overCount ? "var(--terra)" : "var(--sage)", flexShrink: 0 }} />
                    <span className="serif" style={{ fontSize: 16 }}>{overCount ? `${overCount} over` : "Semua aman"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card rise" style={{ padding: 24, display: "grid", gridTemplateColumns: "1.1fr 1px 1fr 1px 1fr", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Total anggaran {period === "monthly" ? "bulanan" : "mingguan"}</div>
                <div className="serif tnum" style={{ fontSize: 34, letterSpacing: "-0.02em", marginTop: 6 }}>{fmtShort(totalLimit)}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{active.length} kategori aktif</div>
                <div style={{ marginTop: 14, height: 8, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(totalPct, 1) * 100}%`, background: totalPct > 1 ? "var(--terra)" : "var(--sage)", borderRadius: 99, transition: "width .5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11.5, color: "var(--muted)" }}>
                  <span>Terpakai {fmtShort(totalSpent)}</span>
                  <span>{Math.round(totalPct * 100)}%</span>
                </div>
              </div>
              <div style={{ width: 1, height: 80, background: "var(--line-soft)" }} />
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Sisa</div>
                <div className="serif tnum" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 6, color: totalLimit - totalSpent < 0 ? "var(--terra)" : "var(--ink)" }}>{fmtShort(totalLimit - totalSpent)}</div>
              </div>
              <div style={{ width: 1, height: 80, background: "var(--line-soft)" }} />
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: overCount ? "var(--terra)" : "var(--sage)" }} />
                  <span className="serif" style={{ fontSize: 22 }}>{overCount ? `${overCount} kategori over` : "Semua aman"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.45 }}>
                  {overCount ? "Tinjau kategori bertanda merah di bawah." : "Pengeluaranmu masih dalam batas yang ditetapkan."}
                </div>
              </div>
            </div>
          )}

          {/* ── Budget rows card ── */}
          <div className="card rise" style={{ padding: isMobile ? "8px 16px 16px" : "8px 24px 16px" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 90px 48px", padding: "16px 0 10px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", alignItems: "center", gap: 16 }}>
                <span>Kategori</span><span>Progress</span>
                <span style={{ textAlign: "right" }}>Batas {period === "monthly" ? "/bln" : "/mgg"}</span>
                <span style={{ textAlign: "right" }}>Aktif</span>
                <span />
              </div>
            )}

            {visibleRows.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                </svg>
                <div className="serif" style={{ fontSize: isMobile ? 18 : 22, letterSpacing: "-0.01em" }}>
                  Belum ada anggaran {period === "monthly" ? "bulanan" : "mingguan"}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, maxWidth: 340 }}>
                  Klik tombol di bawah untuk menambahkan anggaran {period === "monthly" ? "bulanan" : "mingguan"} pertamamu.
                </div>
              </div>
            )}

            {visibleRows.map((r, i) => {
              const computedSpent = getSpent(r);
              const pct = r.limit ? computedSpent / r.limit : 0;
              const over = computedSpent > r.limit;
              const isEditing = editing === r.id;

              if (isMobile) {
                return (
                  <div key={r.id} style={{ padding: "16px 0", borderBottom: i < visibleRows.length - 1 ? "1px solid var(--line-soft)" : 0, opacity: r.enabled ? 1 : 0.5, transition: "opacity .2s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                        <CatIcon kind={r.categoryId || r.id} size={17} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                        <div className="tnum" style={{ fontSize: 12, color: over ? "var(--terra)" : "var(--muted)", marginTop: 1 }}>
                          {fmtShort(computedSpent)} <span style={{ color: "var(--muted-2)" }}>dari</span> {fmtShort(r.limit)}
                          {over && <span style={{ marginLeft: 6, color: "var(--terra)" }}>• over!</span>}
                        </div>
                      </div>
                      <button onClick={() => toggle(r.id)} role="switch" aria-checked={r.enabled}
                        style={{ width: 44, height: 26, borderRadius: 99, border: 0, padding: 3, background: r.enabled ? "var(--sage)" : "var(--line)", display: "flex", justifyContent: r.enabled ? "flex-end" : "flex-start", transition: "background .2s ease", flexShrink: 0 }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--paper)", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                      </button>
                      <button onClick={() => deleteRow(r.id)} title="Hapus" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <IconClose size={13} />
                      </button>
                    </div>
                    <div style={{ height: 7, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                    </div>
                    {r.enabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="range" min="0" max={Math.max(computedSpent * 2, 2_000_000)} step="50000"
                          value={r.limit} onChange={e => setLimit(r.id, +e.target.value)}
                          style={{ flex: 1, accentColor: r.color, cursor: "pointer", height: 20 }} />
                        {isEditing ? (
                          <input autoFocus type="text" value={r.limit.toLocaleString("id-ID")}
                            onChange={e => setLimit(r.id, +e.target.value.replace(/\D/g, "") || 0)}
                            onBlur={() => setEditing(null)}
                            onKeyDown={e => e.key === "Enter" && setEditing(null)}
                            style={{ width: 110, padding: "8px 10px", textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, background: "var(--paper)", border: "1px solid var(--ink)", borderRadius: 8, color: "var(--ink)", outline: "none", flexShrink: 0 }} />
                        ) : (
                          <button onClick={() => setEditing(r.id)}
                            style={{ padding: "8px 10px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 8, fontSize: 12.5, color: "var(--ink)", fontVariantNumeric: "tabular-nums", minWidth: 100, textAlign: "right", flexShrink: 0 }}>
                            {fmt(r.limit)}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 90px 48px", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: i < visibleRows.length - 1 ? "1px solid var(--line-soft)" : 0, opacity: r.enabled ? 1 : 0.5, transition: "opacity .2s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                      <CatIcon kind={r.categoryId || r.id} size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                      <div className="tnum" style={{ fontSize: 11.5, color: over ? "var(--terra)" : "var(--muted)" }}>Terpakai {fmtShort(computedSpent)}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                    </div>
                    {r.enabled && (
                      <input type="range" min="0" max={Math.max(computedSpent * 2, 2_000_000)} step="50000"
                        value={r.limit} onChange={e => setLimit(r.id, +e.target.value)}
                        style={{ width: "100%", marginTop: 8, accentColor: r.color, cursor: "pointer" }} />
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    {isEditing ? (
                      <input autoFocus type="text" value={r.limit.toLocaleString("id-ID")}
                        onChange={e => setLimit(r.id, +e.target.value.replace(/\D/g, "") || 0)}
                        onBlur={() => setEditing(null)}
                        onKeyDown={e => e.key === "Enter" && setEditing(null)}
                        style={{ width: 130, padding: "7px 10px", textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, background: "var(--paper)", border: "1px solid var(--ink)", borderRadius: 8, color: "var(--ink)", outline: "none" }} />
                    ) : (
                      <button onClick={() => r.enabled && setEditing(r.id)} disabled={!r.enabled} style={{ padding: "7px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 8, fontSize: 12.5, color: "var(--ink)", fontVariantNumeric: "tabular-nums", cursor: r.enabled ? "pointer" : "default", minWidth: 130 }}>{fmt(r.limit)}</button>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => toggle(r.id)} role="switch" aria-checked={r.enabled} style={{ width: 42, height: 24, borderRadius: 99, border: 0, padding: 3, background: r.enabled ? "var(--sage)" : "var(--line)", display: "flex", justifyContent: r.enabled ? "flex-end" : "flex-start", transition: "background .2s ease" }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--paper)", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                    </button>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => deleteRow(r.id)} title="Hapus" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center" }}>
                      <IconClose size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            <div style={{ paddingTop: 18, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "stretch" : "space-between", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 0 }}>
              <button onClick={() => setShowAddModal(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: 8, padding: isMobile ? "13px 14px" : "9px 14px", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 10, fontSize: isMobile ? 14 : 12.5, color: "var(--ink-2)" }}>
                <IconPlus size={14} /> Tambah kategori anggaran
              </button>
              <button onClick={() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch {} }} style={{ padding: isMobile ? "14px 18px" : "10px 18px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: isMobile ? 14 : 13, fontWeight: 500 }}>Simpan anggaran</button>
            </div>
          </div>

          {/* ── Tips ── */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "4px 6px", color: "var(--muted)", fontSize: isMobile ? 13 : 12.5, lineHeight: 1.5 }}>
            <span style={{ color: "var(--gold)", marginTop: 1 }}><IconSpark size={15} /></span>
            <span>
              <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>Tips:</strong> aktifkan reminder agar FinanceApp memberi tahu saat sebuah kategori mencapai 80% dari batasnya. Semua fitur ini gratis.
            </span>
          </div>
        </>
      )}

      {showAddModal && (
        <AddBudgetModal
          defaultPeriod={period}
          existingCategoryIds={rows.map(r => r.categoryId).filter(Boolean)}
          onClose={() => setShowAddModal(false)}
          onAdd={row => { setRows(rs => [...rs, row]); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}

const PRESET_COLORS = ["var(--sage)", "var(--terra)", "var(--gold)", "var(--blush)", "var(--muted)"];

function AddBudgetModal({ onClose, onAdd, defaultPeriod = "monthly", existingCategoryIds = [] }) {
  const [selectedCatId, setSelectedCatId] = React.useState("");
  const [customName, setCustomName]       = React.useState("");
  const [limit, setLimit]                 = React.useState("");
  const [periode, setPeriode]             = React.useState(defaultPeriod);
  const [customColor, setCustomColor]     = React.useState(PRESET_COLORS[0]);

  const isCustom    = selectedCatId === "__custom__";
  const selectedCat = CATEGORIES.find(c => c.id === selectedCatId);
  const label       = isCustom ? customName.trim() : (selectedCat?.label || "");
  const color       = isCustom ? customColor : (selectedCat?.color || "var(--sage)");
  const categoryId  = isCustom ? null : selectedCatId || null;

  const availableCats = CATEGORIES.filter(c => !existingCategoryIds.includes(c.id));
  const valid = label.length > 0 && +limit > 0 && selectedCatId !== "";

  const submit = () => {
    if (!valid) return;
    onAdd({
      id: `cat-${Date.now()}`,
      categoryId,
      label,
      color,
      spent: 0,
      limit: +limit,
      enabled: true,
      periode,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 16, animation: "rise .25s ease-out" }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()}
        style={{ width: "min(480px, 100%)", padding: 24, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Anggaran baru</div>
            <div className="serif" style={{ fontSize: 24, marginTop: 4, letterSpacing: "-0.01em" }}>Tambah kategori</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {/* Category selector */}
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>Kategori</span>
            <select autoFocus value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}
              style={{ width: "100%", padding: "11px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: selectedCatId ? "var(--ink)" : "var(--muted)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
              <option value="">Pilih kategori…</option>
              {availableCats.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
              <option value="__custom__">Kustom (nama bebas)</option>
            </select>
          </label>

          {/* Custom name input — hanya muncul jika pilih Kustom */}
          {isCustom && (
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>Nama kategori kustom</span>
              <input autoFocus value={customName} onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="Contoh: Rokok, Laundry, Investasi…"
                style={{ width: "100%", padding: "11px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </label>
          )}

          {/* Limit */}
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>Batas anggaran (Rp)</span>
            <input value={limit} onChange={e => setLimit(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="500000"
              style={{ width: "100%", padding: "11px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </label>

          {/* Periode */}
          <div>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Periode</span>
            <div style={{ display: "flex", padding: 3, background: "var(--ivory)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              {[{ id: "monthly", label: "Bulanan" }, { id: "weekly", label: "Mingguan" }].map(p => (
                <button key={p.id} type="button" onClick={() => setPeriode(p.id)}
                  style={{ flex: 1, padding: "9px 10px", fontSize: 13, background: periode === p.id ? "var(--paper)" : "transparent", border: periode === p.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: periode === p.id ? "var(--ink)" : "var(--muted)", fontWeight: periode === p.id ? 500 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Warna kustom — hanya untuk kategori kustom */}
          {isCustom && (
            <div>
              <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Warna</span>
              <div style={{ display: "flex", gap: 8 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setCustomColor(c)}
                    style={{ width: 28, height: 28, borderRadius: "50%", border: customColor === c ? "2px solid var(--ink)" : "2px solid transparent", background: c, cursor: "pointer", outline: customColor === c ? "2px solid var(--ivory)" : "none", outlineOffset: "-4px" }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)" }}>Batal</button>
          <button onClick={submit} disabled={!valid}
            style={{ flex: 2, padding: "13px", background: valid ? "var(--ink)" : "var(--line-soft)", color: valid ? "var(--cream)" : "var(--muted-2)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: valid ? "pointer" : "default" }}>
            Tambah kategori
          </button>
        </div>
      </div>
    </div>
  );
}
