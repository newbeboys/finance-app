import React from 'react';
import { IconSearch, IconBell, IconSun, IconMoon, IconPlus } from './icons';
import { AccountSwitcher } from './wallets';
import { useIsMobile } from './use-mobile';

export function TopBar({ theme, onTheme, onAdd, accounts, selectedAcct, onSelectAcct, onAddAcct, notifEnabled }) {
  const [q, setQ] = React.useState("");
  const [bell, setBell] = React.useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 10px", position: "relative" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>
            Rabu, 27 Mei
          </div>
          <h1 className="serif" style={{ fontSize: 22, margin: "2px 0 0", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
            Selamat pagi, Adelia.
          </h1>
        </div>

        <button onClick={() => setBell(b => !b)} aria-label="Notifications" style={{ ...iconBtnMobile }}>
          <IconBell size={19} />
          {notifEnabled !== false && (
            <span style={{ position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: "50%", background: "var(--terra)", boxShadow: "0 0 0 2px var(--cream)" }} />
          )}
        </button>

        <button onClick={onTheme} aria-label="Toggle tema" style={iconBtnMobile}>
          {theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
        </button>

        <button onClick={onAdd} aria-label="Tambah transaksi"
          style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, flexShrink: 0 }}>
          <IconPlus size={18} />
        </button>

        {bell && <Notifications onClose={() => setBell(false)} enabled={notifEnabled !== false} mobile />}
      </header>
    );
  }

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 32px 8px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>
          Rabu, 27 Mei
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: "4px 0 0", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
          Selamat pagi, Adelia.
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}> Ini ringkasan keuanganmu.</span>
        </h1>
      </div>

      <div style={{ position: "relative" }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cari transaksi, kategori…"
          style={{ width: 280, padding: "10px 12px 10px 34px", background: "var(--ivory)", border: "1px solid var(--line-soft)", borderRadius: 12, color: "var(--ink)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
          <IconSearch size={15} />
        </span>
        <kbd style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10.5, color: "var(--muted)", border: "1px solid var(--line-soft)", padding: "1px 5px", borderRadius: 4, background: "var(--paper)", fontFamily: "'Geist Mono', monospace" }}>⌘K</kbd>
      </div>

      {accounts && (
        <AccountSwitcher accounts={accounts} selected={selectedAcct} onSelect={onSelectAcct} onAdd={onAddAcct} />
      )}

      <button onClick={() => setBell(b => !b)} aria-label="Notifications" style={iconBtn}>
        <IconBell size={17} />
        {notifEnabled !== false && (
          <span style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--terra)", boxShadow: "0 0 0 2px var(--cream)" }} />
        )}
      </button>

      <button onClick={onTheme} aria-label="Theme" style={iconBtn}>
        {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
      </button>

      <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13, fontWeight: 500 }}>
        <IconPlus size={15} /> Tambah transaksi
      </button>

      {bell && <Notifications onClose={() => setBell(false)} enabled={notifEnabled !== false} />}
    </header>
  );
}

const iconBtn = {
  position: "relative",
  width: 38, height: 38, display: "grid", placeItems: "center",
  background: "var(--ivory)", border: "1px solid var(--line-soft)",
  borderRadius: 12, color: "var(--ink)",
};

const iconBtnMobile = {
  position: "relative",
  width: 44, height: 44, display: "grid", placeItems: "center",
  background: "var(--ivory)", border: "1px solid var(--line-soft)",
  borderRadius: 12, color: "var(--ink)", flexShrink: 0,
};

function Notifications({ onClose, enabled = true, mobile = false }) {
  const items = [
    { tone: "warn", text: "Anggaran belanja terlampaui Rp 540.000.", time: "2j" },
    { tone: "good", text: "Gaji diterima — Rp 22.800.000.",          time: "5h" },
    { tone: "info", text: "Wawasan AI baru untuk goal Kyoto.",       time: "1mg" },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
      <div className="card rise" style={{
        position: mobile ? "fixed" : "absolute",
        top: mobile ? undefined : 76,
        bottom: mobile ? 70 : undefined,
        right: mobile ? 12 : 188,
        left: mobile ? 12 : undefined,
        width: mobile ? undefined : 320,
        zIndex: 31, padding: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 6px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Notifikasi</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{enabled ? "3 baru" : "Nonaktif"}</div>
        </div>
        {enabled ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 8px", borderRadius: 10, alignItems: "flex-start" }}>
                <span style={{ marginTop: 6, width: 7, height: 7, borderRadius: "50%", background: n.tone === "warn" ? "var(--terra)" : n.tone === "good" ? "var(--sage)" : "var(--gold)", flexShrink: 0 }} />
                <div style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>{n.text}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", flexShrink: 0 }}>{n.time}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "22px 12px 26px", textAlign: "center" }}>
            <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line-soft)", color: "var(--muted)" }}>
              <IconBell size={17} />
            </span>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Notifikasi dimatikan</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, maxWidth: 220 }}>
              Aktifkan notifikasi di Pengaturan untuk menerima pemberitahuan.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
