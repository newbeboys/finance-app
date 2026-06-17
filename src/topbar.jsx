import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconSearch, IconBell, IconSun, IconMoon, IconPlus } from './icons';
import { AccountSwitcher } from './wallets';
import { useIsMobile } from './use-mobile';

// Pilih sapaan berdasarkan jam perangkat: pagi (<11) · siang (<18) · malam
function greetingKey(hour) {
  if (hour < 11) return 'sapaan.pagi';
  if (hour < 18) return 'sapaan.siang';
  return 'sapaan.malam';
}

export function TopBar({ theme, onTheme, onAdd, accounts, selectedAcct, onSelectAcct, onAddAcct, addAcctLocked = false, notifEnabled, user, notifications = [], unreadCount = 0, onMarkAllRead }) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = React.useState("");
  const [bell, setBell] = React.useState(false);
  const isMobile = useIsMobile();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('topbar.pengguna');

  const locale = i18n.language === 'en' ? 'en-US' : 'id-ID';
  const tanggal = new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase();

  const salam = `${t(greetingKey(new Date().getHours()))}, ${displayName}.`;

  const bellBtn = (size, style) => (
    <button onClick={() => setBell(b => !b)} aria-label={t('topbar.notifikasi')} style={{ ...style, position: "relative" }}>
      <IconBell size={size} />
      {unreadCount > 0 && notifEnabled !== false && (
        <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 999, background: "var(--terra)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1 }}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 10px", position: "relative" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>
            {tanggal}
          </div>
          <h1 className="serif" style={{ fontSize: 22, margin: "2px 0 0", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
            {salam}
          </h1>
        </div>

        {bellBtn(19, iconBtnMobile)}

        <button onClick={onTheme} aria-label={t('topbar.toggleTema')} style={iconBtnMobile}>
          {theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
        </button>

        <button onClick={onAdd} aria-label={t('topbar.tambahTransaksi')}
          style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, flexShrink: 0 }}>
          <IconPlus size={18} />
        </button>

        {bell && <Notifications onClose={() => setBell(false)} enabled={notifEnabled !== false} mobile notifications={notifications} unreadCount={unreadCount} onMarkAllRead={onMarkAllRead} />}
      </header>
    );
  }

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 32px 8px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>
          {tanggal}
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: "4px 0 0", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
          {salam}
        </h1>
      </div>

      <div style={{ position: "relative" }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={t('topbar.cariPlaceholder')}
          style={{ width: 280, padding: "10px 12px 10px 34px", background: "var(--ivory)", border: "1px solid var(--line-soft)", borderRadius: 12, color: "var(--ink)", fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
          <IconSearch size={15} />
        </span>
        <kbd style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10.5, color: "var(--muted)", border: "1px solid var(--line-soft)", padding: "1px 5px", borderRadius: 4, background: "var(--paper)", fontFamily: "'Geist Mono', monospace" }}>⌘K</kbd>
      </div>

      {accounts && (
        <AccountSwitcher accounts={accounts} selected={selectedAcct} onSelect={onSelectAcct} onAdd={onAddAcct} addLocked={addAcctLocked} />
      )}

      {bellBtn(17, iconBtn)}

      <button onClick={onTheme} aria-label={t('topbar.toggleTema')} style={iconBtn}>
        {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
      </button>

      <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13, fontWeight: 500 }}>
        <IconPlus size={15} /> {t('topbar.tambahTransaksi')}
      </button>

      {bell && <Notifications onClose={() => setBell(false)} enabled={notifEnabled !== false} notifications={notifications} unreadCount={unreadCount} onMarkAllRead={onMarkAllRead} />}
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

function Notifications({ onClose, enabled = true, mobile = false, notifications = [], unreadCount = 0, onMarkAllRead }) {
  const { t } = useTranslation();
  // Notifikasi tersimpan dengan key+params (reaktif terhadap bahasa); fallback ke
  // string literal lama (n.message/n.detail) bila objek dibuat sebelum upgrade i18n.
  const notifText = (n) => (n.msgKey ? t(n.msgKey, n.msgParams || {}) : n.message);
  const notifDetail = (n) => (n.detailKey ? t(n.detailKey, n.detailParams || {}) : n.detail);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{t('topbar.notifikasi')}</div>
          {enabled && unreadCount > 0 ? (
            <button onClick={onMarkAllRead} style={{ fontSize: 11.5, color: "var(--sage)", background: "transparent", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              {t('topbar.tandaiSemuaDibaca')}
            </button>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {!enabled ? t('topbar.nonaktif') : notifications.length > 0 ? t('topbar.semuaTerbaca') : ""}
            </div>
          )}
        </div>
        {enabled && notifications.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 380, overflowY: "auto" }}>
            {notifications.map((n) => (
              <div key={n.id} style={{
                display: "flex", gap: 10, padding: "10px 8px", borderRadius: 10, alignItems: "flex-start",
                background: n.read ? "transparent" : "color-mix(in oklch, var(--sage) 8%, transparent)",
              }}>
                <span style={{ fontSize: 15, lineHeight: 1.5, flexShrink: 0 }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>{notifText(n)}</div>
                  {notifDetail(n) && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{notifDetail(n)}</div>}
                </div>
                {!n.read && <span style={{ marginTop: 6, width: 7, height: 7, borderRadius: "50%", background: "var(--terra)", flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "22px 12px 26px", textAlign: "center" }}>
            <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line-soft)", color: "var(--muted)" }}>
              <IconBell size={17} />
            </span>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{enabled ? t('topbar.belumAdaNotif') : t('topbar.notifDimatikan')}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45, maxWidth: 220 }}>
              {enabled ? t('topbar.notifAkanMuncul') : t('topbar.aktifkanDiPengaturan')}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
