import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconDashboard, IconTx, IconSave, IconBudget,
  IconChart, IconReport, IconWallet, IconSettings,
} from '../icons';
import { useScrollLock } from '../hooks/useScrollLock';

const IconMore = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="5"  cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

const MAIN_NAV = [
  { id: "dashboard",    tKey: "nav.beranda",   Icon: IconDashboard },
  { id: "transactions", tKey: "nav.transaksi", Icon: IconTx },
  { id: "savings",      tKey: "nav.tabungan",  Icon: IconSave },
  { id: "budgets",      tKey: "nav.anggaran",  Icon: IconBudget },
];

const MORE_NAV = [
  { id: "analytics", tKey: "nav.analitik",   Icon: IconChart },
  { id: "reports",   tKey: "nav.laporan",    Icon: IconReport },
  { id: "wallets",   tKey: "nav.dompet",     Icon: IconWallet },
  { id: "settings",  tKey: "nav.pengaturan", Icon: IconSettings },
];

const MORE_IDS = MORE_NAV.map(n => n.id);
const BLUE = "#3B7BF8";

export function BottomNav({ active, onNav }) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = React.useState(false);
  useScrollLock(showMore);   // kunci scroll latar saat drawer "Lainnya" terbuka
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
            {MORE_NAV.map(({ id, tKey, Icon }) => {
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
                  <span>{t(tKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="bottom-nav">
        {MAIN_NAV.map(({ id, tKey, Icon }) => {
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
              <span style={{ position: "relative", zIndex: 1 }}>{t(tKey)}</span>
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
          <span style={{ position: "relative", zIndex: 1 }}>{t('nav.lainnya')}</span>
        </button>
      </nav>
    </>
  );
}
