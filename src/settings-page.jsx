import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { IconCheck } from './icons';
import { supabase } from './supabase';
import PinSetup from './components/PinSetup';
import { isPinActive, isBiometricEnabled, clearPin, enableBiometricOnly } from './lib/pin';
import { isBiometricAvailable } from './lib/biometric';
import RecurringTransactionPage from './pages/RecurringTransactionPage';
import { useScrollLock } from './hooks/useScrollLock';
import { usePaywall } from './components/PaywallModal';
import { isFontThemeAllowed } from './lib/planLimits';
import { UpgradeModal } from './components/subscription/UpgradeModal';
import { SubscriptionStatus } from './components/subscription/SubscriptionStatus';
import { FeatureComparison } from './components/subscription/FeatureComparison';
import { RestorePurchaseButton } from './components/subscription/RestorePurchaseButton';

// ── Halaman Pengaturan (Settings) ──────────────────────────────────
// Reads & writes the same tweak state (theme, palette, sidebar, showAI,
// notifications) so the Tweaks panel and this page stay in sync.

function Switch({ on, onClick, color = "var(--sage)" }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{
      width: 46, height: 26, borderRadius: 99, border: 0, padding: 3, flexShrink: 0,
      background: on ? color : "var(--line)",
      display: "flex", justifyContent: on ? "flex-end" : "flex-start",
      transition: "background .2s ease", cursor: "pointer",
    }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "all .2s ease" }} />
    </button>
  );
}

function SettingRow({ title, desc, children, last }) {
  return (
    <div className="setting-row" style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: last ? 0 : "1px solid var(--line-soft)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <div className="setting-widget" style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// Baris pilihan radio (metode keamanan: Tidak ada / PIN / Biometrik)
function RadioOption({ label, desc, checked, onSelect, last }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 0", borderBottom: last ? 0 : "1px solid var(--line-soft)",
        background: "transparent", border: "none", borderTop: 0, borderLeft: 0, borderRight: 0,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${checked ? "var(--sage)" : "var(--line)"}`,
        display: "grid", placeItems: "center", transition: "border-color .15s",
      }}>
        {checked && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--sage)" }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{label}</span>
        {desc && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{desc}</span>}
      </span>
    </button>
  );
}

function SettingCard({ eyebrow, title, children }) {
  return (
    <div className="card rise" style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{eyebrow}</div>
        <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em", marginTop: 2 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function ThemePreview({ mode, label, active, onClick }) {
  const isDark = mode === "dark";
  const bg = isDark ? "#1B1D15" : "#EAE5D5";
  const card = isDark ? "#24261E" : "#F5F1E4";
  const ink = isDark ? "#ECE7D4" : "#2A2C20";
  const line = isDark ? "#2E3026" : "#D8D2BE";
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 0, borderRadius: 14, overflow: "hidden", cursor: "pointer",
      border: "2px solid " + (active ? "var(--ink)" : "var(--line-soft)"),
      background: bg, textAlign: "left",
    }}>
      <div style={{ padding: 12, display: "flex", gap: 8 }}>
        <div style={{ width: 26, background: card, borderRadius: 6, border: `1px solid ${line}`, height: 56 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 12, background: card, borderRadius: 4, border: `1px solid ${line}` }} />
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            <div style={{ flex: 1, background: card, borderRadius: 6, border: `1px solid ${line}` }} />
            <div style={{ flex: 1, background: card, borderRadius: 6, border: `1px solid ${line}` }} />
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${line}`, background: card }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: ink }}>{label}</span>
        {active && <span style={{ color: "var(--sage)" }}><IconCheck size={15} /></span>}
      </div>
    </button>
  );
}

