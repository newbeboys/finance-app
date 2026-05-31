import React from 'react';
import { IconCheck } from './icons';

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
    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: last ? 0 : "1px solid var(--line-soft)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
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

const PALETTE_SWATCHES = [
  { id: "cream", label: "Cream", hint: "Hangat", c: "#EAE5D5" },
  { id: "sand",  label: "Sand",  hint: "Tanah",  c: "#E6DECB" },
  { id: "mist",  label: "Mist",  hint: "Sejuk",  c: "#E4E7E0" },
  { id: "bone",  label: "Bone",  hint: "Netral", c: "#EFEBDF" },
];

export function SettingsPage({ t, setTweak }) {
  const notifOn = t.notifications !== false;
  // sub-preferences kept locally for realism
  const [subs, setSubs] = React.useState({ budget: true, income: true, weekly: true, bills: false });
  const toggleSub = (k) => setSubs(s => ({ ...s, [k]: !s[k] }));

  return (
    <div style={{ padding: "16px 32px 48px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Pengaturan</div>
        <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>Sesuaikan FinanceApp</h2>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          Atur tampilan, warna latar, layout, notifikasi, dan wawasan AI. Perubahan langsung diterapkan.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Appearance */}
        <SettingCard eyebrow="Tampilan" title="Tema & warna">
          <SettingRow title="Mode tampilan" desc="Pilih tema terang atau gelap untuk seluruh aplikasi.">
            <div style={{ display: "flex", gap: 10, width: 240 }}>
              <ThemePreview mode="light" active={t.theme !== "dark"} onClick={() => setTweak("theme", "light")} />
              <ThemePreview mode="dark"  active={t.theme === "dark"} onClick={() => setTweak("theme", "dark")} />
            </div>
          </SettingRow>
          <SettingRow title="Warna latar" desc="Nuansa kanvas aplikasi. Hanya berlaku pada mode terang." last>
            <div style={{ display: "flex", gap: 10 }}>
              {PALETTE_SWATCHES.map(p => {
                const active = (t.palette || "cream") === p.id;
                return (
                  <button key={p.id} onClick={() => setTweak("palette", p.id)} title={p.hint} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: 0, cursor: "pointer",
                  }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: p.c, border: "1px solid var(--line)", outline: active ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2 }} />
                    <span style={{ fontSize: 10.5, color: active ? "var(--ink)" : "var(--muted)", fontWeight: active ? 500 : 400 }}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </SettingRow>
        </SettingCard>

        {/* Layout */}
        <SettingCard eyebrow="Layout" title="Tata letak">
          <SettingRow title="Gaya sidebar" desc="Tampilkan label penuh atau versi ringkas yang hanya ikon." last>
            <div style={{ display: "flex", padding: 3, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              {[{ id: "labeled", label: "Berlabel" }, { id: "compact", label: "Ringkas" }].map(o => (
                <button key={o.id} onClick={() => setTweak("sidebarVariant", o.id)} style={{
                  padding: "8px 16px", fontSize: 12.5,
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
            { k: "bills",  title: "Pengingat tagihan", desc: "Ingatkan tagihan berulang sebelum jatuh tempo.", last: true },
          ].map(row => (
            <SettingRow key={row.k} title={row.title} desc={row.desc} last={row.last}>
              <div style={{ opacity: notifOn ? 1 : 0.4, pointerEvents: notifOn ? "auto" : "none" }}>
                <Switch on={subs[row.k]} onClick={() => toggleSub(row.k)} />
              </div>
            </SettingRow>
          ))}
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
