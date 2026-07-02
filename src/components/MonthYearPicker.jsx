import React from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

const monthShort = (locale, mo) =>
  new Date(2024, mo, 1).toLocaleDateString(locale, { month: 'short' });

export function MonthYearPicker({ isOpen, onClose, onConfirm, locale = 'id-ID', initialMonth, initialYear, availableMonthsByYear = {} }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = React.useState(initialMonth ?? now.getMonth());
  const [selectedYear, setSelectedYear] = React.useState(initialYear ?? now.getFullYear());
  const [navYear, setNavYear] = React.useState(initialYear ?? now.getFullYear());

  useScrollLock(isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availableYears = Object.keys(availableMonthsByYear).map(Number).sort((a, b) => a - b);
  const hasRestriction = availableYears.length > 0;

  const prevYear = hasRestriction
    ? availableYears.filter(y => y < navYear).at(-1) ?? null
    : navYear - 1;
  const nextYear = hasRestriction
    ? (availableYears.find(y => y > navYear) ?? null)
    : navYear + 1;

  const confirmLabel = `Pilih ${monthShort(locale, selectedMonth)} ${selectedYear}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(42,44,32,.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        animation: 'fade-in .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ivory)',
          borderRadius: 16,
          padding: 20,
          minWidth: 280,
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 30px 80px -20px rgba(42,44,32,.35)',
          animation: 'rise .25s ease-out',
        }}
      >
        {/* Year navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <button
            onClick={() => prevYear !== null && setNavYear(prevYear)}
            disabled={prevYear === null}
            style={{
              background: 'transparent',
              border: 'none',
              color: prevYear === null ? 'var(--line)' : 'var(--ink)',
              fontWeight: 700,
              fontSize: 18,
              cursor: prevYear === null ? 'default' : 'pointer',
              padding: '4px 12px',
              lineHeight: 1,
              borderRadius: 8,
              fontFamily: 'inherit',
            }}
          >‹</button>

          <span style={{
            fontSize: 11,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            fontWeight: 600,
          }}>
            {navYear}
          </span>

          <button
            onClick={() => nextYear !== null && setNavYear(nextYear)}
            disabled={nextYear === null}
            style={{
              background: 'transparent',
              border: 'none',
              color: nextYear === null ? 'var(--line)' : 'var(--ink)',
              fontWeight: 700,
              fontSize: 18,
              cursor: nextYear === null ? 'default' : 'pointer',
              padding: '4px 12px',
              lineHeight: 1,
              borderRadius: 8,
              fontFamily: 'inherit',
            }}
          >›</button>
        </div>

        {/* Month grid 3×4 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}>
          {Array.from({ length: 12 }, (_, i) => {
            const isSelected = selectedMonth === i && selectedYear === navYear;
            const isAvailable = !hasRestriction || (availableMonthsByYear[navYear] ?? []).includes(i);
            return (
              <button
                key={i}
                onClick={() => { if (isAvailable) { setSelectedMonth(i); setSelectedYear(navYear); } }}
                style={{
                  padding: '10px 0',
                  borderRadius: 10,
                  border: isSelected ? 'none' : '1px solid var(--line-soft)',
                  background: isSelected ? 'var(--ink)' : 'var(--paper)',
                  color: isSelected ? 'var(--cream)' : 'var(--ink)',
                  fontSize: 13.5,
                  fontWeight: isSelected ? 600 : 400,
                  fontFamily: 'inherit',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  opacity: isAvailable ? 1 : 0.4,
                  pointerEvents: isAvailable ? 'auto' : 'none',
                  transition: 'background .15s, color .15s',
                }}
              >
                {monthShort(locale, i)}
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => { onConfirm(selectedMonth, selectedYear); onClose(); }}
          style={{
            width: '100%',
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
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
