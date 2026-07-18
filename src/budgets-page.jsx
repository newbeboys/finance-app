import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { fmt, fmtShort, formatNominal, nominalFontSize, CATEGORIES } from './data';
import { IconPlus, IconSpark, IconClose, IconEdit, CatIcon } from './icons';
import { useIsMobile } from './use-mobile';
import { CategoryField, CUSTOM_ID } from './category-field';
import { useScrollLock } from './hooks/useScrollLock';
import { formatRupiahInput } from './utils/numberFormat';

export function BudgetsPage({ transactions = [], budgets = [], onAdd, onUpdate, onDelete, customCategories = [], onCreateCustom, onDeleteCustom, isPro = false, isBasicAtMax = false, userId }) {
  const { t: tr, i18n: i18nObj } = useTranslation();
  const isMobile = useIsMobile();

  const [period, setPeriod] = React.useState("monthly");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingBudget, setEditingBudget] = React.useState(null);

  const deleteRow = (id) => onDelete(id);

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

  const getSpent = (r) => {
    if (r.categoryId) return spentByCategory[r.categoryId] || 0;
    const bl = (r.label || '').toLowerCase().trim();
    const match = CATEGORIES.find(c => {
      const cl = c.label.toLowerCase();
      return cl === bl || cl.startsWith(bl) || bl.startsWith(cl.split(' ')[0]);
    });
    return match ? (spentByCategory[match.id] || 0) : 0;
  };

  const rows = budgets;
  const visibleRows = rows.filter(r => (r.periode || "monthly") === period);
  const active      = visibleRows.filter(r => r.enabled);
  const totalLimit  = active.reduce((s, r) => s + r.limit, 0);
  const totalSpent  = active.reduce((s, r) => s + getSpent(r), 0);
  const totalPct    = totalLimit ? totalSpent / totalLimit : 0;
  const overCount   = active.filter(r => getSpent(r) > r.limit).length;

  const locale = i18nObj.language === 'en' ? 'en-US' : 'id-ID';
  const monthLabel = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' }).toUpperCase();
  const isBulanan = period === "monthly";

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: 1180, margin: "0 auto" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('anggaran.judulHalaman', { bulan: monthLabel })}</div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>{tr('anggaran.aturAnggaranBulanan')}</h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>
              {tr('anggaran.deskripsiHalaman')}
            </div>
          )}
        </div>
        <div data-tour="budget-period-toggle" style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
          {[{ id: "monthly", labelKey: "anggaran.bulanan" }, { id: "weekly", labelKey: "anggaran.mingguan" }].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: isMobile ? "9px 16px" : "7px 14px", fontSize: isMobile ? 13 : 12.5, background: period === p.id ? "var(--ivory)" : "transparent", border: period === p.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: period === p.id ? "var(--ink)" : "var(--muted)", fontWeight: period === p.id ? 500 : 400 }}>{tr(p.labelKey)}</button>
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
          <div className="serif" style={{ fontSize: isMobile ? 22 : 28, letterSpacing: "-0.01em" }}>{tr('anggaran.belumAdaAnggaran')}</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, maxWidth: 380 }}>
            {tr('anggaran.deskripsiKosong')}
          </div>
          <button
            data-tour="budget-add-category"
            onClick={() => setShowAddModal(true)}
            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500 }}>
            <IconPlus size={15} /> {tr('anggaran.tambahKategori')}
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary card ── */}
          {isMobile ? (
            <div className="card rise" style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{isBulanan ? tr('anggaran.totalAnggaranBulanan') : tr('anggaran.totalAnggaranMingguan')}</div>
                <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(totalLimit, { hero: true, mobile: true }), letterSpacing: "-0.02em", marginTop: 4 }}>{formatNominal(totalLimit)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr('anggaran.kategoriAktif', { count: active.length })}</div>
                <div style={{ marginTop: 12, height: 8, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(totalPct, 1) * 100}%`, background: totalPct > 1 ? "var(--terra)" : "var(--sage)", borderRadius: 99, transition: "width .5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  <span>{tr('anggaran.terpakai', { jumlah: fmtShort(totalSpent) })}</span>
                  <span>{Math.round(totalPct * 100)}%</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('anggaran.sisa')}</div>
                  <div className="serif tnum" style={{ fontSize: 22, letterSpacing: "-0.02em", marginTop: 4, color: totalLimit - totalSpent < 0 ? "var(--terra)" : "var(--ink)" }}>{fmtShort(totalLimit - totalSpent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('anggaran.status')}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: overCount ? "var(--terra)" : "var(--sage)", flexShrink: 0 }} />
                    <span className="serif" style={{ fontSize: 16 }}>{overCount ? tr('anggaran.overCount', { count: overCount }) : tr('anggaran.semuaAman')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card rise budget-summary-grid" style={{ padding: 24, display: "grid", gridTemplateColumns: "1.1fr 1px 1fr 1px 1fr", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{isBulanan ? tr('anggaran.totalAnggaranBulanan') : tr('anggaran.totalAnggaranMingguan')}</div>
                <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(totalLimit, { hero: true }), letterSpacing: "-0.02em", marginTop: 6 }}>{formatNominal(totalLimit)}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{tr('anggaran.kategoriAktif', { count: active.length })}</div>
                <div style={{ marginTop: 14, height: 8, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(totalPct, 1) * 100}%`, background: totalPct > 1 ? "var(--terra)" : "var(--sage)", borderRadius: 99, transition: "width .5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11.5, color: "var(--muted)" }}>
                  <span>{tr('anggaran.terpakai', { jumlah: fmtShort(totalSpent) })}</span>
                  <span>{Math.round(totalPct * 100)}%</span>
                </div>
              </div>
              <div style={{ width: 1, height: 80, background: "var(--line-soft)" }} />
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('anggaran.sisa')}</div>
                <div className="serif tnum" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 6, color: totalLimit - totalSpent < 0 ? "var(--terra)" : "var(--ink)" }}>{fmtShort(totalLimit - totalSpent)}</div>
              </div>
              <div style={{ width: 1, height: 80, background: "var(--line-soft)" }} />
              <div>
                <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('anggaran.status')}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: overCount ? "var(--terra)" : "var(--sage)" }} />
                  <span className="serif" style={{ fontSize: 22 }}>{overCount ? tr('anggaran.overCountKategori', { count: overCount }) : tr('anggaran.semuaAman')}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.45 }}>
                  {overCount ? tr('anggaran.tinjauOver') : tr('anggaran.masihAman')}
                </div>
              </div>
            </div>
          )}

          {/* ── Budget rows card ── */}
          <div className="card rise" style={{ padding: isMobile ? "8px 16px 16px" : "8px 24px 16px" }}>
            {!isMobile && (
              <div className="budget-cols-header" style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 80px", padding: "16px 0 10px", borderBottom: "1px solid var(--line-soft)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", alignItems: "center", gap: 16 }}>
                <span>{tr('anggaran.tableKategori')}</span><span>{tr('anggaran.tableProgress')}</span>
                <span style={{ textAlign: "right" }}>{isBulanan ? tr('anggaran.tableBatasBulanan') : tr('anggaran.tableBatasMingguan')}</span>
                <span />
              </div>
            )}

            {visibleRows.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                </svg>
                <div className="serif" style={{ fontSize: isMobile ? 18 : 22, letterSpacing: "-0.01em" }}>
                  {isBulanan ? tr('anggaran.belumAdaBulanan') : tr('anggaran.belumAdaMingguan')}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, maxWidth: 340 }}>
                  {isBulanan ? tr('anggaran.tambahPertamaBulanan') : tr('anggaran.tambahPertamaMingguan')}
                </div>
              </div>
            )}

            {visibleRows.map((r, i) => {
              const computedSpent = getSpent(r);
              const currentLimit  = r.limit;
              const pct  = currentLimit ? computedSpent / currentLimit : 0;
              const over = computedSpent > currentLimit;

              if (isMobile) {
                return (
                  <div key={r.id} style={{ padding: "16px 0", borderBottom: i < visibleRows.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                        <CatIcon kind={r.categoryId || r.id} size={17} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                        <div className="tnum" style={{ fontSize: 12, color: over ? "var(--terra)" : "var(--muted)", marginTop: 1 }}>
                          {fmtShort(computedSpent)} <span style={{ color: "var(--muted-2)" }}>{tr('anggaran.dari')}</span> {fmtShort(r.limit)}
                          {over && <span style={{ marginLeft: 6, color: "var(--terra)" }}>• {tr('anggaran.over')}</span>}
                        </div>
                      </div>
                      <button onClick={() => setEditingBudget(r)} title={tr('umum.edit')} aria-label={tr('umum.edit')} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--ink-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <IconEdit size={14} />
                      </button>
                      <button onClick={() => deleteRow(r.id)} title={tr('umum.hapus')} aria-label={tr('umum.hapus')} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <IconClose size={13} />
                      </button>
                    </div>
                    <div style={{ height: 7, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                    </div>
                  </div>
                );
              }

              return (
                <div key={r.id} className="budget-cols-row" style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.4fr) 1.6fr 150px 80px", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: i < visibleRows.length - 1 ? "1px solid var(--line-soft)" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `color-mix(in oklch, ${r.color} 16%, var(--ivory))`, color: r.color, display: "grid", placeItems: "center" }}>
                      <CatIcon kind={r.categoryId || r.id} size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                      <div className="tnum" style={{ fontSize: 11.5, color: over ? "var(--terra)" : "var(--muted)" }}>{tr('anggaran.terpakai', { jumlah: fmtShort(computedSpent) })}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 1) * 100}%`, background: over ? "var(--terra)" : r.color, borderRadius: 99, transition: "width .35s ease" }} />
                    </div>
                  </div>

                  <div className="tnum" style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(r.limit)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={() => setEditingBudget(r)} title={tr('umum.edit')} aria-label={tr('umum.edit')} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--ink-2)", display: "grid", placeItems: "center" }}>
                      <IconEdit size={14} />
                    </button>
                    <button onClick={() => deleteRow(r.id)} title={tr('umum.hapus')} aria-label={tr('umum.hapus')} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--paper)", color: "var(--terra)", display: "grid", placeItems: "center" }}>
                      <IconClose size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            <div style={{ paddingTop: 18, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "stretch" : "flex-start", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 0 }}>
              <button data-tour="budget-add-category" onClick={() => setShowAddModal(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: 8, padding: isMobile ? "13px 14px" : "9px 14px", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 10, fontSize: isMobile ? 14 : 12.5, color: "var(--ink-2)" }}>
                <IconPlus size={14} /> {tr('anggaran.tambahKategori')}
              </button>
            </div>
          </div>

          {/* ── Tips ── */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "4px 6px", color: "var(--muted)", fontSize: isMobile ? 13 : 12.5, lineHeight: 1.5 }}>
            <span style={{ color: "var(--gold)", marginTop: 1 }}><IconSpark size={15} /></span>
            <span>
              <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>Tips:</strong> {tr('anggaran.tips')}
            </span>
          </div>
        </>
      )}

      {(showAddModal || editingBudget) && (
        <AddBudgetModal
          initial={editingBudget}
          defaultPeriod={period}
          existingCategoryIds={rows.map(r => r.categoryId).filter(Boolean)}
          customCategories={customCategories}
          onCreateCustom={onCreateCustom}
          onDeleteCustom={onDeleteCustom}
          onClose={() => { setShowAddModal(false); setEditingBudget(null); }}
          onAdd={onAdd}
          onUpdate={(id, patch) => { onUpdate(id, patch); setEditingBudget(null); }}
          isPro={isPro}
          isBasicAtMax={isBasicAtMax}
          userId={userId}
        />
      )}
    </div>
  );
}

function AddBudgetModal({ onClose, onAdd, onUpdate, initial = null, defaultPeriod = "monthly", existingCategoryIds = [], customCategories = [], onCreateCustom, onDeleteCustom, isPro = false, isBasicAtMax = false, userId }) {
  const { t: tr } = useTranslation();
  useScrollLock(true);
  const isEdit = !!initial;
  const [selectedCatId, setSelectedCatId] = React.useState(initial?.categoryId || "");
  const [pendingCustom, setPendingCustom] = React.useState(null);
  const [limit, setLimit]                 = React.useState(initial ? String(initial.limit ?? "") : "");
  const [periode, setPeriode]             = React.useState(initial?.periode || defaultPeriod);
  const [saving, setSaving]               = React.useState(false);

  const isCustom = selectedCatId === CUSTOM_ID;

  // EDIT: kategori milik budget yang sedang diedit tidak dianggap "sudah dipakai",
  // supaya user bisa mempertahankannya atau berpindah ke kategori lain yang masih bebas.
  const usedCatIds = isEdit ? existingCategoryIds.filter(id => id !== initial.categoryId) : existingCategoryIds;
  const availableCats   = CATEGORIES.filter(c => !usedCatIds.includes(c.id));
  const availableCustom = customCategories.filter(c => !c.is_deleted && !usedCatIds.includes(c.id));

  const customNameValid = (pendingCustom?.name || "").trim().length > 0;
  // EDIT: pembuatan kategori kustom baru tidak diizinkan (alur create di-skip demi keamanan).
  const valid = +limit > 0 && selectedCatId !== "" && (isEdit ? !isCustom : (!isCustom || customNameValid));

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);

    // ── EDIT: tidak pernah memanggil onCreateCustom (skip alur kategori kustom, risiko #4). ──
    // Catatan: useBudgets.updateBudget hanya mem-patch limit/label/color ke Supabase
    // (kolom category & period tidak ikut ter-update — lihat catatan di laporan).
    if (isEdit) {
      const cat = [...CATEGORIES, ...customCategories].find(c => c.id === selectedCatId);
      onUpdate(initial.id, {
        category: selectedCatId,
        categoryId: selectedCatId,
        label: cat?.label || initial.label || "",
        color: cat?.color || initial.color || "var(--sage)",
        limit: +limit,
        period: periode,
        periode,
      });
      return;
    }

    let categoryId, label, color;
    if (isCustom) {
      if (!onCreateCustom) { setSaving(false); return; }
      const res = await onCreateCustom({ name: pendingCustom.name, color: pendingCustom.color });
      // Limit plan tercapai → PaywallModal sudah tampil; batal diam-diam.
      if (res?.limitReached) { setSaving(false); return; }
      const { category, error } = res;
      if (error || !category) { setSaving(false); return; }
      categoryId = category.id; label = category.label; color = category.color;
    } else {
      const cat = [...CATEGORIES, ...customCategories].find(c => c.id === selectedCatId);
      categoryId = selectedCatId;
      label = cat?.label || "";
      color = cat?.color || "var(--sage)";
    }

    const res = await onAdd({
      id: `cat-${Date.now()}`,
      categoryId,
      label,
      color,
      spent: 0,
      limit: +limit,
      enabled: true,
      periode,
    });
    // Limit anggaran tercapai → PaywallModal sudah tampil; batal diam-diam (modal tetap terbuka).
    if (res?.limitReached) { setSaving(false); return; }
    if (res?.error) { setSaving(false); return; }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 16, animation: "rise .25s ease-out" }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()}
        style={{ width: "min(480px, 100%)", padding: 24, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{isEdit ? tr('anggaran.editAnggaran') : tr('anggaran.anggaranBaru')}</div>
            <div className="serif" style={{ fontSize: 24, marginTop: 4, letterSpacing: "-0.01em" }}>{isEdit ? tr('anggaran.editKategoriLabel') : tr('anggaran.tambahKategoriLabel')}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>{tr('anggaran.labelKategori')}</span>
            <CategoryField
              value={selectedCatId}
              onChange={setSelectedCatId}
              categories={availableCats}
              customCategories={availableCustom}
              pending={pendingCustom}
              onPendingChange={setPendingCustom}
              onDeleteCustom={onDeleteCustom}
              isPro={isPro}
              isBasicAtMax={isBasicAtMax}
              userId={userId}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>{tr('anggaran.batasAnggaranLabel')}</span>
            <input inputMode="numeric" value={formatRupiahInput(limit)} onChange={e => setLimit(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="500.000"
              style={{ width: "100%", padding: "11px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </label>

          <div>
            <span style={{ display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>{tr('anggaran.periodeLabel')}</span>
            <div style={{ display: "flex", padding: 3, background: "var(--ivory)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              {[{ id: "monthly", labelKey: "anggaran.bulanan" }, { id: "weekly", labelKey: "anggaran.mingguan" }].map(p => (
                <button key={p.id} type="button" onClick={() => setPeriode(p.id)}
                  style={{ flex: 1, padding: "9px 10px", fontSize: 13, background: periode === p.id ? "var(--paper)" : "transparent", border: periode === p.id ? "1px solid var(--line-soft)" : "1px solid transparent", borderRadius: 8, color: periode === p.id ? "var(--ink)" : "var(--muted)", fontWeight: periode === p.id ? 500 : 400, fontFamily: "inherit", cursor: "pointer" }}>
                  {tr(p.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 14, color: "var(--ink-2)" }}>{tr('umum.batal')}</button>
          <button onClick={submit} disabled={!valid || saving}
            style={{ flex: 2, padding: "13px", background: (valid && !saving) ? "var(--ink)" : "var(--line-soft)", color: (valid && !saving) ? "var(--cream)" : "var(--muted-2)", border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: (valid && !saving) ? "pointer" : "default" }}>
            {saving ? tr('anggaran.menyimpan') : (isEdit ? tr('anggaran.simpanPerubahan') : tr('anggaran.tambahKategori'))}
          </button>
        </div>
      </div>
    </div>
  );
}
