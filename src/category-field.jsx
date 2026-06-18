import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_CATEGORIES } from './data';
import { PLAN_LIMITS } from './lib/planLimits';
import { DeleteCategoryModal } from './components/DeleteCategoryModal';
import { EditCategoryModal } from './components/EditCategoryModal';

// Nilai khusus untuk opsi "Kustom (nama bebas)" di dropdown
export const CUSTOM_ID = '__custom__';

/**
 * Label kategori terlokalisasi.
 * Kategori bawaan (id seperti "food") punya key `kategori.<id>` di terjemahan.
 * Kategori kustom dari Supabase tak punya key → fallback ke nama tersimpan
 * (tidak diterjemahkan, sesuai aturan: data user tetap apa adanya).
 *
 * @param cat       objek kategori { id, label } (atau null)
 * @param translate fungsi t dari useTranslation
 * @param fallback  teks bila cat null (mis. id mentah dari transaksi)
 */
export function categoryLabel(cat, translate, fallback = '') {
  if (!cat) return fallback;
  return translate('kategori.' + cat.id, { defaultValue: cat.label });
}

// Palet warna untuk kategori kustom (dipakai di kedua menu)
export const CUSTOM_COLORS = [
  'var(--sage)', 'var(--terra)', 'var(--gold)', 'var(--blush)',
  '#8C7B5C', '#7A8A6E', '#6E8A8C', '#9A6B55',
];

// Cari {id,label,color} dari sebuah id kategori, termasuk kategori kustom.
export function resolveCategory(id, customCategories = []) {
  return ALL_CATEGORIES.find(c => c.id === id)
      || customCategories.find(c => c.id === id)
      || null;
}

const fieldInput = {
  width: '100%', padding: '11px 12px', background: 'var(--paper)',
  border: '1px solid var(--line-soft)', borderRadius: 10, color: 'var(--ink)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const Dot = ({ color }) => (
  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
);

const PlusDot = () => (
  <span style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px dashed var(--muted)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
    <span style={{ width: 5, height: 1.5, background: 'var(--muted)', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 1.75, top: -1.75, width: 1.5, height: 5, background: 'var(--muted)' }} />
    </span>
  </span>
);

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconLock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

/**
 * Dropdown kategori dengan titik warna — dipakai di menu Transaksi & Anggaran.
 *
 * Props:
 *  - value            id kategori terpilih (atau CUSTOM_ID saat mode kustom)
 *  - onChange(id)     dipanggil saat user memilih kategori / "Kustom"
 *  - categories       daftar kategori bawaan (mis. CATEGORIES atau INCOME_CATEGORIES)
 *  - customCategories daftar kategori kustom dari Supabase
 *  - allowCustom      tampilkan opsi "Kustom (nama bebas)" (default true)
 *  - pending          { name, color } saat mode kustom
 *  - onPendingChange  set { name, color } saat user mengetik nama / pilih warna
 *  - onDeleteCustom   callback(id) dipanggil setelah user konfirmasi hapus (Pro only)
 *  - isPro            true = Pro tier
 *  - isBasicAtMax     true = Basic sudah di batas maksimal kategori kustom
 *  - userId           untuk modal edit/delete
 */
