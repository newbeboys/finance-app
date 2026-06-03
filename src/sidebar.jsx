import React from 'react';
import {
  IconDashboard, IconWallet, IconTx, IconChart, IconBudget,
  IconSave, IconReport, IconSettings,
} from './icons';

const IconMore = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="4.5" cy="10" r="1.6" fill="currentColor"/>
    <circle cx="10"  cy="10" r="1.6" fill="currentColor"/>
    <circle cx="15.5" cy="10" r="1.6" fill="currentColor"/>
  </svg>
);

const ALL_NAV = [
  { id: "dashboard",    label: "Beranda",    Icon: IconDashboard },
  { id: "wallets",      label: "Dompet",     Icon: IconWallet },
  { id: "transactions", label: "Transaksi",  Icon: IconTx, badge: 3 },
  { id: "analytics",    label: "Analitik",   Icon: IconChart },
  { id: "budgets",      label: "Anggaran",   Icon: IconBudget },
  { id: "savings",      label: "Tabungan",   Icon: IconSave },
  { id: "reports",      label: "Laporan",    Icon: IconReport },
  { id: "settings",     label: "Pengaturan", Icon: IconSettings },
];

const BOTTOM_MAIN = ["dashboard", "transactions", "analytics", "wallets", "settings"];
const BOTTOM_MORE = ["budgets", "savings", "reports"];

// Sidebar renders ONLY the bottom navigation bar.
// The desktop sidebar has been removed permanently.
export function Sidebar({ active, onNav }) {
  const [showMore, setShowMore] = React.useState(false);
  const moreActive = BOTTOM_MORE.includes(active);

  // Close the "more" drawer whenever the active page changes.
  React.useEffect(() => {
    setShowMore(false);
  }, [active]);

  return (
    <>
      {/* "More" drawer — slides up above the bottom nav */}
      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            style={{ position: "fixed", inset: 0, zIndex: 98, background: "rgba(0,0,0,0.35)" }}
          />
          <div className="card bottom-nav-more-sheet rise" style={{ padding: 8, margin: "0 12px", bottom: 68 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {BOTTOM_MORE.map(id => {
                const { label, Icon } = ALL_NAV.find(n => n.id === id);
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => { onNav(id); setShowMore(false); }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 6, padding: "14px 8px",
                      background: isActive ? "var(--paper)" : "transparent",
                      border: "1px solid " + (isActive ? "var(--line-soft)" : "transparent"),
                      borderRadius: 12, color: isActive ? "var(--ink)" : "var(--ink-2)",
                      fontSize: 13, fontWeight: isActive ? 600 : 400, minHeight: 70,
                    }}
                  >
                    <Icon size={22} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav className="bottom-nav">
        {BOTTOM_MAIN.map(id => {
          const { label, Icon, badge } = ALL_NAV.find(n => n.id === id);
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => { onNav(id); setShowMore(false); }}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                background: "transparent", border: 0, padding: "6px 4px",
                color: isActive ? "var(--ink)" : "var(--muted)",
                fontSize: 10.5, fontWeight: isActive ? 600 : 400,
                position: "relative", minHeight: 60,
              }}
            >
              {isActive && (
                <span style={{
                  position: "absolute", top: 5,
                  width: 36, height: 28, borderRadius: 10,
                  background: "var(--paper)", border: "1px solid var(--line-soft)",
                }} />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>
                {badge ? (
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <Icon size={22} />
                    <span style={{
                      position: "absolute", top: -4, right: -6,
                      minWidth: 14, height: 14, borderRadius: 7,
                      background: "var(--terra)", color: "var(--cream)",
                      fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center",
                      padding: "0 3px",
                    }}>{badge}</span>
                  </span>
                ) : (
                  <Icon size={22} />
                )}
              </span>
              <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
            </button>
          );
        })}

        {/* "More" button */}
        <button
          onClick={() => setShowMore(s => !s)}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            background: "transparent", border: 0, padding: "6px 4px",
            color: (showMore || moreActive) ? "var(--ink)" : "var(--muted)",
            fontSize: 10.5, fontWeight: (showMore || moreActive) ? 600 : 400,
            position: "relative", minHeight: 60,
          }}
        >
          {(showMore || moreActive) && (
            <span style={{
              position: "absolute", top: 5,
              width: 36, height: 28, borderRadius: 10,
              background: "var(--paper)", border: "1px solid var(--line-soft)",
            }} />
          )}
          <span style={{ position: "relative", zIndex: 1 }}><IconMore size={22} /></span>
          <span style={{ position: "relative", zIndex: 1 }}>Lainnya</span>
        </button>
      </nav>
    </>
  );
}
