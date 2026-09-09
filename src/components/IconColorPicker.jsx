import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScrollLock } from '../hooks/useScrollLock';
import { CatIcon, CUSTOM_CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, IconClose } from '../icons';
import { CUSTOM_COLORS } from '../category-field';

/**
 * Modal pilih ikon + warna kategori kustom — dipakai di CategoryField (saat
 * membuat kategori baru) & EditCategoryModal (saat edit, tunduk cooldown 30
 * hari). Strukturnya meniru MonthYearPicker.jsx (props pattern, backdrop/card
 * style, useScrollLock internal, tombol konfirmasi full-width).
 *
 * Props:
 *  - isOpen
 *  - onClose()
 *  - onConfirm(icon, color)
 *  - initialIcon, initialColor
 */
export function IconColorPicker({ isOpen, onClose, onConfirm, initialIcon, initialColor }) {
  const { t } = useTranslation();
  const [selectedIcon, setSelectedIcon] = React.useState(initialIcon || DEFAULT_CATEGORY_ICON);
  const [selectedColor, setSelectedColor] = React.useState(initialColor || CUSTOM_COLORS[0]);

  useScrollLock(isOpen);

  // Sinkron ulang ke nilai awal setiap kali modal dibuka (kategori yang
  // sedang di-edit bisa berbeda-beda antar pembukaan).
  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedIcon(initialIcon || DEFAULT_CATEGORY_ICON);
    setSelectedColor(initialColor || CUSTOM_COLORS[0]);
  }, [isOpen, initialIcon, initialColor]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        // Lebih tinggi dari EditCategoryModal/DeleteCategoryModal (zIndex 5100) —
        // picker ini dibuka bertumpuk di atas keduanya (lihat EditCategoryModal.jsx),
        // selain dipakai langsung dari CategoryField (form transaksi/anggaran, zIndex jauh lebih rendah).
        zIndex: 5200,
        background: 'rgba(42,44,32,.45)',
        padding: 24,
        animation: 'fade-in .2s ease-out',
      }}
    >
      {/* .card + .modal-sheet = pola modal standar app (lihat transactions.jsx,
          wallets.jsx, AddDebtModal.jsx). WAJIB .modal-sheet: di ≤767px
          .modal-backdrop jadi `display:flex; align-items:flex-end` tanpa
          justify-content, jadi kartu yang tidak 100% lebar akan menempel ke KIRI
          dan menyisakan celah backdrop di kanan. .modal-sheet yang memaksa
          width/max-width 100% + radius atas (bottom sheet), dan di ≥768px memberi
          max-height 88vh + scroll internal di kartu itu sendiri. */}
      <div
        className="card modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(400px, 100%)',
          padding: 20,
          boxShadow: '0 30px 80px -20px rgba(42,44,32,.35)',
          animation: 'rise .25s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em',
          }}>
            {t('category.icon.pickTitle')}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, border: '1px solid var(--line-soft)',
              background: 'var(--paper)', display: 'grid', placeItems: 'center',
              color: 'var(--ink-2)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Baris warna — 8 preset yang sudah ada (CUSTOM_COLORS) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {CUSTOM_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setSelectedColor(col)}
              title={col}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: col, cursor: 'pointer',
                border: selectedColor === col ? '2px solid var(--ink)' : '2px solid transparent',
                outline: selectedColor === col ? '2px solid var(--ivory)' : 'none',
                outlineOffset: '-4px',
              }}
            />
          ))}
        </div>

        {/* Grid ikon — semua kind di CUSTOM_CATEGORY_ICONS, 5 kolom.
            Sengaja TANPA max-height/overflow sendiri: scroll ditangani
            .modal-sheet (kartu) supaya scrollbar tetap di dalam bentuk kartu,
            tidak nyembul dari sudut rounded seperti scroll container bersarang. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}>
          {CUSTOM_CATEGORY_ICONS.map((ic) => {
            const selected = selectedIcon === ic;
            return (
              <button
                key={ic}
                type="button"
                onClick={() => setSelectedIcon(ic)}
                title={ic}
                style={{
                  aspectRatio: '1', borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
                  background: `color-mix(in oklch, ${selectedColor} ${selected ? 22 : 12}%, var(--paper))`,
                  color: selectedColor,
                  border: selected ? '2px solid var(--ink)' : '1px solid var(--line-soft)',
                }}
              >
                <CatIcon kind={ic} size={16} />
              </button>
            );
          })}
        </div>

        {/* Confirm — .modal-actions bikin baris ini sticky di dasar kartu (≥768px)
            supaya tombol tetap terlihat berapapun panjang grid di-scroll. */}
        <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={() => { onConfirm(selectedIcon, selectedColor); onClose(); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'var(--ink)',
              color: 'var(--cream)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              letterSpacing: '.01em',
            }}
          >
            {t('umum.pilih')}
          </button>
        </div>
      </div>
    </div>
  );
}
