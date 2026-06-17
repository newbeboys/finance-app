import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtShort, formatNominal, nominalFontSize } from './data';
import { IconPlus, IconClose } from './icons';
import { Ring } from './charts';
import { useIsMobile } from './use-mobile';
import { useScrollLock } from './hooks/useScrollLock';
import { usePaywall } from './components/PaywallModal';

const GOAL_ICONS = {
  emergency: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  travel:    <><path d="M3 16l7-2 4-9 2 1-2 8 5-1 1 2-8 3-1 4-2-1 1-3-5 1z" /></>,
  home:      <><path d="M3 11l9-7 9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></>,
  vehicle:   <><rect x="3" y="11" width="18" height="6" rx="2" /><path d="M5 11l2-5h10l2 5" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="16.5" cy="18.5" r="1.5" /></>,
  education: <><path d="m3 9 9-4 9 4-9 4z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>,
  gadget:    <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M11 18h2" /></>,
  gift:      <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 13h16M12 9v11" /><path d="M12 9S9 3 6.5 5 9 9 12 9zm0 0s3-6 5.5-4S15 9 12 9z" /></>,
  health:    <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></>,
  ring:      <><circle cx="12" cy="14" r="6" /><path d="m9 8 1.5-3h3L15 8" /></>,
  star:      <><path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16.8 6.4 20l1.6-6.3-5-4.2L9.5 9z" /></>,
};

const GOAL_ICON_LIST = [
  { id: "emergency" }, { id: "travel" },
  { id: "home" }, { id: "vehicle" },
  { id: "education" }, { id: "gadget" },
  { id: "gift" }, { id: "health" },
  { id: "ring" }, { id: "star" },
];

function GoalGlyph({ icon, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {GOAL_ICONS[icon] || GOAL_ICONS.star}
    </svg>
  );
}

const GOAL_COLORS = ["#5C6B4C", "#B68A3E", "#C9886D", "#2A6FDB", "#1FA8A0", "#9A6BD9", "#B26A4A", "#7A8A6E"];

export function SavingsPage({ goals, onAdd, onDeposit, onDelete }) {
  const { t: tr } = useTranslation();
  const isMobile = useIsMobile();
  const { openPaywall } = usePaywall();
  const totalSaved = goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const completed = goals.filter(g => g.current >= g.target).length;

  return (
    <div className="page-wrap" style={{ padding: "16px 32px 48px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('tabungan.goalCount', { count: goals.length })}</div>
          <h2 className="serif" style={{ fontSize: isMobile ? 26 : 34, margin: "4px 0 0", letterSpacing: "-0.015em" }}>{tr('tabungan.judulHalaman')}</h2>
          {!isMobile && (
            <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 540, lineHeight: 1.5 }}>
              {tr('tabungan.deskripsiHalaman')}
            </div>
          )}
        </div>
        <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500 }}>
          <IconPlus size={15} /> {tr('tabungan.buatGoalBaru')}
        </button>
      </div>

      <div className="card rise" style={{ padding: isMobile ? 18 : 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: isMobile ? 16 : 28, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "0 0 auto" }}>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('tabungan.totalTerkumpul')}</div>
            <div className="serif tnum kpi-nominal" style={{ fontSize: nominalFontSize(totalSaved, { hero: true, mobile: isMobile }), letterSpacing: "-0.02em", marginTop: 4 }}>{formatNominal(totalSaved)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tr('tabungan.dariTarget', { jumlah: formatNominal(totalTarget) })}</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr('tabungan.goalTercapaiCount', { count: completed })}</div>
        </div>
        <div style={{ height: 8, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${totalTarget ? Math.min(totalSaved / totalTarget, 1) * 100 : 0}%`, background: "var(--sage)", borderRadius: 99, transition: "width .5s ease" }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
          {tr('tabungan.dariSemuaTarget', { persen: totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0 })}
        </div>
      </div>

      <div className="goals-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {goals.map((g, i) => {
          const pct = Math.min(g.current / g.target, 1);
          const done = g.current >= g.target;
          const remaining = Math.max(g.target - g.current, 0);
          return (
            <div key={g.id} className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${i * 0.04}s`, display: "flex", flexDirection: "column", opacity: g.is_locked ? 0.6 : 1, position: "relative" }}>
              {g.is_locked && (
                <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: "rgba(42,44,32,.72)", color: "#fff", borderRadius: 99, fontSize: 10.5, fontWeight: 600, padding: "2px 9px", letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 4 }}>
                  🔒 {tr('tabungan.terkunci', { defaultValue: 'Terkunci' })}
                </div>
              )}
              <div style={{ height: 6, background: g.color }} />
              <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                    <Ring pct={pct} size={56} stroke={5} color={g.color} />
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: g.color }}>
                      <span style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)" }}><GoalGlyph icon={g.icon} size={15} /></span>
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {done ? tr('tabungan.tercapaiEmoji') : tr('tabungan.tenggat', { tanggal: g.deadline })}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <div className="tnum" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    <span className="serif" style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em" }}>{fmtShort(g.current)}</span>
                    {" "}/ {fmtShort(g.target)}
                  </div>
                  <div style={{ marginTop: 8, height: 6, background: "var(--line-soft)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: g.color, borderRadius: 99, transition: "width .4s ease" }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 7 }}>
                    {done ? tr('tabungan.tercapaiPenuh') : tr('tabungan.kurang', { jumlah: fmtShort(remaining) })}
                  </div>
                </div>
              </div>
              <div className="hairline" style={{ display: "flex" }}>
                <button
                  onClick={() => g.is_locked ? openPaywall('Tabungan') : onDeposit(g)}
                  style={{ flex: 1, padding: "12px 0", background: "transparent", border: 0, fontSize: 12.5, fontWeight: 500, color: g.is_locked ? "var(--muted)" : "var(--ink)", display: "inline-flex", gap: 7, alignItems: "center", justifyContent: "center", cursor: g.is_locked ? "not-allowed" : "pointer" }}>
                  <IconPlus size={14} /> {tr('tabungan.tambahDana')}
                  {g.is_locked && <span style={{ fontSize: 11 }}>🔒</span>}
                </button>
                <div style={{ width: 1, background: "var(--line-soft)" }} />
                <button onClick={() => onDelete(g.id)} title={tr('tabungan.hapusGoal')} style={{ flex: "0 0 50px", padding: "12px 0", background: "transparent", border: 0, color: "var(--terra)", display: "grid", placeItems: "center" }}>
                  <IconClose size={14} />
                </button>
              </div>
            </div>
          );
        })}

        <button onClick={onAdd} className="rise" style={{ border: "1.5px dashed var(--line)", borderRadius: "var(--r-lg)", background: "transparent", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 220, cursor: "pointer" }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--paper)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--sage)" }}>
            <IconPlus size={22} />
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-2)" }}>{tr('tabungan.buatGoalBaru')}</span>
          <span style={{ fontSize: 12, maxWidth: 180, textAlign: "center", lineHeight: 1.4 }}>{tr('tabungan.untukApaPun')}</span>
        </button>
      </div>
    </div>
  );
}

