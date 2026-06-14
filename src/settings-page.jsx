import React from 'react';
import { IconCheck } from './icons';
import { supabase } from './supabase';
import PinSetup from './components/PinSetup';
import { isPinActive, isBiometricEnabled, clearPin, enableBiometricOnly } from './lib/pin';
import { isBiometricAvailable } from './lib/biometric';
import RecurringTransactionPage from './pages/RecurringTransactionPage';
import { useScrollLock } from './hooks/useScrollLock';

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

function ThemePreview({ mode, active, onClick }) {
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
        <span style={{ fontSize: 12.5, fontWeight: 500, color: ink }}>{isDark ? "Gelap" : "Terang"}</span>
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

export function SettingsPage({ t, setTweak, user, notifSubs, onToggleNotifSub }) {
  const notifOn = t.notifications !== false;
  const subs = notifSubs ?? { budget: true, income: true, weekly: true, bills: false };
  const toggleSub = onToggleNotifSub ?? (() => {});
  const [loggingOut, setLoggingOut] = React.useState(false);

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
  useScrollLock(confirmNone || !!pinSetup);   // kunci scroll latar saat dialog konfirmasi / setup PIN terbuka

  // Halaman "Transaksi Berulang" (overlay penuh)
  const [showRecurring, setShowRecurring] = React.useState(false);

  // Pilih metode keamanan via radio
  const selectMethod = async (m) => {
    if (m === securityMethod) return;
    setBioNote('');
    if (m === 'none') {
      setConfirmNone(true);             // konfirmasi dulu sebelum mematikan
      return;
    }
    if (m === 'pin') {
      setPinSetup('create');            // buka flow buat PIN; tercentang setelah selesai
      return;
    }
    if (m === 'biometric') {
      const ok = await isBiometricAvailable();
      if (!ok) {
        setBioNote('Biometrik tidak tersedia di perangkat ini (hanya berfungsi di APK Android).');
        return;
      }
      enableBiometricOnly();            // aktifkan biometrik + hapus PIN
      setSecurityMethod('biometric');
    }
  };

  const handlePinSetupDone = () => {
    setSecurityMethod('pin'); // setPin() sudah menyimpan pinAktif & mematikan biometrik
    setPinSetup(null);
  };

  const confirmDisableSecurity = () => {
    clearPin();               // hapus PIN + matikan biometrik
    setSecurityMethod('none');
    setConfirmNone(false);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Pengguna';

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
  }

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Pengaturan</div>
        <h2 className="serif settings-h2" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Sesuaikan FinanceApp</h2>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          Atur tampilan, warna latar, layout, notifikasi, dan wawasan AI. Perubahan langsung diterapkan.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Account */}
        <SettingCard eyebrow="Akun" title="Profil & sesi">
          <SettingRow title="Nama" desc={displayName}>
            <span style={{ fontSize: 13, color: "var(--muted)" }} />
          </SettingRow>
          <SettingRow title="Email" desc={user?.email || '—'}>
            <span style={{ fontSize: 13, color: "var(--muted)" }} />
          </SettingRow>
          <SettingRow title="Keluar dari akun" desc="Kamu akan diarahkan ke halaman login." last>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, background: "color-mix(in oklch, var(--terra) 12%, transparent)", color: "var(--terra)", border: "1px solid color-mix(in oklch, var(--terra) 28%, transparent)", borderRadius: 10, cursor: loggingOut ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loggingOut ? 0.6 : 1 }}
            >
              {loggingOut ? "Keluar…" : "Logout"}
            </button>
          </SettingRow>
        </SettingCard>

        {/* Appearance */}
        <SettingCard eyebrow="Tampilan" title="Tema & warna">
          <SettingRow title="Mode tampilan" desc="Pilih tema terang atau gelap untuk seluruh aplikasi.">
            <div className="theme-preview-wrap" style={{ display: "flex", gap: 10, width: 240 }}>
              <ThemePreview mode="light" active={t.theme !== "dark"} onClick={() => setTweak("theme", "light")} />
              <ThemePreview mode="dark"  active={t.theme === "dark"} onClick={() => setTweak("theme", "dark")} />
            </div>
          </SettingRow>
          <SettingRow title="Warna latar" desc="Nuansa kanvas aplikasi. Hanya berlaku pada mode terang." last>
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
        <SettingCard eyebrow="Tipografi" title="Tema font">
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Pilih gaya tipografi. Hanya font-family yang berubah — ukuran dan layout tetap sama.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 10 }}>
              {FONT_THEME_OPTIONS.map(ft => {
                const active = (t.fontTheme || 'modern-tech') === ft.id;
                return (
                  <button key={ft.id} onClick={() => setTweak('fontTheme', ft.id)} style={{
                    padding: "14px 12px 12px",
                    background: active ? "color-mix(in oklch, var(--sage) 10%, var(--ivory))" : "var(--paper)",
                    border: `2px solid ${active ? "var(--sage)" : "var(--line-soft)"}`,
                    borderRadius: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    position: "relative",
                    transition: "border-color .15s, background .15s",
                  }}>
                    {active && (
                      <span style={{ position: "absolute", top: 8, right: 8, color: "var(--sage)" }}>
                        <IconCheck size={14} />
                      </span>
                    )}
                    <div style={{ fontSize: 26, fontFamily: ft.heading, fontWeight: 400, color: "var(--ink)", lineHeight: 1.1 }}>Aa</div>
                    <div style={{ fontSize: 12, fontFamily: ft.mono, color: "var(--muted)", marginTop: 2 }}>Bb 1234</div>
                    <div style={{ fontSize: 11.5, fontFamily: ft.body, color: active ? "var(--sage)" : "var(--ink)", fontWeight: 600, marginTop: 10, lineHeight: 1.3 }}>
                      {ft.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingCard>

        {/* Layout */}
        <SettingCard eyebrow="Layout" title="Tata letak">
          <SettingRow title="Gaya sidebar" desc="Tampilkan label penuh atau versi ringkas yang hanya ikon." last>
            <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              {[{ id: "labeled", label: "Berlabel" }, { id: "compact", label: "Ringkas" }].map(o => (
                <button key={o.id} onClick={() => setTweak("sidebarVariant", o.id)} style={{
                  padding: "10px 20px", fontSize: 13,
                  background: (t.sidebarVariant || "labeled") === o.id ? "var(--ivory)" : "transparent",
                  border: (t.sidebarVariant || "labeled") === o.id ? "1px solid var(--line-soft)" : "1px solid transparent",
                  borderRadius: 8, color: (t.sidebarVariant || "labeled") === o.id ? "var(--ink)" : "var(--muted)",
                  fontWeight: (t.sidebarVariant || "labeled") === o.id ? 500 : 400,
                }}>{o.label}</button>
              ))}
            </div>
          </SettingRow>
        </SettingCard>

        {/* Security — metode tunggal via radio (Tidak ada / PIN / Biometrik) */}
        <SettingCard eyebrow="Keamanan" title="Kunci aplikasi">
          <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "8px 0 2px", lineHeight: 1.5 }}>
            Pilih metode keamanan aplikasi. Hanya satu yang dapat aktif.
          </div>
          <RadioOption
            label="Tidak ada"
            desc="Aplikasi terbuka tanpa kunci."
            checked={securityMethod === 'none'}
            onSelect={() => selectMethod('none')}
          />
          <RadioOption
            label="PIN (6 digit)"
            desc="Buka aplikasi dengan PIN 6 digit."
            checked={securityMethod === 'pin'}
            onSelect={() => selectMethod('pin')}
          />
          <RadioOption
            label="Biometrik (Sidik Jari)"
            desc={bioNote || "Buka aplikasi dengan sidik jari."}
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
                Ubah PIN
              </button>
            </div>
          )}
        </SettingCard>

        {/* Transaksi Berulang — navigasi ke halaman */}
        <SettingCard eyebrow="Otomatis" title="Jadwal">
          <button
            onClick={() => setShowRecurring(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0 4px", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
          >
            <span style={{ fontSize: 20, width: 40, height: 40, borderRadius: 11, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden>🔄</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>Transaksi Berulang</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>Jadwalkan pemasukan & pengeluaran agar tercatat otomatis.</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </SettingCard>

        {/* Notifications */}
        <SettingCard eyebrow="Notifikasi" title="Pemberitahuan">
          <SettingRow title="Aktifkan notifikasi" desc="Master switch untuk semua pemberitahuan FinanceApp.">
            <Switch on={notifOn} onClick={() => setTweak("notifications", !notifOn)} />
          </SettingRow>
          {[
            { k: "budget", title: "Peringatan anggaran", desc: "Saat sebuah kategori mencapai 80% atau melebihi batas." },
            { k: "income", title: "Transaksi masuk", desc: "Beri tahu setiap kali ada dana masuk." },
            { k: "weekly", title: "Ringkasan mingguan", desc: "Rangkuman pengeluaran tiap Senin pagi." },
            { k: "bills",  title: "Pengingat tagihan", desc: "Ingatkan tagihan berulang sebelum jatuh tempo." },
          ].map(row => (
            <SettingRow key={row.k} title={row.title} desc={row.desc} last={row.last}>
              <div style={{ opacity: notifOn ? 1 : 0.4, pointerEvents: notifOn ? "auto" : "none" }}>
                <Switch on={subs[row.k]} onClick={() => toggleSub(row.k)} />
              </div>
            </SettingRow>
          ))}
          <SettingRow title="Animasi & Suara" desc="Aktifkan efek suara dan animasi pada aplikasi" last>
            <Switch on={animasiSuara} onClick={toggleAnimasiSuara} />
          </SettingRow>
        </SettingCard>

        {/* AI */}
        <SettingCard eyebrow="Kecerdasan" title="Wawasan AI">
          <SettingRow title="Tampilkan wawasan AI" desc="Kartu saran cerdas di Beranda — analisis pengeluaran, tips menabung, dan prediksi." last>
            <Switch on={t.showAI !== false} onClick={() => setTweak("showAI", !(t.showAI !== false))} color="var(--gold)" />
          </SettingRow>
        </SettingCard>

        <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: "6px 0", lineHeight: 1.5 }}>
          FinanceApp · Preferensi tersimpan di perangkat ini.
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
            <div className="serif" style={{ fontSize: 20, marginBottom: 8 }}>Nonaktifkan keamanan?</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
              Yakin ingin menonaktifkan keamanan? PIN akan dihapus dan biometrik dimatikan.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmNone(false)} style={{ flex: 1, padding: "11px", fontSize: 13.5, fontWeight: 500, background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line-soft)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                Batal
              </button>
              <button onClick={confirmDisableSecurity} style={{ flex: 1, padding: "11px", fontSize: 13.5, fontWeight: 500, background: "var(--terra)", color: "#fff", border: 0, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
                Ya, nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      <RecurringTransactionPage open={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  );
}

window.SettingsPage = SettingsPage;
