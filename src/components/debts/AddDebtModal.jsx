import React from 'react';
import { fmt } from '../../data';
import { IconClose, IconCalendar } from '../../icons';
import { DatePickerPopup } from '../../transactions';
import { usePaywall } from '../PaywallModal';
import { useScrollLock } from '../../hooks/useScrollLock';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDateLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const fieldLabel = { display: 'block', fontSize: 11, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 };
const input = { width: '100%', padding: '11px 12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

// Form tambah catatan piutang/hutang. onCreate = createDebt(input) dari useDebts,
// mengembalikan { error, debtId, limitReached, cooldownBlocked, cooldownUntilDate }.
export default function AddDebtModal({ open, onClose, onCreate, wallets = [] }) {
  useScrollLock(open);
  const { openPaywall } = usePaywall();
  const primaryId = React.useMemo(
    () => (wallets.find(w => w.is_primary || w.primary) || wallets[0])?.id || null,
    [wallets]
  );

  const [type, setType]         = React.useState('receivable');
  const [personName, setPerson] = React.useState('');
  const [amount, setAmount]     = React.useState('');
  const [walletId, setWalletId] = React.useState(primaryId);
  const [dateISO, setDateISO]   = React.useState(todayISO());
  const [dueISO, setDueISO]     = React.useState(null);
  const [note, setNote]         = React.useState('');
  const [showDate, setShowDate] = React.useState(false);
  const [showDue, setShowDue]   = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [cooldown, setCooldown] = React.useState(null); // { date } | null

  React.useEffect(() => {
    if (open) {
      setType('receivable'); setPerson(''); setAmount(''); setWalletId(primaryId);
      setDateISO(todayISO()); setDueISO(null); setNote('');
      setShowDate(false); setShowDue(false); setSubmitting(false); setErrorMsg(''); setCooldown(null);
    }
  }, [open, primaryId]);

  if (!open) return null;

  const num = (v) => +String(v).replace(/\D/g, '') || 0;
  const valid = personName.trim() && num(amount) > 0 && (wallets.length === 0 || walletId);

  const submit = async () => {
    if (!valid || submitting) return;
    setErrorMsg(''); setCooldown(null); setSubmitting(true);
    const res = await onCreate({
      type,
      person_name: personName.trim(),
      amount: num(amount),
      wallet_id: walletId,
      date: dateISO,
      due_date: dueISO,
      note: note.trim(),
    });
    setSubmitting(false);
    if (!res) { setErrorMsg('Gagal menyimpan catatan'); return; }
    if (res.limitReached) { onClose(); return; }        // paywall sudah dibuka oleh hook
    if (res.cooldownBlocked) { setCooldown({ date: res.cooldownUntilDate }); return; }
    if (res.error) { setErrorMsg(res.error.message || 'Gagal menyimpan catatan'); return; }
    onClose();
  };

  const isReceivable = type === 'receivable';

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(42,44,32,.32)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20, animation: 'rise .25s ease-out' }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: '92vh', overflowY: 'auto', padding: 26, animation: 'rise .3s ease-out', boxShadow: '0 30px 80px -20px rgba(42,44,32,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>Catatan Baru</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 4, letterSpacing: '-0.01em' }}>Hutang &amp; Piutang</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
            <IconClose size={14} />
          </button>
        </div>

        {/* Toggle tipe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 3, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, marginTop: 18 }}>
          {[{ id: 'receivable', label: 'Piutang', hint: 'Meminjamkan' }, { id: 'payable', label: 'Hutang', hint: 'Meminjam' }].map(opt => {
            const on = type === opt.id;
            return (
              <button key={opt.id} onClick={() => setType(opt.id)}
                style={{ padding: '9px 6px', fontSize: 13, background: on ? 'var(--ivory)' : 'transparent', border: on ? '1px solid var(--line-soft)' : '1px solid transparent', borderRadius: 9, color: on ? 'var(--ink)' : 'var(--muted)', fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {opt.label} <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>· {opt.hint}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <label>
            <span style={fieldLabel}>{isReceivable ? 'Dipinjamkan ke' : 'Dipinjam dari'}</span>
            <input value={personName} onChange={e => setPerson(e.target.value)} placeholder="Nama orang" style={input} />
          </label>

          <label>
            <span style={fieldLabel}>Jumlah</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...input, padding: 0, paddingLeft: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>Rp</span>
              <input value={amount ? num(amount).toLocaleString('id-ID') : ''} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="numeric"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit', padding: '11px 12px 11px 0', fontVariantNumeric: 'tabular-nums' }} />
            </div>
          </label>

          {wallets.length > 0 && (
            <label>
              <span style={fieldLabel}>Dompet</span>
              <select value={walletId || ''} onChange={e => setWalletId(e.target.value)} style={input}>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} — {fmt(w.balance)}</option>
                ))}
              </select>
            </label>
          )}

          {/* Tanggal + jatuh tempo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={fieldLabel}>Tanggal</span>
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => { setShowDate(v => !v); setShowDue(false); }}
                  style={{ ...input, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{fmtDateLabel(dateISO)}</span><IconCalendar size={15} />
                </button>
                {showDate && (
                  <DatePickerPopup valueISO={dateISO}
                    onConfirm={(iso) => { setDateISO(iso); setShowDate(false); }}
                    onClose={() => setShowDate(false)} />
                )}
              </div>
            </div>
            <div>
              <span style={fieldLabel}>Jatuh tempo</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <button type="button" onClick={() => { setShowDue(v => !v); setShowDate(false); }}
                    style={{ ...input, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: dueISO ? 'var(--ink)' : 'var(--muted)' }}>
                    <span>{dueISO ? fmtDateLabel(dueISO) : 'Opsional'}</span><IconCalendar size={15} />
                  </button>
                  {showDue && (
                    <DatePickerPopup valueISO={dueISO || dateISO}
                      onConfirm={(iso) => { setDueISO(iso); setShowDue(false); }}
                      onClose={() => setShowDue(false)} />
                  )}
                </div>
                {dueISO && (
                  <button type="button" onClick={() => setDueISO(null)} title="Bersihkan"
                    style={{ flex: '0 0 auto', padding: '0 12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <IconClose size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <label>
            <span style={fieldLabel}>Keterangan (opsional)</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="mis. pinjam buat servis motor"
              style={{ ...input, resize: 'vertical', minHeight: 44 }} />
          </label>
        </div>

        {/* Pesan blokir cooldown */}
        {cooldown && (
          <div style={{ marginTop: 16, padding: 14, background: 'color-mix(in oklch, var(--gold) 12%, var(--paper))', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
              Kamu sudah mencapai batas 5 catatan dalam 50 hari. Bisa buat lagi mulai <strong>{fmtDateLabel(cooldown.date) || cooldown.date}</strong>.
            </div>
            <button onClick={() => openPaywall('Hutang / Piutang tanpa batas')}
              style={{ marginTop: 10, padding: '9px 14px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              Upgrade ke Pro
            </button>
          </div>
        )}

        {/* Error inline */}
        {errorMsg && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--terra)' }}>{errorMsg}</div>
        )}

        <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={submit} disabled={!valid || submitting}
            style={{ flex: 2, padding: '12px', background: (valid && !submitting) ? 'var(--ink)' : 'var(--line-soft)', color: (valid && !submitting) ? 'var(--cream)' : 'var(--muted)', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: (valid && !submitting) ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {submitting ? 'Menyimpan…' : 'Simpan Catatan'}
          </button>
        </div>
      </div>
    </div>
  );
}
