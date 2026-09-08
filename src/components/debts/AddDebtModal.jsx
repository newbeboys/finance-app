import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  // Hanya dipakai utk type='receivable' — lihat cashDisbursedAtCreation di
  // useDebts.createDebt(). Untuk 'payable' selalu dikirim true, apapun state ini.
  const [cashDisbursed, setCashDisbursed] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setType('receivable'); setPerson(''); setAmount(''); setWalletId(primaryId);
      setDateISO(todayISO()); setDueISO(null); setNote(''); setCashDisbursed(true);
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
      // Hutang selalu true (tidak ada toggle di UI utk itu) — hook juga memaksa
      // ini, tapi dikirim eksplisit di sini supaya niatnya jelas dari pemanggil.
      cash_disbursed_at_creation: isReceivable ? cashDisbursed : true,
    });
    setSubmitting(false);
    if (!res) { setErrorMsg(t('debts.error.saveFailed')); return; }
    if (res.limitReached) { onClose(); return; }        // paywall sudah dibuka oleh hook
    if (res.cooldownBlocked) { setCooldown({ date: res.cooldownUntilDate }); return; }
    if (res.error) { setErrorMsg(res.error.message || t('debts.error.saveFailed')); return; }
    onClose();
  };

  const isReceivable = type === 'receivable';

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 50, background: 'rgba(42,44,32,.32)', backdropFilter: 'blur(4px)', padding: 20, animation: 'rise .25s ease-out' }}>
      <div className="card modal-sheet" onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: '92vh', overflowY: 'auto', padding: 26, animation: 'rise .3s ease-out', boxShadow: '0 30px 80px -20px rgba(42,44,32,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('debts.action.newRecord')}</div>
            <div className="serif" style={{ fontSize: 26, marginTop: 4, letterSpacing: '-0.01em' }}>{t('debts.title')}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
            <IconClose size={14} />
          </button>
        </div>

        {/* Toggle tipe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 3, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, marginTop: 18 }}>
          {[{ id: 'receivable', label: t('debts.badge.receivable'), hint: t('debts.mode.lending') }, { id: 'payable', label: t('debts.badge.payable'), hint: t('debts.mode.borrowing') }].map(opt => {
            const on = type === opt.id;
            return (
              <button key={opt.id} onClick={() => setType(opt.id)}
                style={{ padding: '9px 6px', fontSize: 13, background: on ? 'var(--ivory)' : 'transparent', border: on ? '1px solid var(--line-soft)' : '1px solid transparent', borderRadius: 9, color: on ? 'var(--ink)' : 'var(--muted)', fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {opt.label} <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>· {opt.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Mode pencatatan — HANYA utk Piutang. Hutang selalu dianggap uang
            sudah berpindah saat dibuat, tak ada opsi apapun ditampilkan. */}
        {isReceivable && (
          <div style={{ marginTop: 14, padding: '2px 14px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
            {[
              { val: true,  label: t('debts.mode.disbursedNowLabel'), desc: t('debts.mode.disbursedNowDesc') },
              { val: false, label: t('debts.mode.billOnlyLabel'), desc: t('debts.mode.billOnlyDesc') },
            ].map((opt, i) => {
              const checked = cashDisbursed === opt.val;
              return (
                <button key={String(opt.val)} type="button" role="radio" aria-checked={checked} onClick={() => setCashDisbursed(opt.val)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 0', borderBottom: i === 0 ? '1px solid var(--line-soft)' : 0,
                    background: 'transparent', border: 0, borderTop: 0, borderLeft: 0, borderRight: 0,
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${checked ? 'var(--sage)' : 'var(--line)'}`,
                    display: 'grid', placeItems: 'center', transition: 'border-color .15s',
                  }}>
                    {checked && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--sage)' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{opt.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <label>
            <span style={fieldLabel}>{isReceivable ? t('debts.field.lentTo') : t('debts.field.borrowedFrom')}</span>
            <input value={personName} onChange={e => setPerson(e.target.value)} placeholder={t('debts.field.personNamePlaceholder')} style={input} />
          </label>

          <label>
            <span style={fieldLabel}>{t('transaksi.jumlah')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...input, padding: 0, paddingLeft: 12 }}>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>Rp</span>
              <input value={amount ? num(amount).toLocaleString('id-ID') : ''} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="numeric"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit', padding: '11px 12px 11px 0', fontVariantNumeric: 'tabular-nums' }} />
            </div>
          </label>

          {wallets.length > 0 && (
            <label>
              <span style={fieldLabel}>{t('transaksi.dompet')}</span>
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
              <span style={fieldLabel}>{t('transaksi.tanggal')}</span>
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
              <span style={fieldLabel}>{t('debts.field.dueDate')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <button type="button" onClick={() => { setShowDue(v => !v); setShowDate(false); }}
                    style={{ ...input, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: dueISO ? 'var(--ink)' : 'var(--muted)' }}>
                    <span>{dueISO ? fmtDateLabel(dueISO) : t('debts.field.dueDateEmpty')}</span><IconCalendar size={15} />
                  </button>
                  {showDue && (
                    <DatePickerPopup valueISO={dueISO || dateISO}
                      onConfirm={(iso) => { setDueISO(iso); setShowDue(false); }}
                      onClose={() => setShowDue(false)} />
                  )}
                </div>
                {dueISO && (
                  <button type="button" onClick={() => setDueISO(null)} title={t('debts.field.clearDueDate')}
                    style={{ flex: '0 0 auto', padding: '0 12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <IconClose size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <label>
            <span style={fieldLabel}>{t('debts.field.noteOptional')}</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder={t('debts.field.notePlaceholder')}
              style={{ ...input, resize: 'vertical', minHeight: 44 }} />
          </label>
        </div>

        {/* Pesan blokir cooldown */}
        {cooldown && (
          <div style={{ marginTop: 16, padding: 14, background: 'color-mix(in oklch, var(--gold) 12%, var(--paper))', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
              {t('debts.cooldown.message', { date: fmtDateLabel(cooldown.date) || cooldown.date })}
            </div>
            {/* Nama fitur ini sengaja TIDAK dilewatkan lewat t() — kalimat pembungkusnya
                di PaywallModal.jsx (klaster Paywall, belum di-i18n-kan) masih hardcode
                Bahasa Indonesia; menerjemahkan cuma nama fiturnya akan bikin kalimat
                campur bahasa. Akan dirapikan bareng saat klaster Paywall dikerjakan. */}
            <button onClick={() => openPaywall('Hutang / Piutang tanpa batas')}
              style={{ marginTop: 10, padding: '9px 14px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              {t('debts.action.upgradeToPro')}
            </button>
          </div>
        )}

        {/* Error inline */}
        {errorMsg && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--terra)' }}>{errorMsg}</div>
        )}

        <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('umum.batal')}</button>
          <button onClick={submit} disabled={!valid || submitting}
            style={{ flex: 2, padding: '12px', background: (valid && !submitting) ? 'var(--ink)' : 'var(--line-soft)', color: (valid && !submitting) ? 'var(--cream)' : 'var(--muted)', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: (valid && !submitting) ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {submitting ? t('umum.menyimpan') : t('debts.action.saveRecord')}
          </button>
        </div>
      </div>
    </div>
  );
}
