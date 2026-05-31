import React from 'react';
import { ACCOUNT_TYPES, fmtShort, fmt } from './data';
import { IconBudget, IconPlus, IconChev, IconClose } from './icons';

const WALLET_GLYPH = {
  bank:       <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
  ewallet:    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M16 12h.01" /><path d="M21 9h-5a3 3 0 0 0 0 6h5" /></>,
  cash:       <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  investment: <><path d="M4 17l5-6 4 3 7-9" /><path d="M14 5h6v6" /></>,
};

export function WalletGlyph({ type, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {WALLET_GLYPH[type] || WALLET_GLYPH.bank}
    </svg>
  );
}

const typeLabel = (id) => (ACCOUNT_TYPES.find(t => t.id === id) || {}).label || id;

export function AccountSwitcher({ accounts, selected, onSelect, onAdd }) {
  const [open, setOpen] = React.useState(false);
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const current = selected === "all" ? null : accounts.find(a => a.id === selected);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "7px 12px", background: "var(--ivory)",
        border: "1px solid var(--line-soft)", borderRadius: 12,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: current ? `color-mix(in oklch, ${current.color} 18%, var(--ivory))` : "var(--paper)",
          color: current ? current.color : "var(--ink)",
          display: "grid", placeItems: "center",
        }}>
          {current ? <WalletGlyph type={current.type} size={14} /> : <IconBudget size={14} />}
        </span>
        <span style={{ textAlign: "left", lineHeight: 1.15 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>
            {current ? current.name : "Semua akun"}
          </span>
          <span className="tnum" style={{ display: "block", fontSize: 10.5, color: "var(--muted)" }}>
            {fmtShort(current ? current.balance : total)}
          </span>
        </span>
        <IconChev size={14} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div className="card rise" style={{ position: "absolute", top: 50, right: 0, width: 300, zIndex: 31, padding: 8 }}>
            <button onClick={() => { onSelect("all"); setOpen(false); }} style={switcherRow(selected === "all")}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink)" }}>
                <IconBudget size={15} />
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>Semua akun</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{accounts.length} dompet gabungan</span>
              </span>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmtShort(total)}</span>
            </button>
            <div style={{ height: 1, background: "var(--line-soft)", margin: "6px 4px" }} />
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {accounts.map(a => (
                <button key={a.id} onClick={() => { onSelect(a.id); setOpen(false); }} style={switcherRow(selected === a.id)}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in oklch, ${a.color} 18%, var(--ivory))`, color: a.color, display: "grid", placeItems: "center" }}>
                    <WalletGlyph type={a.type} size={15} />
                  </span>
                  <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{typeLabel(a.type)}{a.last4 !== "—" ? ` •• ${a.last4}` : ""}</span>
                  </span>
                  <span className="tnum" style={{ fontSize: 12.5 }}>{fmtShort(a.balance)}</span>
                </button>
              ))}
            </div>
            <div style={{ height: 1, background: "var(--line-soft)", margin: "6px 4px" }} />
            <button onClick={() => { setOpen(false); onAdd(); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 10px", borderRadius: 10, border: 0, background: "transparent",
              color: "var(--ink)", fontSize: 13, fontWeight: 500,
            }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--ink)", color: "var(--cream)", display: "grid", placeItems: "center" }}>
                <IconPlus size={15} />
              </span>
              Tambah akun
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const switcherRow = (active) => ({
  width: "100%", display: "flex", alignItems: "center", gap: 10,
  padding: "9px 10px", borderRadius: 10, border: 0,
  background: active ? "var(--paper)" : "transparent", cursor: "pointer",
});

export function WalletsPage({ accounts, onAdd, onSetPrimary, onDelete }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const byType = ACCOUNT_TYPES.map(t => ({
    ...t, sum: accounts.filter(a => a.type === t.id).reduce((s, a) => s + a.balance, 0),
    count: accounts.filter(a => a.type === t.id).length,
  })).filter(t => t.count > 0);

  return (
    <div style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>
            Dompet · {accounts.length} akun
          </div>
          <h2 className="serif" style={{ fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
            Semua akunmu, satu tempat
          </h2>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
            Catat saldo rekening bank, e-wallet, tunai, atau investasi. Tambahkan akun sebanyak yang kamu mau dan lacak semuanya di satu tempat.
          </div>
        </div>
        <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500 }}>
          <IconPlus size={15} /> Tambah akun
        </button>
      </div>

      <div className="card rise" style={{ padding: 24, marginBottom: 20, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Total kekayaan bersih</div>
          <div className="serif tnum" style={{ fontSize: 40, letterSpacing: "-0.02em", marginTop: 6 }}>{fmtShort(total)}</div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {byType.map(t => (
            <div key={t.id} style={{ padding: "10px 14px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.label} · {t.count}</div>
              <div className="tnum" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{fmtShort(t.sum)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {accounts.map((a, i) => (
          <div key={a.id} className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${i * 0.04}s`, display: "flex", flexDirection: "column" }}>
            <div style={{ height: 6, background: a.color }} />
            <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in oklch, ${a.color} 16%, var(--ivory))`, color: a.color, display: "grid", placeItems: "center" }}>
                  <WalletGlyph type={a.type} size={19} />
                </span>
                {a.primary
                  ? <span style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sage)", background: "rgba(92,107,76,.14)", padding: "3px 8px", borderRadius: 999, fontWeight: 500 }}>Utama</span>
                  : <button onClick={() => onSetPrimary(a.id)} title="Jadikan utama" style={{ fontSize: 11, color: "var(--muted)", background: "transparent", border: "1px solid var(--line-soft)", borderRadius: 999, padding: "3px 9px" }}>Set utama</button>}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  <span>{a.institution}{a.last4 !== "—" ? ` ·· ${a.last4}` : ""}</span>
                </div>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 18 }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Saldo</div>
                <div className="serif tnum" style={{ fontSize: 26, letterSpacing: "-0.01em", marginTop: 2 }}>{fmt(a.balance)}</div>
              </div>
            </div>
            <div className="hairline" style={{ display: "flex" }}>
              <button style={cardFootBtn}>Transaksi</button>
              <div style={{ width: 1, background: "var(--line-soft)" }} />
              <button style={cardFootBtn}>Transfer</button>
              {!a.primary && accounts.length > 1 && (
                <>
                  <div style={{ width: 1, background: "var(--line-soft)" }} />
                  <button onClick={() => onDelete(a.id)} style={{ ...cardFootBtn, color: "var(--terra)", flex: "0 0 46px" }} title="Hapus akun">
                    <IconClose size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        <button onClick={onAdd} className="rise" style={{ border: "1.5px dashed var(--line)", borderRadius: "var(--r-lg)", background: "transparent", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 220, cursor: "pointer" }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--sage)" }}>
            <IconPlus size={22} />
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>Tambah akun baru</span>
          <span style={{ fontSize: 12, maxWidth: 190, textAlign: "center", lineHeight: 1.4 }}>Rekening bank, e-wallet, tunai, atau investasi</span>
        </button>
      </div>
    </div>
  );
}

const cardFootBtn = { flex: 1, padding: "11px 0", background: "transparent", border: 0, fontSize: 12.5, color: "var(--ink-2)", display: "grid", placeItems: "center" };

const ACCOUNT_COLORS = ["#2A6FDB", "#1FA8A0", "#1B8A3F", "#9A6BD9", "#B26A4A", "#B68A3E", "#8C7B5C", "#C9886D"];

export function AddAccountModal({ open, onClose, onCreate }) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("bank");
  const [institution, setInstitution] = React.useState("");
  const [last4, setLast4] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [color, setColor] = React.useState(ACCOUNT_COLORS[0]);

  React.useEffect(() => {
    if (open) { setName(""); setType("bank"); setInstitution(""); setLast4(""); setBalance(""); setColor(ACCOUNT_COLORS[0]); }
  }, [open]);

  if (!open) return null;

  const valid = name.trim().length > 0;
  const submit = () => {
    if (!valid) return;
    onCreate({
      id: "a" + Date.now(),
      name: name.trim(),
      type,
      institution: institution.trim() || typeLabel(type),
      last4: last4.trim() || "—",
      balance: +String(balance).replace(/\D/g, "") || 0,
      color,
      primary: false,
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20, animation: "rise .25s ease-out" }}>
      <div className="card" onClick={e => e.stopPropagation()} style={{ width: 500, padding: 28, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Dompet baru</div>
            <div className="serif" style={{ fontSize: 28, marginTop: 4, letterSpacing: "-0.01em" }}>Tambah akun</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <span style={fieldLabel}>Jenis akun</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {ACCOUNT_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 6px", borderRadius: 12, background: type === t.id ? "var(--ivory)" : "var(--paper)", border: "1px solid " + (type === t.id ? "var(--ink)" : "var(--line-soft)"), color: "var(--ink)" }}>
                <WalletGlyph type={t.id} size={18} />
                <span style={{ fontSize: 11, textAlign: "center", lineHeight: 1.2 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <label style={{ gridColumn: "span 2" }}>
            <span style={fieldLabel}>Nama akun</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="contoh: BCA Tabungan" style={modalInput} />
          </label>
          <label>
            <span style={fieldLabel}>Bank / penyedia</span>
            <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="contoh: Bank Central Asia" style={modalInput} />
          </label>
          <label>
            <span style={fieldLabel}>4 digit terakhir (opsional)</span>
            <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4421" style={modalInput} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <span style={fieldLabel}>Saldo awal</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Rp</span>
              <input value={balance ? (+String(balance).replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={e => setBalance(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                style={{ ...modalInput, border: 0, background: "transparent", padding: "10px 0", fontVariantNumeric: "tabular-nums" }} />
            </div>
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={fieldLabel}>Warna</span>
          <div style={{ display: "flex", gap: 8 }}>
            {ACCOUNT_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: 0, outline: color === c ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2, cursor: "pointer" }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>Batal</button>
          <button onClick={submit} disabled={!valid} style={{ flex: 2, padding: "11px", background: valid ? "var(--ink)" : "var(--line)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: valid ? "pointer" : "default" }}>Buat akun</button>
        </div>
      </div>
    </div>
  );
}

const fieldLabel = { display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 };
const modalInput = { width: "100%", padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 13, fontFamily: "inherit", outline: "none" };
