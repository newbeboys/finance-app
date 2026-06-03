import React from 'react';
import { TRANSACTIONS, CATEGORIES, BUDGETS, fmt, fmtShort } from './data';
import { IconPlus, IconSpark, CatIcon } from './icons';
import { useIsMobile } from './use-mobile';

export function BudgetsPage() {
  const isMobile = useIsMobile();

  const seed = React.useMemo(() => {
    const spentByCat = {};
    TRANSACTIONS.forEach(t => { if (t.amount < 0) spentByCat[t.category] = (spentByCat[t.category] || 0) + Math.abs(t.amount); });
    CATEGORIES.forEach(c => { if (spentByCat[c.id] == null) spentByCat[c.id] = c.amount; });
    const existing = Object.fromEntries(BUDGETS.map(b => [b.id, b.limit]));
    return CATEGORIES.map(c => {
      const spent = spentByCat[c.id] ?? c.amount;
      const limit = existing[c.id] ?? Math.ceil((spent * 1.2) / 100_000) * 100_000;
      return { id: c.id, label: c.label, color: c.color, spent, limit, enabled: existing[c.id] != null };
    });
  }, []);

  const [rows, setRows] = React.useState(seed);
  const [editing, setEditing] = React.useState(null);
  const [period, setPeriod] = React.useState("monthly");

  const setLimit = (id, limit) => setRows(rs => rs.map(r => r.id === id ? { ...r, limit: Math.max(0, limit) } : r));
  const toggle   = (id)        => setRows(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const active = rows.filter(r => r.enabled);
  const totalLimit = active.reduce((s, r) => s + r.limit, 0);
  const totalSpent = active.reduce((s, r) => s + r.spent, 0);
  const totalPct = totalLimit ? totalSpent / totalLimit : 0;
  const overCount = active.filter(r => r.spent > r.limit).length;

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: 1180, margin: "0 auto" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Anggaran · Mei 2026</div>
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

      {/* ── Summary card ── */}
      {isMobile ? (
        <div className="card rise" style={{ padding: 18 }}>
          {/* Total anggaran */}
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

          {/* Sisa + Status row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Sisa</div>
              <div className="serif tnum" style={{ fontSize: 22, letterSpacing: "-0.02em", marginTop: 4, color: totalLimit - totalSpent < 0 ? "var(--terra)" : "var(--ink)" }}>{fmtShort(totalLimit - totalSpent)}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>untuk 2 hari tersisa</div>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: overCount ? "var(--terra)" : "var(--sage)", flexShrink: 0 }} />
                <span className="serif" style={{ fontSize: 16 }}>{overCount ? `${overCount} over` : "Semua aman"}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>
                {overCount ? "Tinjau kategori merah." : "Masih dalam batas."}
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
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>untuk 2 hari tersisa</div>
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

        {/* Desktop table header */}
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 90px", padding: "16px 0 10px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", alignItems: "center", gap: 16 }}>
            <span>Kategori</span><span>Progress</span>
            <span style={{ textAlign: "right" }}>Batas {period === "monthly" ? "/bln" : "/mgg"}</span>
            <span style={{ textAlign: "right" }}>Aktif</span>
          </div>
        )}

        {rows.map((r, i) => {
          const pct = r.limit ? r.spent / r.limit : 0;
          const over = r.spent > r.limit;
          const isEditing = editing === r.id;

          if (isMobile) {
            return (
              <div key={r.id} style={{ padding: "16px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--line-soft)" : 0, opacity: r.enabled ? 1 : 0.5, transition: "opacity .2s ease" }}>

                {/* Category name + toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                    <CatIcon kind={r.id} size={17} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                    <div className="tnum" style={{ fontSize: 12, color: over ? "var(--terra)" : "var(--muted)", marginTop: 1 }}>
                      {fmtShort(r.spent)} <span style={{ color: "var(--muted-2)" }}>dari</span> {fmtShort(r.limit)}
                      {over && <span style={{ marginLeft: 6, color: "var(--terra)" }}>• over!</span>}
                    </div>
                  </div>
                  <button onClick={() => toggle(r.id)} role="switch" aria-checked={r.enabled}
                    style={{ width: 44, height: 26, borderRadius: 99, border: 0, padding: 3, background: r.enabled ? "var(--sage)" : "var(--line)", display: "flex", justifyContent: r.enabled ? "flex-end" : "flex-start", transition: "background .2s ease", flexShrink: 0 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--paper)", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ height: 7, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                </div>

                {/* Slider + limit input */}
                {r.enabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="range" min="0" max={Math.max(r.spent * 2, 2_000_000)} step="50000"
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

          /* Desktop row */
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 90px", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--line-soft)" : 0, opacity: r.enabled ? 1 : 0.5, transition: "opacity .2s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                  <CatIcon kind={r.id} size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                  <div className="tnum" style={{ fontSize: 11.5, color: over ? "var(--terra)" : "var(--muted)" }}>Terpakai {fmtShort(r.spent)}</div>
                </div>
              </div>

              <div>
                <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                </div>
                {r.enabled && (
                  <input type="range" min="0" max={Math.max(r.spent * 2, 2_000_000)} step="50000"
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
            </div>
          );
        })}

        {/* Footer buttons */}
        <div style={{ paddingTop: 18, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "stretch" : "space-between", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 0 }}>
          <button style={{ display: "inline-flex", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: 8, padding: isMobile ? "13px 14px" : "9px 14px", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 10, fontSize: isMobile ? 14 : 12.5, color: "var(--ink-2)" }}>
            <IconPlus size={14} /> Tambah kategori anggaran
          </button>
          <button style={{ padding: isMobile ? "14px 18px" : "10px 18px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 10, fontSize: isMobile ? 14 : 13, fontWeight: 500 }}>Simpan anggaran</button>
        </div>
      </div>

      {/* ── Tips ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "4px 6px", color: "var(--muted)", fontSize: isMobile ? 13 : 12.5, lineHeight: 1.5 }}>
        <span style={{ color: "var(--gold)", marginTop: 1 }}><IconSpark size={15} /></span>
        <span>
          <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>Tips:</strong> aktifkan reminder agar FinanceApp memberi tahu saat sebuah kategori mencapai 80% dari batasnya. Semua fitur ini gratis.
        </span>
      </div>
    </div>
  );
}