export function AddGoalModal({ open, onClose, onCreate }) {
  const { t: tr } = useTranslation();
  useScrollLock(open);
  const [label, setLabel] = React.useState("");
  const [icon, setIcon] = React.useState("star");
  const [target, setTarget] = React.useState("");
  const [current, setCurrent] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [color, setColor] = React.useState(GOAL_COLORS[0]);

  React.useEffect(() => {
    if (open) { setLabel(""); setIcon("star"); setTarget(""); setCurrent(""); setDeadline(""); setColor(GOAL_COLORS[0]); }
  }, [open]);

  if (!open) return null;

  const num = (v) => +String(v).replace(/\D/g, "") || 0;
  const valid = label.trim() && num(target) > 0;
  const submit = () => {
    if (!valid) return;
    onCreate({ id: "g" + Date.now(), label: label.trim(), icon, color, target: num(target), current: num(current), deadline: deadline.trim() || tr('tabungan.tanpaTenggat') });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20, animation: "rise .25s ease-out" }}>
      <div className="card modal-sheet goal-modal" onClick={e => e.stopPropagation()} style={{ width: 520, padding: 28, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div className="goal-modal-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('tabungan.targetBaru')}</div>
              <div className="serif" style={{ fontSize: 28, marginTop: 4, letterSpacing: "-0.01em" }}>{tr('tabungan.buatGoalTabungan')}</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid var(--line-soft)", background: "var(--paper)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
              <IconClose size={14} />
            </button>
          </div>

          <label style={{ display: "block", marginTop: 20 }}>
            <span style={goalFieldLabel}>{tr('tabungan.namaGoal')}</span>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={tr('tabungan.namaGoalPlaceholder')} style={goalInput} />
          </label>

          <div style={{ marginTop: 16 }}>
            <span style={goalFieldLabel}>{tr('tabungan.kategoriIkon')}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {GOAL_ICON_LIST.map(it => {
                const iconLabel = tr('tabungan.ikon.' + it.id, { defaultValue: it.id });
                return (
                  <button key={it.id} onClick={() => setIcon(it.id)} title={iconLabel} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 12, background: icon === it.id ? "var(--ivory)" : "var(--paper)", border: "1px solid " + (icon === it.id ? "var(--ink)" : "var(--line-soft)"), color: icon === it.id ? color : "var(--ink-2)" }}>
                    <GoalGlyph icon={it.id} size={18} />
                    <span style={{ fontSize: 9.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.1 }}>{iconLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <label>
              <span style={goalFieldLabel}>{tr('tabungan.targetJumlah')}</span>
              <div style={goalMoneyWrap}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>Rp</span>
                <input value={target ? num(target).toLocaleString("id-ID") : ""} onChange={e => setTarget(e.target.value)} placeholder="0" style={goalMoneyInput} />
              </div>
            </label>
            <label>
              <span style={goalFieldLabel}>{tr('tabungan.sudahTerkumpul')}</span>
              <div style={goalMoneyWrap}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>Rp</span>
                <input value={current ? num(current).toLocaleString("id-ID") : ""} onChange={e => setCurrent(e.target.value)} placeholder="0" style={goalMoneyInput} />
              </div>
            </label>
            <label style={{ gridColumn: "span 2" }}>
              <span style={goalFieldLabel}>{tr('tabungan.tenggatOpsional')}</span>
              <input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder={tr('tabungan.tenggatPlaceholder')} style={goalInput} />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={goalFieldLabel}>{tr('tabungan.warna')}</span>
            <div style={{ display: "flex", gap: 8 }}>
              {GOAL_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: 0, outline: color === c ? "2px solid var(--ink)" : "2px solid transparent", outlineOffset: 2, cursor: "pointer" }} />
              ))}
            </div>
          </div>
        </div>

        <div className="goal-modal-actions">
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>{tr('umum.batal')}</button>
          <button onClick={submit} disabled={!valid} style={{ flex: 2, padding: "11px", background: valid ? "var(--ink)" : "var(--line)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500, cursor: valid ? "pointer" : "default" }}>{tr('tabungan.buatGoal')}</button>
        </div>
      </div>
    </div>
  );
}

export function DepositModal({ goal, onClose, onConfirm }) {
  const { t: tr } = useTranslation();
  useScrollLock(!!goal);
  const [amount, setAmount] = React.useState("");
  React.useEffect(() => { setAmount(""); }, [goal]);
  if (!goal) return null;
  const num = (v) => +String(v).replace(/\D/g, "") || 0;
  const quick = [100_000, 500_000, 1_000_000, 2_500_000];
  const confirm = () => { if (num(amount) > 0) { onConfirm(goal.id, num(amount)); onClose(); } };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 51, background: "rgba(42,44,32,.32)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20, animation: "rise .25s ease-out" }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: 420, padding: 26, animation: "rise .3s ease-out", boxShadow: "0 30px 80px -20px rgba(42,44,32,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in oklch, ${goal.color} 16%, var(--ivory))`, color: goal.color, display: "grid", placeItems: "center" }}>
            <GoalGlyph icon={goal.icon} size={18} />
          </span>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{tr('tabungan.tambahDana')}</div>
            <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{goal.label}</div>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
            <span className="serif" style={{ fontSize: 30, color: "var(--muted)" }}>Rp</span>
            <input autoFocus value={amount ? num(amount).toLocaleString("id-ID") : ""} onChange={e => setAmount(e.target.value)} placeholder="0"
              style={{ fontFamily: "'Instrument Serif', serif", fontSize: 42, lineHeight: 1, color: "var(--ink)", background: "transparent", border: 0, outline: "none", width: 220, textAlign: "left", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {quick.map(q => (
            <button key={q} onClick={() => setAmount(String(q))} style={{ padding: "7px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 99, fontSize: 12, color: "var(--ink-2)" }}>
              + {fmtShort(q)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--ink-2)" }}>{tr('umum.batal')}</button>
          <button onClick={confirm} style={{ flex: 2, padding: "11px", background: "var(--ink)", color: "var(--cream)", border: 0, borderRadius: 12, fontSize: 13.5, fontWeight: 500 }}>{tr('tabungan.tambahKeTabungan')}</button>
        </div>
      </div>
    </div>
  );
}

const goalFieldLabel = { display: "block", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 };
const goalInput = { width: "100%", padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10, color: "var(--ink)", fontSize: 13, fontFamily: "inherit", outline: "none" };
const goalMoneyWrap = { display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 10 };
const goalMoneyInput = { width: "100%", padding: "10px 0", background: "transparent", border: 0, color: "var(--ink)", fontSize: 13, fontFamily: "inherit", outline: "none", fontVariantNumeric: "tabular-nums" };