const FONT_THEME_OPTIONS = [
  { id: 'modern-tech',   name: 'Modern Tech',          sub: 'Geist',             body: "'Geist', sans-serif",              mono: "'Geist Mono', monospace",     heading: "'Instrument Serif', serif"     },
  { id: 'pro-finance',   name: 'Professional Finance', sub: 'Plus Jakarta Sans', body: "'Plus Jakarta Sans', sans-serif",   mono: "'JetBrains Mono', monospace",  heading: "'Playfair Display', serif"     },
  { id: 'elegant',       name: 'Elegant Classic',      sub: 'Raleway',           body: "'Raleway', sans-serif",             mono: "'Courier Prime', monospace",   heading: "'Merriweather', serif"         },
  { id: 'luxury',        name: 'Luxury Fintech',        sub: 'Manrope',           body: "'Manrope', sans-serif",             mono: "'Roboto Mono', monospace",     heading: "'Fraunces', serif"             },
  { id: 'soft-friendly', name: 'Soft & Friendly',       sub: 'DM Sans',           body: "'DM Sans', sans-serif",             mono: "'DM Mono', monospace",         heading: "'Cormorant Garamond', serif"  },
];

const PALETTE_SWATCHES = [
  { id: "cream", label: "Cream", hint: "Hangat", c: "#EAE5D5" },
  { id: "sand",  label: "Sand",  hint: "Tanah",  c: "#E6DECB" },
  { id: "mist",  label: "Mist",  hint: "Sejuk",  c: "#E4E7E0" },
  { id: "bone",  label: "Bone",  hint: "Netral", c: "#EFEBDF" },
];

