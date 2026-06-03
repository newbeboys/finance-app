import React from 'react';
import {
  IconDashboard, IconTx, IconSave, IconBudget,
  IconChart, IconReport, IconWallet, IconSettings,
} from '../icons';

const IconMore = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="5"  cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

const MAIN_NAV = [
  { id: "dashboard",    label: "Beranda",   Icon: IconDashboard },
  { id: "transactions", label: "Transaksi", Icon: IconTx },
  { id: "savings",      label: "Tabungan",  Icon: IconSave },
  { id: "budgets",      label: "Anggaran",  Icon: IconBudget },
];

const MORE_NAV = [
  { id: "analytics", label: "Analitik",   Icon: IconChart },
  { id: "reports",   label: "Laporan",    Icon: IconReport },
  { id: "wallets",   label: "Dompet",     Icon: IconWallet },
  { id: "settings",  label: "Pengaturan", Icon: IconSettings },
];

const MORE_IDS = MORE_NAV.map(n => n.id);
const BLUE = "#3B7BF8";

export function BottomNav({ active, onNav }) {
  const [showMore, setShowMore] = React.useState(false);
  const moreActive = MORE_IDS.includes(active);

  React.useEffect(() => {
    setShowMore(false);
  }, [active]);

  function navTo(id) {
    onNav(id);
    setShowMore(false);
  }

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 98,
            background: "rgba(0,0,0,0.3)",
          }}
        />
      )}

      {/* "Lainnya" drawer — slides up above bottom nav */}
      {showMore && (
        <div
          className="card rise"
          style={{
            position: "fixed",
            bottom: 64,
            left: 8,
            right: 8,
            zIndex: 99,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {MORE_NAV.map(({ id, label, Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => navTo(id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "14px 8px",
                    background: isActive ? "var(--paper)" : "transparent",
                    border: "1px solid " + (isActive ? "var(--line-soft)" : "transparent"),
                    borderRadius: 12,
                    color: isActive ? BLUE : "var(--muted)",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    minHeight: 72,
                  }}
                >
                  <Icon size={22} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="bottom-nav">
        {MAIN_NAV.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => navTo(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                background: "transparent",
                border: 0,
                padding: "6px 4px",
                color: isActive ? BLUE : "var(--muted)",
                fontSize: 10.5,
                fontWeight: isActive ? 600 : 400,
                minHeight: 60,
                position: "relative",
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 5,
                    width: 40,
                    height: 28,
                    borderRadius: 10,
                    background: "var(--paper)",
                    border: "1px solid var(--line-soft)",
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>
                <Icon size={22} />
              </span>
              <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
            </button>
          );
        })}

        {/* Tombol Lainnya */}
        <button
          onClick={() => setShowMore(s => !s)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            background: "transparent",
            border: 0,
            padding: "6px 4px",
            color: (showMore || moreActive) ? BLUE : "var(--muted)",
            fontSize: 10.5,
            fontWeight: (showMore || moreActive) ? 600 : 400,
            minHeight: 60,
            position: "relative",
          }}
        >
          {(showMore || moreActive) && (
            <span
              style={{
                position: "absolute",
                top: 5,
                width: 40,
                height: 28,
                borderRadius: 10,
                background: "var(--paper)",
                border: "1px solid var(--line-soft)",
              }}
            />
          )}
          <span style={{ position: "relative", zIndex: 1 }}>
            <IconMore size={22} />
          </span>
          <span style={{ position: "relative", zIndex: 1 }}>Lainnya</span>
        </button>
      </nav>
    </>
  );
}
