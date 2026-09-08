import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmt } from './data';
import { IconPlus } from './icons';
import { useIsMobile } from './use-mobile';
import AddDebtModal from './components/debts/AddDebtModal';
import DebtDetailSheet from './components/debts/DebtDetailSheet';

// Status jatuh tempo untuk badge. Bandingkan langsung sebagai string ISO
// (YYYY-MM-DD) — sama seperti pola tanggal lain di app, aman dari timezone.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function plusDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(fromISO, toISOstr) {
  return Math.round((new Date(toISOstr + 'T00:00:00') - new Date(fromISO + 'T00:00:00')) / 86400000);
}
// `t` dioper sebagai argumen (bukan dipanggil di sini via useTranslation) karena
// ini fungsi biasa di luar komponen, bukan render function.
function dueBadge(t, due_date, status) {
  if (!due_date || status === 'paid') return null;
  const today = todayISO();
  if (due_date < today)           return { label: t('debts.badge.overdue'), color: 'var(--terra)' };
  if (due_date <= plusDaysISO(3)) return { label: t('debts.badge.dueSoon'), color: 'var(--gold)' };
  return null;
}

export default function DebtsPage({
  debts = [], loading,
  createDebt, addPayment, markPaid, deleteDebt, getPayments,
  wallets = [], isPro,
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const TABS = [
    { id: 'receivable', label: t('debts.badge.receivable') },
    { id: 'payable',    label: t('debts.badge.payable') },
    { id: 'paid',       label: t('debts.badge.paid') },
  ];
  const [activeTab, setActiveTab] = React.useState('receivable');
  const [showAdd, setShowAdd] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(null);
  const [payInitial, setPayInitial] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => new Set()); // banner "Nanti" — sesi ini saja
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // Ringkasan header dari SEMUA catatan aktif (bukan hanya tab terbuka).
  // Total HANYA menghitung catatan yang tidak terkunci — catatan terkunci
  // (sisa downgrade Pro→Basic) tidak bisa dikelola, jadi dikeluarkan dari total.
  const activeDebts     = debts.filter(d => d.status === 'active');
  const manageable      = activeDebts.filter(d => !d.is_locked);
  const totalReceivable = manageable.filter(d => d.type === 'receivable').reduce((s, d) => s + d.remaining, 0);
  const totalPayable    = manageable.filter(d => d.type === 'payable').reduce((s, d) => s + d.remaining, 0);

  // List sesuai tab
  const list =
    activeTab === 'paid'
      ? debts.filter(d => d.status === 'paid')
      : debts.filter(d => d.type === activeTab && d.status === 'active');

  // Banner telat bayar (§7): semua catatan aktif lewat tempo, lintas tab.
  // Hilang permanen bila ada cicilan pada/setelah due_date, atau sudah lunas.
  const today = todayISO();
  const lateDebts = debts.filter(d =>
    d.status === 'active' &&
    !d.is_locked &&   // catatan terkunci tidak dapat banner — user tidak bisa aksi apapun
    d.due_date && d.due_date < today &&
    !(d.lastPaymentDate && d.lastPaymentDate >= d.due_date) &&
    !dismissed.has(d.id)
  );

  const selectedDebt = selectedId ? (debts.find(d => d.id === selectedId) || null) : null;

  const openDetail = (id, pay = false) => { setSelectedId(id); setPayInitial(pay); };
  const closeDetail = () => { setSelectedId(null); setPayInitial(false); };
  const dismissBanner = (id) => setDismissed(prev => new Set(prev).add(id));

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
            {t('debts.summary.activeCount', { count: activeDebts.length })}
          </div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
            {t('debts.title')}
          </h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
              {t('debts.subtitle')}
            </div>
          )}
        </div>
        <button
          data-tour="debts-add"
          onClick={() => setShowAdd(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
        >
          <IconPlus size={15} /> {t('debts.action.newRecord')}
        </button>
      </div>

      {/* ── Banner telat bayar ── */}
      {lateDebts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {lateDebts.map(d => {
            const n = daysBetween(d.due_date, today);
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "color-mix(in oklch, var(--terra) 10%, var(--paper))", border: "1px solid color-mix(in oklch, var(--terra) 30%, var(--line-soft))", borderRadius: 12 }}>
                <span style={{ flex: "1 1 220px", fontSize: 13, color: "var(--ink)" }}>
                  {t('debts.banner.late', { name: d.person_name, days: n })}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openDetail(d.id, true)} style={{ padding: "7px 12px", background: "var(--terra)", color: "#fff", border: 0, borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{t('debts.action.payNow')}</button>
                  <button onClick={() => dismissBanner(d.id)} style={{ padding: "7px 12px", background: "transparent", border: "1px solid var(--line-soft)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>{t('debts.action.later')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Ringkasan: total piutang vs hutang ── */}
      <div className="card rise" style={{ padding: isMobile ? 18 : 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: isMobile ? 20 : 40, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('debts.summary.totalReceivable')}</div>
            <div className="serif tnum" style={{ fontSize: isMobile ? 24 : 30, letterSpacing: "-0.02em", marginTop: 4, color: "var(--sage)" }}>{fmt(totalReceivable)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t('debts.summary.totalReceivableHint')}</div>
          </div>
          <div style={{ width: 1, background: "var(--line-soft)", alignSelf: "stretch" }} />
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{t('debts.summary.totalPayable')}</div>
            <div className="serif tnum" style={{ fontSize: isMobile ? 24 : 30, letterSpacing: "-0.02em", marginTop: 4, color: "var(--terra)" }}>{fmt(totalPayable)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{t('debts.summary.totalPayableHint')}</div>
          </div>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div data-tour="debts-tabs" style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, marginBottom: 18 }}>
        {TABS.map(tab => {
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px", borderRadius: 9, border: 0, cursor: "pointer",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--cream)" : "var(--muted)",
                fontSize: 13, fontWeight: on ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>{t('umum.memuat')}</div>
      ) : list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
          {activeTab === 'paid'
            ? t('debts.empty.paid')
            : activeTab === 'receivable'
              ? t('debts.empty.receivable')
              : t('debts.empty.payable')}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(d => {
            // Catatan terkunci: sembunyikan badge jatuh tempo (tak ada urgensi
            // karena user tidak bisa aksi apapun) dan redupkan tampilannya.
            const badge = d.is_locked ? null : dueBadge(t, d.due_date, d.status);
            const pct = d.amount > 0 ? Math.min(d.paid / d.amount, 1) : 0;
            return (
              <div key={d.id} onClick={() => openDetail(d.id)} className="card rise" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", cursor: "pointer", opacity: d.is_locked ? 0.6 : 1 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{d.person_name}</span>
                    {d.is_locked && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: "rgba(42,44,32,.72)", borderRadius: 99, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>{t('debts.badge.locked')}</span>
                    )}
                    {d.type === 'receivable' && !d.cash_disbursed_at_creation && (
                      <span title={t('debts.badge.notYetBilledHint')} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 99, padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>{t('debts.badge.notYetBilled')}</span>
                    )}
                    {badge && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: badge.color, borderRadius: 99, padding: "2px 8px" }}>{badge.label}</span>
                    )}
                    {d.status === 'paid' && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sage)", border: "1px solid var(--sage)", borderRadius: 99, padding: "1px 8px" }}>{t('debts.badge.paid')}</span>
                    )}
                  </div>
                  {d.note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.note}</div>}
                  <div style={{ height: 5, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", marginTop: 8, maxWidth: 320 }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: d.type === 'receivable' ? "var(--sage)" : "var(--terra)", borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="tnum" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(d.remaining)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{t('debts.list.ofTotal', { total: fmt(d.amount) })}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal & sheet ── */}
      <AddDebtModal open={showAdd} onClose={() => setShowAdd(false)} onCreate={createDebt} wallets={wallets} />
      {selectedDebt && (
        <DebtDetailSheet
          debt={selectedDebt}
          onClose={closeDetail}
          getPayments={getPayments}
          addPayment={addPayment}
          markPaid={markPaid}
          deleteDebt={deleteDebt}
          onToast={setToast}
          openPaymentInitially={payInitial}
          isPro={isPro}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)", zIndex: 1200, background: "var(--ink)", color: "var(--cream)", borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 500, boxShadow: "0 12px 32px -8px rgba(42,44,32,.45)", animation: "rise .25s ease-out" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
