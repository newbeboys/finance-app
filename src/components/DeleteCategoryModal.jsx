import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScrollLock } from '../hooks/useScrollLock';

export function DeleteCategoryModal({ open, category, onClose, onConfirm }) {
  const { t } = useTranslation();
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
      className="modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 5100,
        background: 'rgba(42,44,32,.45)', backdropFilter: 'blur(4px)',
        padding: 24,
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
          {t('category.delete.eyebrow')}
        </div>
        <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          {t('category.delete.confirmTitle', { label: category.label })}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
          {t('category.delete.warning')}
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
            {t('umum.batal')}
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
            {loading ? t('category.delete.deleting') : t('umum.hapus')}
          </button>
        </div>
      </div>
    </div>
  );
}
