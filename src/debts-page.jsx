import React from 'react';
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
function dueBadge(due_date, status) {
  if (!due_date || status === 'paid') return null;
  const today = todayISO();
  if (due_date < today)           return { label: 'Lewat tempo', color: 'var(--terra)' };
  if (due_date <= plusDaysISO(3)) return { label: 'Segera',      color: 'var(--gold)' };
  return null;
}

const TABS = [
  { id: 'receivable', label: 'Piutang' },
  { id: 'payable',    label: 'Hutang' },
  { id: 'paid',       label: 'Lunas' },
];

export default function DebtsPage({
  debts = [], loading,
  createDebt, addPayment, markPaid, deleteDebt, getPayments,
  wallets = [], isPro,
}) {
  const isMobile = useIsMobile();
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
            {activeDebts.length} catatan aktif
          </div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
            Hutang &amp; Piutang
          </h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
              Catat uang yang kamu pinjamkan (piutang) dan yang kamu pinjam (hutang). Saldo dompet ikut menyesuaikan otomatis.
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
        >
          <IconPlus size={15} /> Catatan Baru
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
                  ⚠ Kamu telat membayar <strong>{d.person_name}</strong> {n} hari
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openDetail(d.id, true)} style={{ padding: "7px 12px", background: "var(--terra)", color: "#fff", border: 0, borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>Bayar sekarang</button>
                  <button onClick={() => dismissBanner(d.id)} style={{ padding: "7px 12px", background: "transparent", border: "1px solid var(--line-soft)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}>Nanti</button>
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
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Total Piutang</div>
            <div className="serif tnum" style={{ fontSize: isMobile ? 24 : 30, letterSpacing: "-0.02em", marginTop: 4, color: "var(--sage)" }}>{fmt(totalReceivable)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Uang kamu di orang lain</div>
          </div>
          <div style={{ width: 1, background: "var(--line-soft)", alignSelf: "stretch" }} />
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Total Hutang</div>
            <div className="serif tnum" style={{ fontSize: isMobile ? 24 : 30, letterSpacing: "-0.02em", marginTop: 4, color: "var(--terra)" }}>{fmt(totalPayable)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Yang harus kamu bayar</div>
          </div>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, marginBottom: 18 }}>
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
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Memuat…</div>
      ) : list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
          {activeTab === 'paid'
            ? 'Belum ada catatan yang lunas.'
            : activeTab === 'receivable'
              ? 'Belum ada piutang. Tekan "Catatan Baru" untuk mencatat uang yang kamu pinjamkan.'
              : 'Belum ada hutang. Tekan "Catatan Baru" untuk mencatat uang yang kamu pinjam.'}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(d => {
            // Catatan terkunci: sembunyikan badge jatuh tempo (tak ada urgensi
            // karena user tidak bisa aksi apapun) dan redupkan tampilannya.
            const badge = d.is_locked ? null : dueBadge(d.due_date, d.status);
            const pct = d.amount > 0 ? Math.min(d.paid / d.amount, 1) : 0;
            return (
              <div key={d.id} onClick={() => openDetail(d.id)} className="card rise" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", cursor: "pointer", opacity: d.is_locked ? 0.6 : 1 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{d.person_name}</span>
                    {d.is_locked && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: "rgba(42,44,32,.72)", borderRadius: 99, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>🔒 Terkunci</span>
                    )}
                    {badge && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: badge.color, borderRadius: 99, padding: "2px 8px" }}>{badge.label}</span>
                    )}
                    {d.status === 'paid' && (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sage)", border: "1px solid var(--sage)", borderRadius: 99, padding: "1px 8px" }}>Lunas</span>
                    )}
                  </div>
                  {d.note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.note}</div>}
                  <div style={{ height: 5, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden", marginTop: 8, maxWidth: 320 }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: d.type === 'receivable' ? "var(--sage)" : "var(--terra)", borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="tnum" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(d.remaining)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>dari {fmt(d.amount)}</div>
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
