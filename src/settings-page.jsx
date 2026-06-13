import React from 'react';
import { IconCheck } from './icons';
import { supabase } from './supabase';

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
          <SettingRow title="Tampilkan wawasan AI" desc="Kartu saran cerdas di Beranda — analisis pengeluaran, tips menabung, dan prediksi. Gratis untuk semua." last>
            <Switch on={t.showAI !== false} onClick={() => setTweak("showAI", !(t.showAI !== false))} color="var(--gold)" />
          </SettingRow>
        </SettingCard>

        <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: "6px 0", lineHeight: 1.5 }}>
          FinanceApp · Semua fitur gratis untuk semua pengguna. Preferensi tersimpan di perangkat ini.
        </div>
      </div>
    </div>
  );
}

window.SettingsPage = SettingsPage;
