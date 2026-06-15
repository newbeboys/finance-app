import React from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_CATEGORIES } from './data';

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
 */
export function CategoryField({
  value, onChange, categories = [], customCategories = [],
  allowCustom = true, pending, onPendingChange,
}) {
  const { t } = useTranslation();
  const merged = [...categories, ...customCategories];
  const isCustom = value === CUSTOM_ID;
  const selected = merged.find(c => c.id === value);

  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const wrapRef = React.useRef(null);

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
            {merged.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(c.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: c.id === value ? 'var(--ivory)' : 'transparent',
                  border: 0, borderBottom: '1px solid var(--line-soft)', fontSize: 14,
                  color: 'var(--ink)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                <Dot color={c.color} />
                {categoryLabel(c, t)}
                {c.custom && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>{t('kategori.kustomBadge')}</span>}
                {c.id === value && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--sage)' }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}

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
    </div>
  );
}
