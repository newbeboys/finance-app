import React from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

export function DeleteCategoryModal({ open, category, onClose, onConfirm }) {
  useScrollLock(open);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !category) return null;

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(category.id);
    setLoading(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 5100,
        background: 'rgba(42,44,32,.45)', backdropFilter: 'blur(4px)',
        display: 'grid', placeItems: 'center', padding: 24,
        animation: 'rise .2s ease-out',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(360px, 100%)', padding: 28,
          animation: 'rise .25s ease-out',
          boxShadow: '0 30px 80px -20px rgba(42,44,32,.5)',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Hapus Kategori
        </div>
        <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Hapus &ldquo;{category.label}&rdquo;?
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
          Transaksi lama yang memakai kategori ini tetap aman, tapi kategori tidak bisa dipilih untuk transaksi baru.
          Slot kuota akan terbuka kembali.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: '13px', background: 'var(--paper)',
              border: '1px solid var(--line-soft)', borderRadius: 12,
              fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: '13px', background: 'var(--terra)',
              border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500,
              color: '#fff', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}
