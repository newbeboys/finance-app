import React from 'react';
import {
  IconDashboard, IconWallet, IconTx, IconChart, IconBudget,
  IconSave, IconReport, IconSettings, IconCheck,
} from './icons';

export function Sidebar({ active, onNav, variant = "labeled" }) {
  const nav = [
    { id: "dashboard",    label: "Beranda",    Icon: IconDashboard },
    { id: "wallets",      label: "Dompet",     Icon: IconWallet },
    { id: "transactions", label: "Transaksi",  Icon: IconTx, badge: 3 },
    { id: "analytics",    label: "Analitik",   Icon: IconChart },
    { id: "budgets",      label: "Anggaran",   Icon: IconBudget },
    { id: "savings",      label: "Tabungan",   Icon: IconSave },
    { id: "reports",      label: "Laporan",    Icon: IconReport },
    { id: "settings",     label: "Pengaturan", Icon: IconSettings },
  ];

  const compact = variant === "compact";

  return (
    <aside style={{
      position: "sticky", top: 0, height: "100vh",
      width: compact ? 76 : 232,
      padding: "24px 16px 20px",
      borderRight: "1px solid var(--line-soft)",
      background: "var(--cream)",
      display: "flex", flexDirection: "column", gap: 18,
      transition: "width .25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 6px 8px" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "var(--ink)", color: "var(--cream)",
          display: "grid", placeItems: "center",
          fontFamily: "'Instrument Serif', serif", fontSize: 22, lineHeight: 1,
          fontStyle: "italic", paddingBottom: 2,
        }}>F</div>
        {!compact && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <div className="serif" style={{ fontSize: 22 }}>
              Finance<span style={{ fontStyle: "italic" }}>App</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".06em", marginTop: 4, textTransform: "uppercase" }}>
              Less spending · More living
            </div>
          </div>
        )}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
        {nav.map(({ id, label, Icon, badge }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNav(id)} title={compact ? label : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: compact ? "10px" : "10px 12px",
                justifyContent: compact ? "center" : "flex-start",
                background: isActive ? "var(--paper)" : "transparent",
                border: "1px solid " + (isActive ? "var(--line-soft)" : "transparent"),
                borderRadius: 12, color: isActive ? "var(--ink)" : "var(--ink-2)",
                fontWeight: isActive ? 500 : 400, fontSize: 13.5,
                transition: "background .15s ease, color .15s ease",
              }}
              onMouseEnter={e => !isActive && (e.currentTarget.style.background = "var(--cream-soft)")}
              onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
            >
              <Icon size={18} />
              {!compact && <span style={{ flex: 1, textAlign: "left" }}>{label}</span>}
              {!compact && badge && (
                <span style={{
                  fontSize: 10.5, color: "var(--ink)", background: "var(--cream)",
                  padding: "1px 7px", borderRadius: 999, border: "1px solid var(--line-soft)",
                }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {!compact && (
        <div className="rise" style={{
          padding: 14, borderRadius: 16,
          background: "linear-gradient(180deg, var(--paper) 0%, var(--cream-soft) 100%)",
          border: "1px solid var(--line-soft)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px", borderRadius: 999,
            background: "rgba(92,107,76,.14)", color: "var(--sage)",
            fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
            marginBottom: 8,
          }}>
            <IconCheck size={11} /> Gratis untuk semua
          </div>
          <div className="serif" style={{ fontSize: 18, lineHeight: 1.2 }}>
            Semua fitur,<br/>tanpa biaya.
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
            AI insights, scan struk, multi-wallet, ekspor data — terbuka penuh untuk setiap pengguna.
          </div>
        </div>
      )}

      {compact && (
        <div title="Semua fitur gratis" style={{
          display: "grid", placeItems: "center",
          width: 36, height: 36, margin: "0 auto",
          borderRadius: 10,
          background: "rgba(92,107,76,.14)", color: "var(--sage)",
        }}>
          <IconCheck size={16} />
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: compact ? "6px 0" : "6px 4px",
        justifyContent: compact ? "center" : "flex-start",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--sage) 0%, var(--gold) 100%)",
          color: "var(--cream)", display: "grid", placeItems: "center",
          fontSize: 12, fontWeight: 600, letterSpacing: ".04em",
        }}>AN</div>
        {!compact && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Adelia N.</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>adelia@studio.co</div>
          </div>
        )}
      </div>
    </aside>
  );
}
