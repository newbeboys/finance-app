import React from 'react';
import { fmt } from '../../data';
import { IconClose, IconCalendar, IconCheck } from '../../icons';
import { DatePickerPopup } from '../../transactions';
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

const input = { width: '100%', padding: '10px 12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

// Bottom sheet detail catatan hutang/piutang: riwayat cicilan, form cicilan,
// tandai lunas, hapus. `debt` selalu objek fresh dari parent (lookup by id).
export default function DebtDetailSheet({ debt, onClose, getPayments, addPayment, markPaid, deleteDebt, onToast, openPaymentInitially = false }) {
  useScrollLock(!!debt);
  const [payments, setPayments]   = React.useState([]);
  const [loadingPay, setLoading]  = React.useState(true);
  const [showForm, setShowForm]   = React.useState(openPaymentInitially);
  const [payAmount, setPayAmount] = React.useState('');
  const [payDate, setPayDate]     = React.useState(todayISO());
  const [payNote, setPayNote]     = React.useState('');
  const [showDate, setShowDate]   = React.useState(false);
  const [busy, setBusy]           = React.useState(false);
  const [errorMsg, setErrorMsg]   = React.useState('');
  const [confirm, setConfirm]     = React.useState('none'); // 'none' | 'markPaid' | 'delete'

  const debtId = debt?.id;
  const load = React.useCallback(async () => {
    if (!debtId) return;
    setLoading(true);
    const { data } = await getPayments(debtId);
    setPayments(data || []);
    setLoading(false);
  }, [debtId, getPayments]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { setShowForm(openPaymentInitially); }, [debtId, openPaymentInitially]);

  if (!debt) return null;

  const locked = debt.is_locked;   // sisa downgrade Pro→Basic: hanya bisa dilihat, tak bisa dikelola
  const isReceivable = debt.type === 'receivable';
  const accent = isReceivable ? 'var(--sage)' : 'var(--terra)';
  const pct = debt.amount > 0 ? Math.min(debt.paid / debt.amount, 1) : 0;
  const num = (v) => +String(v).replace(/\D/g, '') || 0;
  const payValid = num(payAmount) > 0 && num(payAmount) <= debt.remaining + 1e-6;

  const submitPayment = async () => {
    if (!payValid || busy) return;
    setBusy(true); setErrorMsg('');
    const res = await addPayment(debt.id, { amount: num(payAmount), date: payDate, note: payNote.trim() });
    setBusy(false);
    if (res?.error) { setErrorMsg(res.error.message || 'Gagal menyimpan cicilan'); return; }
    setPayAmount(''); setPayNote(''); setShowForm(false);
    await load();
    if (res?.isPaidOff) { onToast?.('Lunas 🎉'); onClose(); }
  };

  const doMarkPaid = async () => {
    if (busy) return;
    setBusy(true);
    const res = await markPaid(debt.id);
    setBusy(false);
    setConfirm('none');
    if (res?.error) { setErrorMsg(res.error.message || 'Gagal menandai lunas'); return; }
    if (res?.isPaidOff) onToast?.('Lunas 🎉');
    onClose();
  };

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    const res = await deleteDebt(debt.id);
    setBusy(false);
    setConfirm('none');
    if (res?.error) { setErrorMsg(res.error.message || 'Gagal menghapus'); return; }
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(42,44,32,.45)', zIndex: 150 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '82vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', background: 'var(--ivory)', padding: '0 0 40px', zIndex: 200, boxShadow: '0 -8px 32px -8px rgba(42,44,32,.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 18px 14px', borderBottom: '1px solid var(--line-soft)', position: 'sticky', top: 0, background: 'var(--ivory)', zIndex: 1 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', background: accent, borderRadius: 99, padding: '2px 9px' }}>{isReceivable ? 'Piutang' : 'Hutang'}</span>
              {debt.status === 'paid' && <span style={{ fontSize: 10.5, fontWeight: 600, color: accent, border: `1px solid ${accent}`, borderRadius: 99, padding: '1px 8px' }}>Lunas</span>}
            </div>
            <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em', marginTop: 6 }}>{debt.person_name}</div>
            {debt.note && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{debt.note}</div>}
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
            <IconClose size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {/* Ringkasan + progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Sisa</div>
              <div className="serif tnum" style={{ fontSize: 26, letterSpacing: '-0.02em', marginTop: 2 }}>{fmt(debt.remaining)}</div>
            </div>
            <div className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmt(debt.paid)}</span> / {fmt(debt.amount)}
            </div>
          </div>
          <div style={{ height: 7, background: 'var(--line-soft)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
            <div style={{ height: '100%', width: `${pct * 100}%`, background: accent, borderRadius: 99, transition: 'width .5s ease' }} />
          </div>
          {debt.due_date && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Jatuh tempo: {fmtDateLabel(debt.due_date)}</div>
          )}

          {/* Catatan terkunci (downgrade Pro→Basic): semua aksi dinonaktifkan */}
          {locked && (
            <div style={{ marginTop: 16, padding: 14, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>Catatan ini terkunci. Upgrade ke Pro untuk mengelola catatan ini kembali.</div>
            </div>
          )}

          {/* Aksi utama */}
          {!locked && debt.status === 'active' && confirm === 'none' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowForm(v => !v)} style={{ flex: 2, padding: '11px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 11, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
                {isReceivable ? 'Terima Cicilan' : 'Bayar Cicilan'}
              </button>
              <button onClick={() => setConfirm('markPaid')} style={{ flex: 1, padding: '11px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 11, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>Tandai Lunas</button>
            </div>
          )}

          {/* Form cicilan inline */}
          {!locked && debt.status === 'active' && showForm && confirm === 'none' && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...input, minWidth: 0, background: 'var(--ivory)', padding: 0, paddingLeft: 12 }}>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>Rp</span>
                <input autoFocus value={payAmount ? num(payAmount).toLocaleString('id-ID') : ''} onChange={e => setPayAmount(e.target.value)} placeholder="0" inputMode="numeric"
                  style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit', padding: '10px 12px 10px 0', fontVariantNumeric: 'tabular-nums' }} />
                <button onClick={() => setPayAmount(String(debt.remaining))} style={{ flexShrink: 0, marginRight: 8, padding: '4px 8px', fontSize: 11, background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer' }}>Sisa</button>
              </div>
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setShowDate(v => !v)} style={{ ...input, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{fmtDateLabel(payDate)}</span><IconCalendar size={15} />
                </button>
                {showDate && (
                  <DatePickerPopup valueISO={payDate} onConfirm={(iso) => { setPayDate(iso); setShowDate(false); }} onClose={() => setShowDate(false)} />
                )}
              </div>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Catatan (opsional)" style={input} />
              <button onClick={submitPayment} disabled={!payValid || busy}
                style={{ padding: '11px', background: (payValid && !busy) ? accent : 'var(--line-soft)', color: '#fff', border: 0, borderRadius: 11, fontSize: 13.5, fontWeight: 500, cursor: (payValid && !busy) ? 'pointer' : 'default' }}>
                {busy ? 'Menyimpan…' : 'Simpan Cicilan'}
              </button>
            </div>
          )}

          {/* Konfirmasi Tandai Lunas */}
          {confirm === 'markPaid' && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>Tandai catatan ini <strong>lunas</strong>? Sisa {fmt(debt.remaining)} akan dicatat sebagai satu cicilan pelunasan.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirm('none')} style={{ flex: 1, padding: '10px', background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>Batal</button>
                <button onClick={doMarkPaid} disabled={busy} style={{ flex: 2, padding: '10px', background: accent, color: '#fff', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><IconCheck size={14} /> {busy ? 'Memproses…' : 'Ya, Lunas'}</button>
              </div>
            </div>
          )}

          {/* Konfirmasi Hapus — warning cooldown WAJIB (§8) */}
          {confirm === 'delete' && (
            <div style={{ marginTop: 14, padding: 14, background: 'color-mix(in oklch, var(--terra) 10%, var(--paper))', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                ⚠️ Membatalkan hutang ini tidak membebaskan kuota cooldown 50 hari — tetap tidak bisa membuat catatan baru sampai jendela waktu berlalu.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setConfirm('none')} style={{ flex: 1, padding: '10px', background: 'var(--ivory)', border: '1px solid var(--line-soft)', borderRadius: 10, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>Batal</button>
                <button onClick={doDelete} disabled={busy} style={{ flex: 2, padding: '10px', background: 'var(--terra)', color: '#fff', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{busy ? 'Menghapus…' : 'Hapus Catatan'}</button>
              </div>
            </div>
          )}

          {errorMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--terra)' }}>{errorMsg}</div>}

          {/* Riwayat cicilan */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Riwayat Cicilan</div>
            {loadingPay ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Memuat…</div>
            ) : payments.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Belum ada cicilan.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {payments.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i < payments.length - 1 ? '1px solid var(--line-soft)' : 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="tnum" style={{ fontSize: 14, fontWeight: 500 }}>{fmt(Number(p.amount))}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{fmtDateLabel(p.date)}{p.note ? ` · ${p.note}` : ''}</div>
                    </div>
                    <span style={{ color: accent, flexShrink: 0 }}><IconCheck size={15} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hapus */}
          {!locked && confirm === 'none' && (
            <button onClick={() => setConfirm('delete')} style={{ marginTop: 20, width: '100%', padding: '11px', background: 'transparent', border: '1px solid var(--line-soft)', borderRadius: 11, fontSize: 13, color: 'var(--terra)', cursor: 'pointer' }}>
              Hapus Catatan
            </button>
          )}
        </div>
      </div>
    </>
  );
}