// ── Modal Pilih Bahasa ──────────────────────────────────────────────
function LanguageModal({ onClose, onToast }) {
  const { t: tr } = useTranslation();
  const cur = i18n.language;

  const choose = (lng) => {
    if (lng === cur) { onClose(); return; }
    localStorage.setItem('bahasa', lng);
    i18n.changeLanguage(lng);
    onClose();
    onToast();
  };

  const LANGS = [
    { id: 'id', flag: '🇮🇩', label: tr('bahasa.indonesia') },
    { id: 'en', flag: '🇬🇧', label: tr('bahasa.inggris') },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}>
      <div className="card" style={{ padding: 0, maxWidth: 360, width: "100%", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid var(--line-soft)" }}>
          <div className="serif" style={{ fontSize: 20 }}>{tr('bahasa.pilih')}</div>
        </div>
        {LANGS.map((lng, i) => (
          <button key={lng.id} type="button" onClick={() => choose(lng.id)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 14,
            padding: "16px 20px", background: "transparent", border: 0,
            borderBottom: i < LANGS.length - 1 ? "1px solid var(--line-soft)" : 0,
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <span style={{ fontSize: 26 }}>{lng.flag}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{lng.label}</span>
            {cur === lng.id && <span style={{ color: "var(--sage)" }}><IconCheck size={18} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Badge "Pro" kecil di samping label fitur terkunci.
function ProTag() {
  return (
    <span style={{
      display: "inline-block", marginLeft: 8, fontSize: 9.5, fontWeight: 700,
      letterSpacing: ".06em", textTransform: "uppercase", verticalAlign: "middle",
      color: "var(--gold)", background: "color-mix(in oklch, var(--gold) 16%, transparent)",
      padding: "2px 7px", borderRadius: 99,
    }}>Pro</span>
  );
}

// Gembok kecil overlay di pojok ikon fitur terkunci.
function ProLock() {
  return (
    <span aria-hidden style={{
      position: "absolute", top: -5, right: -5,
      width: 16, height: 16, borderRadius: "50%",
      background: "var(--gold)", color: "#fff",
      display: "grid", placeItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  );
}

// Mapping dari UI plan ID ke RevenueCat package identifier.
// Nama RC package sengaja tidak mencerminkan periode — jangan ubah mapping ini.
const RC_PACKAGE_MAP = {
  monthly:  '$rc_weekly',   // Rp 30.000/bulan
  '6months': '$rc_monthly', // Rp 140.000/6 bulan
  annual:   '$rc_annual',   // Rp 270.000/tahun
};

export function SettingsPage({ t, setTweak, user, notifSubs, onToggleNotifSub, subscription, revenueCat }) {
  const { t: tr } = useTranslation();
  const { openPaywall } = usePaywall();
  const sub = subscription || {};
  const rc = revenueCat || {};
  const isPro = !!sub.isPro;
  const limits = sub.limits;
  const notifOn = t.notifications !== false;
  const subs = notifSubs ?? { budget: true, income: true, weekly: true, bills: false };
  const toggleSub = onToggleNotifSub ?? (() => {});
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [showLangModal, setShowLangModal] = React.useState(false);
  const [langToast, setLangToast] = React.useState(false);
  const [purchaseToast, setPurchaseToast] = React.useState(null); // null | { ok: boolean, msg: string }
  const [purchaseBusy, setPurchaseBusy] = React.useState(false);

  const showLangToast = () => {
    setLangToast(true);
    setTimeout(() => setLangToast(false), 2500);
  };

  // Toggle "Animasi & Suara" — preferensi terpisah di localStorage (default ON)
  const [animasiSuara, setAnimasiSuara] = React.useState(() => {
    try { return localStorage.getItem('animasiSuaraAktif') !== 'false'; } catch { return true; }
  });
  const toggleAnimasiSuara = () => {
    setAnimasiSuara(prev => {
      const next = !prev;
      try { localStorage.setItem('animasiSuaraAktif', next.toString()); } catch {}
      return next;
    });
  };

  // ── Keamanan: metode tunggal (Tidak ada / PIN / Biometrik) ──────
  // PIN & biometrik saling eksklusif — hanya satu yang boleh aktif.
  const [securityMethod, setSecurityMethod] = React.useState(
    () => (isPinActive() ? 'pin' : isBiometricEnabled() ? 'biometric' : 'none')
  );
  const [pinSetup, setPinSetup] = React.useState(null); // null | 'create' | 'change'
  const [bioNote, setBioNote] = React.useState('');
  const [confirmNone, setConfirmNone] = React.useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const [showFeatureComparison, setShowFeatureComparison] = React.useState(false);

  useScrollLock(confirmNone || !!pinSetup || showLangModal || showUpgradeModal);

  // Halaman "Transaksi Berulang" (overlay penuh)
  const [showRecurring, setShowRecurring] = React.useState(false);

  // ── Akun & Paket (Basic / Pro) ──────────────────────────────────
  const recurringEnabled = limits ? limits.recurringTransactionsEnabled : true;
  const openRecurring = () => {
    if (!recurringEnabled) { openPaywall('Transaksi berulang'); return; }
    setShowRecurring(true);
  };

  // Tombol developer (hanya import.meta.env.DEV) — ganti plan manual untuk testing.
  const [planBusy, setPlanBusy] = React.useState(false);
  const handleSetPlan = async (p) => {
    if (planBusy || !sub.setPlanForTesting) return;
    setPlanBusy(true);
    await sub.setPlanForTesting(p);
    setPlanBusy(false);
  };

  const showPurchaseToast = (ok, msg) => {
    setPurchaseToast({ ok, msg });
    setTimeout(() => setPurchaseToast(null), 3500);
  };

  const handleSelectPlan = async (planId) => {
    if (purchaseBusy) return;
    const pkgIdentifier = RC_PACKAGE_MAP[planId];
    if (!pkgIdentifier) return;

    setPurchaseBusy(true);
    try {
      const offerings = await rc.getOfferings?.();
      if (!offerings) {
        showPurchaseToast(false, 'Gagal memuat paket — coba lagi.');
        return;
      }
      const offering = offerings.all?.['default'] || offerings.current;
      if (!offering) {
        showPurchaseToast(false, 'Penawaran tidak tersedia saat ini.');
        return;
      }
      const pkg = offering.availablePackages?.find(p => p.identifier === pkgIdentifier);
      if (!pkg) {
        showPurchaseToast(false, 'Paket tidak ditemukan. Coba restart app.');
        return;
      }

      const customerInfo = await rc.purchasePackage?.(pkg);
      if (customerInfo === null) {
        // User membatalkan — ini normal, tidak perlu pesan error
        return;
      }

      setShowUpgradeModal(false);
      await sub.refresh?.();
      showPurchaseToast(true, 'Selamat! Kamu kini pengguna Pro 🎉');
    } catch (err) {
      console.error('[handleSelectPlan] purchase error:', err);
      showPurchaseToast(false, err?.message || 'Pembelian gagal. Coba lagi nanti.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleRestorePurchase = async () => {
    const customerInfo = await rc.restorePurchases?.();
    const hasPro = customerInfo?.entitlements?.active?.['pro'] !== undefined;
    if (hasPro) await sub.refresh?.();
    return { hasPro };
  };

  // Pilih metode keamanan via radio
  const selectMethod = async (m) => {
    if (m === securityMethod) return;
    setBioNote('');
    if (m === 'none') {
      setConfirmNone(true);
      return;
    }
    if (m === 'pin') {
      setPinSetup('create');
      return;
    }
    if (m === 'biometric') {
      const ok = await isBiometricAvailable();
      if (!ok) {
        setBioNote(tr('pengaturan.biometrikTidakTersedia'));
        return;
      }
      enableBiometricOnly();
      setSecurityMethod('biometric');
    }
  };

  const handlePinSetupDone = () => {
    setSecurityMethod('pin');
    setPinSetup(null);
  };

  const confirmDisableSecurity = () => {
    clearPin();
    setSecurityMethod('none');
    setConfirmNone(false);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Pengguna';

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
  }

  const curLangLabel = i18n.language === 'en' ? tr('bahasa.inggris') : tr('bahasa.indonesia');

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('pengaturan.judul')}</div>
        <h2 className="serif settings-h2" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>{tr('pengaturan.subjudul')}</h2>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          {tr('pengaturan.deskripsi')}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Akun & Paket (Basic / Pro) */}
        <SettingCard eyebrow="Langganan" title="Akun & Paket">
          <SubscriptionStatus
            isPro={isPro}
            billingCycle={sub.billingCycle}
            expiresAt={sub.expiresAt}
            onUpgrade={() => setShowUpgradeModal(true)}
            onCancel={isPro ? () => alert('Hubungi support untuk membatalkan langganan.') : undefined}
          />

          {!isPro && (
            <div style={{ marginTop: 12 }}>
              <RestorePurchaseButton onRestore={handleRestorePurchase} />
            </div>
          )}

          <div
            style={{ marginTop: 12, cursor: 'pointer', textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', textDecoration: 'underline' }}
            onClick={() => setShowFeatureComparison(v => !v)}
          >
            {showFeatureComparison ? 'Sembunyikan perbandingan fitur ▲' : 'Lihat perbandingan fitur Basic vs Pro ▼'}
          </div>

          {showFeatureComparison && (
            <div style={{ marginTop: 16 }}>
              <FeatureComparison
                defaultPlan="annual"
                onSelectPlan={(planId) => { setShowFeatureComparison(false); setShowUpgradeModal(true); }}
              />
            </div>
          )}

          {import.meta.env.DEV && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.45 }}>
                Mode developer — hanya untuk testing lokal
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleSetPlan('basic')}
                  disabled={planBusy}
                  style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 500, background: !isPro ? "var(--ivory)" : "var(--paper)", color: "var(--ink-2)", border: `1px solid ${!isPro ? "var(--ink)" : "var(--line-soft)"}`, borderRadius: 10, cursor: planBusy ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: planBusy ? 0.6 : 1 }}
                >
                  Set ke Basic (testing)
                </button>
                <button
                  onClick={() => handleSetPlan('pro')}
                  disabled={planBusy}
                  style={{ padding: "9px 14px", fontSize: 12.5, fontWeight: 500, background: isPro ? "var(--ivory)" : "var(--paper)", color: "var(--ink-2)", border: `1px solid ${isPro ? "var(--ink)" : "var(--line-soft)"}`, borderRadius: 10, cursor: planBusy ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: planBusy ? 0.6 : 1 }}
                >
                  Set ke Pro (testing)
                </button>
              </div>
            </div>
          )}
        </SettingCard>

        {/* Account */}
        <SettingCard eyebrow={tr('pengaturan.akun')} title={tr('pengaturan.profilSesi')}>
          <SettingRow title={tr('pengaturan.nama')} desc={displayName}>
            <span style={{ fontSize: 13, color: "var(--muted)" }} />
          </SettingRow>
          <SettingRow title={tr('pengaturan.email')} desc={user?.email || '—'}>
            <span style={{ fontSize: 13, color: "var(--muted)" }} />
          </SettingRow>
          <SettingRow title={tr('pengaturan.keluarAkun')} desc={tr('pengaturan.keluarDeskripsi')} last>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, background: "color-mix(in oklch, var(--terra) 12%, transparent)", color: "var(--terra)", border: "1px solid color-mix(in oklch, var(--terra) 28%, transparent)", borderRadius: 10, cursor: loggingOut ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loggingOut ? 0.6 : 1 }}
            >
              {loggingOut ? tr('pengaturan.keluar') : tr('pengaturan.logout')}
            </button>
          </SettingRow>
        </SettingCard>

        {/* Appearance */}
        <SettingCard eyebrow={tr('pengaturan.tampilan')} title={tr('pengaturan.temaWarna')}>
          <SettingRow title={tr('pengaturan.modeTampilan')} desc={tr('pengaturan.modeTampilanDesc')}>
            <div className="theme-preview-wrap" style={{ display: "flex", gap: 10, width: 240 }}>
              <ThemePreview mode="light" label={tr('pengaturan.terang')} active={t.theme !== "dark"} onClick={() => setTweak("theme", "light")} />
              <ThemePreview mode="dark"  label={tr('pengaturan.gelap')}  active={t.theme === "dark"} onClick={() => setTweak("theme", "dark")} />
            </div>
          </SettingRow>
          <SettingRow title={tr('pengaturan.warnaLatar')} desc={tr('pengaturan.warnaLatarDesc')} last>
            <div style={{ display: "flex", gap: 14, flexWrap: "nowrap" }}>
              {PALETTE_SWATCHES.map(p => {
                const active = (t.palette || "cream") === p.id;
                return (
                  <button key={p.id} onClick={() => setTweak("palette", p.id)} title={p.hint} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: 0, cursor: "pointer", padding: 0,
                  }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: p.c, border: "1px solid var(--line)", outline: active ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2, display: "block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: active ? "var(--ink)" : "var(--muted)", fontWeight: active ? 500 : 400 }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </SettingRow>
        </SettingCard>

        {/* Font Theme */}
        <SettingCard eyebrow={tr('pengaturan.tipografi')} title={tr('pengaturan.temaFont')}>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              {tr('pengaturan.temaFontDesc')}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 10 }}>
              {FONT_THEME_OPTIONS.map(ft => {
                const active = (t.fontTheme || 'modern-tech') === ft.id;
                const allowed = isFontThemeAllowed(ft.id, limits);
                const onPick = () => {
                  if (!allowed) { openPaywall('Tema font ini'); return; }
                  setTweak('fontTheme', ft.id);
                };
                return (
                  <button key={ft.id} onClick={onPick} style={{
                    padding: "14px 12px 12px",
                    background: active ? "color-mix(in oklch, var(--sage) 10%, var(--ivory))" : "var(--paper)",
                    border: `2px solid ${active ? "var(--sage)" : "var(--line-soft)"}`,
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    position: "relative",
                    opacity: allowed ? 1 : 0.72,
                    transition: "border-color .15s, background .15s",
                  }}>
                    {active && allowed && (
                      <span style={{ position: "absolute", top: 8, right: 8, color: "var(--sage)" }}>
                        <IconCheck size={14} />
                      </span>
                    )}
                    {!allowed && <ProLock />}
                    <div style={{ fontSize: 26, fontFamily: ft.heading, fontWeight: 400, color: "var(--ink)", lineHeight: 1.1 }}>Aa</div>
                    <div style={{ fontSize: 12, fontFamily: ft.mono, color: "var(--muted)", marginTop: 2 }}>Bb 1234</div>
                    <div style={{ fontSize: 11.5, fontFamily: ft.body, color: active && allowed ? "var(--sage)" : "var(--ink)", fontWeight: 600, marginTop: 10, lineHeight: 1.3, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                      {ft.name}
                      {!allowed && <ProTag />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingCard>

        {/* Language */}
        <SettingCard eyebrow={tr('pengaturan.bahasa')} title={tr('bahasa.pilih')}>
          <button
            onClick={() => setShowLangModal(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0 4px", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
          >
            <span style={{ fontSize: 20, width: 40, height: 40, borderRadius: 11, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden>
              {i18n.language === 'en' ? '🇬🇧' : '🇮🇩'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{curLangLabel}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{tr('pengaturan.bahasaDesc')}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </SettingCard>

        {/* Security — metode tunggal via radio (Tidak ada / PIN / Biometrik) */}
        <SettingCard eyebrow={tr('pengaturan.keamanan')} title={tr('pengaturan.kunciAplikasi')}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "8px 0 2px", lineHeight: 1.5 }}>
            {tr('pengaturan.pilihMetode')}
          </div>
          <RadioOption
            label={tr('pengaturan.tidakAda')}
            desc={tr('pengaturan.tidakAdaDesc')}
            checked={securityMethod === 'none'}
            onSelect={() => selectMethod('none')}
          />
          <RadioOption
            label={tr('pengaturan.pin')}
            desc={tr('pengaturan.pinDesc')}
            checked={securityMethod === 'pin'}
            onSelect={() => selectMethod('pin')}
          />
          <RadioOption
            label={tr('pengaturan.biometrik')}
            desc={bioNote || tr('pengaturan.biometrikDesc')}
            checked={securityMethod === 'biometric'}
            onSelect={() => selectMethod('biometric')}
            last
          />
          {securityMethod === 'pin' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
              <button
                onClick={() => setPinSetup('change')}
                style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--line-soft)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}
              >
                {tr('pengaturan.ubahPin')}
              </button>
            </div>
          )}
        </SettingCard>

        {/* Transaksi Berulang — navigasi ke halaman (Pro) */}
        <SettingCard eyebrow={tr('pengaturan.otomatis')} title={tr('pengaturan.jadwal')}>
          <button
            onClick={openRecurring}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0 4px", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
          >
            <span style={{ position: "relative", fontSize: 20, width: 40, height: 40, borderRadius: 11, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden>
              🔄
              {!recurringEnabled && <ProLock />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                {tr('pengaturan.transaksiBerulang')}
                {!recurringEnabled && <ProTag />}
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{tr('pengaturan.transaksiBerulangDesc')}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </SettingCard>

        {/* Notifications */}
        <SettingCard eyebrow={tr('pengaturan.notifikasi')} title={tr('pengaturan.pemberitahuan')}>
          <SettingRow title={tr('pengaturan.aktifkanNotif')} desc={tr('pengaturan.aktifkanNotifDesc')}>
            <Switch on={notifOn} onClick={() => setTweak("notifications", !notifOn)} />
          </SettingRow>
          {[
            { k: "budget", titleKey: "pengaturan.peringatanAnggaran", descKey: "pengaturan.peringatanAnggaranDesc" },
            { k: "income", titleKey: "pengaturan.transaksiMasuk",     descKey: "pengaturan.transaksiMasukDesc" },
            { k: "weekly", titleKey: "pengaturan.ringkasanMingguan",  descKey: "pengaturan.ringkasanMingguanDesc" },
            { k: "bills",  titleKey: "pengaturan.pengingatTagihan",   descKey: "pengaturan.pengingatTagihanDesc" },
          ].map(row => (
            <SettingRow key={row.k} title={tr(row.titleKey)} desc={tr(row.descKey)}>
              <div style={{ opacity: notifOn ? 1 : 0.4, pointerEvents: notifOn ? "auto" : "none" }}>
                <Switch on={subs[row.k]} onClick={() => toggleSub(row.k)} />
              </div>
            </SettingRow>
          ))}
          <SettingRow title={tr('pengaturan.animasiSuara')} desc={tr('pengaturan.animasiSuaraDesc')} last>
            <Switch on={animasiSuara} onClick={toggleAnimasiSuara} />
          </SettingRow>
        </SettingCard>

        {/* AI */}
        <SettingCard eyebrow={tr('pengaturan.kecerdasan')} title={tr('pengaturan.wawasanAi')}>
          <SettingRow title={tr('pengaturan.tampilkanWawasanAi')} desc={tr('pengaturan.tampilkanWawasanAiDesc')} last>
            {limits?.aiInsightsEnabled === false ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, background: "color-mix(in oklch, var(--gold) 18%, var(--ivory))", color: "var(--gold)", border: "1px solid color-mix(in oklch, var(--gold) 40%, transparent)", borderRadius: 99, padding: "2px 8px", fontWeight: 600, letterSpacing: ".04em" }}>Pro</span>
                <div onClick={() => openPaywall('Money IQ')} style={{ cursor: "pointer", opacity: 0.45, pointerEvents: "auto" }}>
                  <Switch on={t.showAI !== false} onClick={() => {}} color="var(--gold)" />
                </div>
              </div>
            ) : (
              <Switch on={t.showAI !== false} onClick={() => setTweak("showAI", !(t.showAI !== false))} color="var(--gold)" />
            )}
          </SettingRow>
        </SettingCard>

        <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: "6px 0", lineHeight: 1.5 }}>
          {tr('pengaturan.footer')}
        </div>
      </div>

      {pinSetup && (
        <PinSetup
          requireCurrent={pinSetup === 'change'}
          onComplete={handlePinSetupDone}
          onCancel={() => setPinSetup(null)}
        />
      )}

      {confirmNone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 24 }}>
          <div className="card" style={{ padding: 24, maxWidth: 360, width: "100%", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 20, marginBottom: 8 }}>{tr('pengaturan.nonaktifkanKeamanan')}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
              {tr('pengaturan.nonaktifkanKonfirmasi')}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmNone(false)} style={{ flex: 1, padding: "11px", fontSize: 13.5, fontWeight: 500, background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line-soft)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                {tr('umum.batal')}
              </button>
              <button onClick={confirmDisableSecurity} style={{ flex: 1, padding: "11px", fontSize: 13.5, fontWeight: 500, background: "var(--terra)", color: "#fff", border: 0, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                {tr('pengaturan.yaNonaktifkan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLangModal && (
        <LanguageModal onClose={() => setShowLangModal(false)} onToast={showLangToast} />
      )}

      {langToast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--paper)", borderRadius: 10,
          padding: "10px 20px", fontSize: 13.5, fontWeight: 500,
          zIndex: 4000, whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,.3)",
        }}>
          {tr('bahasa.berhasilDiubah')}
        </div>
      )}

      {purchaseToast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: purchaseToast.ok ? "var(--sage)" : "var(--terra)",
          color: "#fff", borderRadius: 10,
          padding: "10px 20px", fontSize: 13.5, fontWeight: 500,
          zIndex: 4000, whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,.3)",
        }}>
          {purchaseToast.msg}
        </div>
      )}

      <RecurringTransactionPage open={showRecurring} onClose={() => setShowRecurring(false)} />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => { if (!purchaseBusy) setShowUpgradeModal(false); }}
        onSelectPlan={handleSelectPlan}
        loading={purchaseBusy}
      />
    </div>
  );
}

window.SettingsPage = SettingsPage;
