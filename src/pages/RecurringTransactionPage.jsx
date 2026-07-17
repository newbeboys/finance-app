import React from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { fmt } from '../data';
import {
  loadRecurring, addRecurring, updateRecurring, deleteRecurring, toggleRecurring, fromISO,
} from '../lib/recurringHelper';
import RecurringTransactionForm from '../components/RecurringTransactionForm';
import { useScrollLock } from '../hooks/useScrollLock';
import RecurringTour from '../components/RecurringTour';

const TOUR_RECURRING_KEY = 'productTourRecurringDone_v1';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ── Mini switch (lokal, agar tak bergantung pada settings-page) ──────
function MiniSwitch({ on, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerDown={(e) => e.stopPropagation()}
      role="switch" aria-checked={on}
      style={{ width: 44, height: 25, borderRadius: 99, border: 0, padding: 3, flexShrink: 0, background: on ? 'var(--sage)' : 'var(--line)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s ease', cursor: 'pointer' }}>
      <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  );
}

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

// ── Baris yang bisa di-swipe (pointer events → jalan di sentuh & mouse) ──
function SwipeRow({ onDelete, onEdit, children, deleteLabel = 'Hapus' }) {
  const REVEAL = 78;
  const [dx, setDx] = React.useState(0);
  const [animate, setAnimate] = React.useState(true);
  const openRef = React.useRef(false);
  const downX = React.useRef(0);
  const lastX = React.useRef(0);
  const active = React.useRef(false);

  const onDown = (e) => {
    active.current = true;
    downX.current = lastX.current = e.clientX;
    setAnimate(false);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  };
  const onMove = (e) => {
    if (!active.current) return;
    lastX.current = e.clientX;
    const base = openRef.current ? -REVEAL : 0;
    let next = base + (e.clientX - downX.current);
    next = Math.max(-REVEAL, Math.min(0, next));
    setDx(next);
  };
  const onUp = () => {
    if (!active.current) return;
    active.current = false;
    setAnimate(true);
    const moved = Math.abs(lastX.current - downX.current);
    if (moved < 6) {                       // dianggap ketukan, bukan geser
      if (openRef.current) { openRef.current = false; setDx(0); }
      else onEdit?.();
      return;
    }
    const base = openRef.current ? -REVEAL : 0;
    const final = base + (lastX.current - downX.current);
    const shouldOpen = final <= -REVEAL / 2;
    openRef.current = shouldOpen;
    setDx(shouldOpen ? -REVEAL : 0);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
      <button onClick={onDelete}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL, background: 'var(--terra)', color: '#fff', border: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', fontSize: 11 }}>
        <TrashIcon /> {deleteLabel}
      </button>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ transform: `translateX(${dx}px)`, transition: animate ? 'transform .2s ease' : 'none', touchAction: 'pan-y', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

// ── Konfirmasi hapus ────────────────────────────────────────────────
function ConfirmDelete({ item, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <div onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(42,44,32,.4)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px, 100%)', padding: 24, textAlign: 'center', boxShadow: '0 30px 80px -20px rgba(42,44,32,.4)' }}>
        <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>{t('berulang.hapusJadwal')}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          {t('berulang.hapusKonfirmasi', { nama: item.nama })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('umum.batal')}</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px', background: 'var(--terra)', color: '#fff', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{t('umum.hapus')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Halaman utama ───────────────────────────────────────────────────
export default function RecurringTransactionPage({ open, onClose, accounts = [] }) {
  const { t } = useTranslation();
  useScrollLock(open);

  const freqLabel = (item) => {
    if (item.frekuensi === 'mingguan') return t('berulang.mingguanSetiap', { hari: item.hariMinggu });
    if (item.frekuensi === 'tahunan')  return t('berulang.tahunanTgl', { tanggal: item.tanggal, bulan: MONTH_NAMES[(item.bulan || 1) - 1] });
    return t('berulang.bulananTgl', { tanggal: item.tanggal });
  };

  const dueLabel = (iso) => {
    if (!iso) return '—';
    const d = fromISO(iso);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  };

  const [items, setItems] = React.useState([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);

  const refresh = React.useCallback(() => setItems(loadRecurring()), []);

  React.useEffect(() => { if (open) refresh(); }, [open, refresh]);

  // Tour — tampil sekali saat halaman ini dibuka pertama kali, independen dari
  // tour lain. Guard sama seperti tour lain: tidak tabrakan dengan modal lokal
  // (form tambah/edit, konfirmasi hapus) yang mungkin terbuka di halaman ini.
  const [tourActive, setTourActive] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    try {
      if (localStorage.getItem(TOUR_RECURRING_KEY) === 'true') return;
    } catch {}
    setTourActive(true);
  }, [open]);

  const handleTourComplete = React.useCallback(() => {
    try { localStorage.setItem(TOUR_RECURRING_KEY, 'true'); } catch {}
    setTourActive(false);
  }, []);

  if (!open) return null;

  // Fitur khusus Android native — kalau halaman ini somehow diakses di web
  // (mis. lewat state yang diset manual), tampilkan pesan alih-alih halaman
  // kosong/rusak. RecurringTour & RecurringTransactionForm tidak pernah
  // di-render lewat cabang ini, jadi otomatis ikut tidak muncul di web.
  if (!Capacitor.isNativePlatform()) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--cream)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', borderBottom: '1px solid var(--line-soft)', background: 'var(--ivory)' }}>
          <button onClick={onClose} aria-label={t('umum.kembali')}
            style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{t('berulang.judul')}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }} aria-hidden>🔄</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
            {t('berulang.hanyaAndroid')}
          </div>
        </div>
      </div>
    );
  }

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item) => { setEditing(item); setFormOpen(true); };

  const handleSave = (data) => {
    if (editing) updateRecurring(editing.id, data);
    else addRecurring(data);
    setFormOpen(false);
    setEditing(null);
    refresh();
  };

  const handleToggle = (item) => { toggleRecurring(item.id); refresh(); };
  const handleDelete = () => { if (confirm) { deleteRecurring(confirm.id); setConfirm(null); refresh(); } };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--cream)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', borderBottom: '1px solid var(--line-soft)', background: 'var(--ivory)' }}>
        <button onClick={onClose} aria-label={t('umum.kembali')}
          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--paper)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{t('berulang.judul')}</div>
        </div>
        <button data-tour="recurring-add" onClick={openAdd} aria-label="Tambah"
          style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: 'var(--ink)', color: 'var(--cream)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Daftar */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        {items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40 }} aria-hidden>🔄</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
              {t('berulang.belumAdaJadwal')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, margin: '0 auto' }}>
            {items.map((item) => {
              const isIncome = item.tipe === 'pemasukan';
              const color = isIncome ? 'var(--sage)' : 'var(--terra)';
              const wallet = accounts.find((a) => a.id === item.wallet_id);
              const walletLabel = wallet ? wallet.name : t('berulang.dompetOtomatis');
              return (
                <SwipeRow key={item.id} onEdit={() => openEdit(item)} onDelete={() => setConfirm(item)} deleteLabel={t('umum.hapus')}>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', opacity: item.aktif ? 1 : 0.55, transition: 'opacity .2s ease' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nama}</span>
                        <span className="tnum" style={{ fontSize: 14, fontWeight: 600, color }}>
                          {isIncome ? '+' : '−'}{fmt(item.jumlah)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{freqLabel(item)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>
                        {t('berulang.jatuhTempoBer')} <span style={{ color: 'var(--ink-2)' }}>{dueLabel(item.nextDueDate)}</span>
                      </div>
                      {accounts.length > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>
                          {t('berulang.dompet')}: <span style={{ color: wallet ? 'var(--ink-2)' : 'var(--muted)', fontStyle: wallet ? 'normal' : 'italic' }}>{walletLabel}</span>
                        </div>
                      )}
                    </div>
                    <MiniSwitch on={item.aktif} onClick={() => handleToggle(item)} />
                  </div>
                </SwipeRow>
              );
            })}
            <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', padding: '6px 0 0', lineHeight: 1.5 }}>
              {t('berulang.gestureHint')}
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <RecurringTransactionForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          accounts={accounts}
        />
      )}
      {confirm && (
        <ConfirmDelete item={confirm} onConfirm={handleDelete} onCancel={() => setConfirm(null)} />
      )}

      <RecurringTour isActive={tourActive && !formOpen && !confirm} onComplete={handleTourComplete} />
    </div>
  );
}