export function CategoryField({
  value, onChange, categories = [], customCategories = [],
  allowCustom = true, pending, onPendingChange, onDeleteCustom,
  isPro = false, isBasicAtMax = false, userId,
}) {
  const { t } = useTranslation();
  const merged = [...categories, ...customCategories];
  const isCustom = value === CUSTOM_ID;
  const selected = merged.find(c => c.id === value);

  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const wrapRef = React.useRef(null);

  // Modal state
  const [deletingCat, setDeletingCat] = React.useState(null);
  const [editingCat, setEditingCat] = React.useState(null);

  // Hitung kategori kustom aktif (non-deleted) dari prop — dipakai untuk gating edit button
  const activeCustomCount = customCategories.filter(c => !c.is_deleted).length;
  const basicMax = PLAN_LIMITS.basic.maxCustomCategories;

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const pick = (id) => {
    onChange(id);
    if (id === CUSTOM_ID) onPendingChange?.({ name: pending?.name || '', color: pending?.color || CUSTOM_COLORS[0] });
    setOpen(false);
  };

  const handleDeleteConfirm = async (id) => {
    await onDeleteCustom?.(id);
  };

  const triggerLabel = isCustom ? t('kategori.kustom') : (selected ? categoryLabel(selected, t) : t('kategori.pilihKategori'));
  const triggerColor = isCustom ? (pending?.color || CUSTOM_COLORS[0]) : selected?.color;

  return (
    <div>
      <div ref={wrapRef}>
        <button type="button" onClick={toggle}
          style={{ ...fieldInput, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {(selected || isCustom) && <Dot color={triggerColor} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: (selected || isCustom) ? 'var(--ink)' : 'var(--muted)' }}>
              {triggerLabel}
            </span>
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: 6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && pos && (
          <div style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
            maxHeight: 220, overflowY: 'auto', background: 'var(--paper)',
            border: '1px solid var(--line-soft)', borderRadius: 10,
            boxShadow: '0 8px 28px -8px rgba(42,44,32,.3)', zIndex: 9999,
          }}>
            {merged.map((c) => {
              const locked = !!c.is_locked;
              const canDelete = isPro && c.custom && !locked && !!onDeleteCustom;
              const canEdit = !isPro && activeCustomCount >= basicMax && c.custom && !locked && !!userId;
              const showLock = !isPro && c.custom && !locked && !canEdit;

              return (
                <button key={c.id} type="button"
                  onClick={() => { if (!locked) pick(c.id); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: c.id === value ? 'var(--ivory)' : 'transparent',
                    border: 0, borderBottom: '1px solid var(--line-soft)', fontSize: 14,
                    color: locked ? 'var(--muted)' : 'var(--ink)',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                    opacity: locked ? 0.6 : 1,
                  }}>
                  <Dot color={c.color} />
                  {categoryLabel(c, t)}
                  {c.custom && !locked && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>{t('kategori.kustomBadge')}</span>}
                  {locked && <span style={{ fontSize: 11, marginLeft: 4 }}>🔒</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {c.id === value && !locked && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sage)' }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}

                    {/* Hapus — hanya Pro */}
                    {canDelete && (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Hapus kategori (Pro)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setDeletingCat(c);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                        style={{
                          display: 'grid', placeItems: 'center',
                          width: 22, height: 22, borderRadius: 6,
                          color: 'var(--muted)', cursor: 'pointer',
                          transition: 'color .15s, background .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--terra)'; e.currentTarget.style.background = 'color-mix(in oklch, var(--terra) 12%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <IconTrash />
                      </span>
                    )}

                    {/* Edit — hanya Basic saat maximal */}
                    {canEdit && (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Edit kategori"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setEditingCat(c);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                        style={{
                          display: 'grid', placeItems: 'center',
                          width: 22, height: 22, borderRadius: 6,
                          color: 'var(--muted)', cursor: 'pointer',
                          transition: 'color .15s, background .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--sage)'; e.currentTarget.style.background = 'color-mix(in oklch, var(--sage) 12%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <IconEdit />
                      </span>
                    )}

                    {/* Gemlock — Basic custom, belum maximal (tidak bisa edit/hapus) */}
                    {showLock && (
                      <span
                        title="Upgrade ke Pro untuk lebih fleksibel"
                        style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, color: 'var(--muted)', opacity: 0.5 }}
                      >
                        <IconLock />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {allowCustom && (
              <button type="button" onClick={() => pick(CUSTOM_ID)}
                style={{
                  position: 'sticky', bottom: 0,
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: isCustom ? 'var(--ivory)' : 'var(--paper)',
                  border: 0, borderTop: '1px solid var(--line-soft)',
                  fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}>
                <PlusDot />
                {t('kategori.kustom')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input nama + warna — hanya saat memilih Kustom */}
      {isCustom && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input autoFocus value={pending?.name || ''}
            onChange={e => onPendingChange?.({ ...pending, name: e.target.value })}
            placeholder={t('kategori.namaKategoriPlaceholder')}
            style={fieldInput} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CUSTOM_COLORS.map(col => (
              <button key={col} type="button" onClick={() => onPendingChange?.({ ...pending, color: col })}
                title={col}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: col, cursor: 'pointer',
                  border: (pending?.color || CUSTOM_COLORS[0]) === col ? '2px solid var(--ink)' : '2px solid transparent',
                  outline: (pending?.color || CUSTOM_COLORS[0]) === col ? '2px solid var(--ivory)' : 'none',
                  outlineOffset: '-4px',
                }} />
            ))}
          </div>
        </div>
      )}

      {/* Delete modal — Pro only */}
      <DeleteCategoryModal
        open={!!deletingCat}
        category={deletingCat}
        onClose={() => setDeletingCat(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit modal — Basic at max only */}
      <EditCategoryModal
        open={!!editingCat}
        category={editingCat}
        userId={userId}
        onClose={() => setEditingCat(null)}
      />
    </div>
  );
}
