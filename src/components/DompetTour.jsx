import React from 'react';
import { useTranslation } from 'react-i18next';
import { scrollIntoViewAndSettle } from '../lib/scrollSettle';

const TOUR_Z = 900; // di atas BottomNav (100), di bawah modal lain (>=1000/2000/5000)
const CUTOUT_PAD = 8;
const EDGE_MARGIN = 20; // jarak aman tooltip ke tepi atas layar
const BOTTOM_CLEARANCE = 'calc(60px + env(safe-area-inset-bottom, 0px) + 20px)'; // jarak aman ke BottomNav + tepi bawah

// Step 2 (Transaksi pada kartu dompet pertama) hanya ada kalau user sudah
// punya minimal 1 dompet — kasus langka (harusnya selalu ada dompet default),
// tapi tetap dijaga demi konsistensi dengan pola tour lain (skip daripada
// menyorot elemen yang tak ada di DOM).
function buildSteps(hasWallets) {
  const steps = [
    { targetIds: ['wallets-add'], titleKey: 'tour.dompet.tambahBaru.title', descKey: 'tour.dompet.tambahBaru.desc' },
  ];
  if (hasWallets) {
    steps.push({ targetIds: ['wallets-tx-first'], titleKey: 'tour.dompet.lihatTransaksi.title', descKey: 'tour.dompet.lihatTransaksi.desc' });
  }
  return steps;
}

// Gabungkan bounding rect dari beberapa elemen target jadi satu rect (union),
// dipakai kalau sebuah step perlu menyorot lebih dari satu elemen sekaligus.
function getUnionRect(targetIds) {
  let union = null;
  for (const id of targetIds) {
    const el = document.querySelector(`[data-tour="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!union) {
      union = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    } else {
      union.top = Math.min(union.top, r.top);
      union.left = Math.min(union.left, r.left);
      union.right = Math.max(union.right, r.right);
      union.bottom = Math.max(union.bottom, r.bottom);
    }
  }
  if (!union) return null;
  return { top: union.top, left: union.left, width: union.right - union.left, height: union.bottom - union.top };
}

// Smart half-screen positioning: taruh tooltip di sisi layar yang berlawanan
// dengan posisi target (bukan nempel di sebelahnya), supaya tak pernah
// menutupi elemen yang sedang disorot — sengaja tidak presisi per-piksel
// supaya tetap aman terhadap resize/scroll.
function tooltipAnchorStyle(rect) {
  const targetCenterY = rect.top + rect.height / 2;
  const inTopHalf = targetCenterY < window.innerHeight / 2;
  return inTopHalf
    ? { bottom: BOTTOM_CLEARANCE, top: 'auto' }
    : { top: EDGE_MARGIN, bottom: 'auto' };
}

export default function DompetTour({ isActive, onComplete, hasWallets = false }) {
  const { t } = useTranslation();
  const STEPS = React.useMemo(() => buildSteps(hasWallets), [hasWallets]);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rect, setRect] = React.useState(null);

  // Sengaja TIDAK pakai useScrollLock: tour ini justru butuh background bisa
  // discroll (baik oleh scrollIntoView otomatis maupun user manual) supaya
  // target di bawah fold kelihatan. Spotlight/tooltip tetap sinkron karena
  // di-update live lewat listener scroll/resize di effect bawah.
  React.useEffect(() => {
    if (isActive) setStepIndex(0);
  }, [isActive]);

  const step = STEPS[stepIndex];

  // Cari elemen target (via data-tour), scroll ke tengah viewport, TUNGGU scroll
  // benar-benar berhenti, baru ukur union rect-nya. Retry beberapa frame kalau
  // elemen belum ter-mount saat step berganti.
  React.useEffect(() => {
    if (!isActive || !step) return undefined;
    let raf; let tries = 0;
    let cancelSettle;

    const measure = () => setRect(getUnionRect(step.targetIds));

    // Listener live cuma dipasang SETELAH scroll-into-view settle, supaya
    // pergerakan scroll saat animasi berlangsung tak memicu setRect prematur
    // (yang bikin cutout "kedip" di posisi salah).
    const attachLiveListeners = () => {
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
    };

    const findTargets = () => {
      const first = document.querySelector(`[data-tour="${step.targetIds[0]}"]`);
      const union = getUnionRect(step.targetIds);
      if (first && union) {
        setRect(null); // overlay tetap penuh tanpa cutout selama scroll berlangsung
        cancelSettle = scrollIntoViewAndSettle(first, () => {
          measure();
          attachLiveListeners();
        });
      } else if (tries < 20) {
        tries += 1;
        raf = requestAnimationFrame(findTargets);
      }
    };
    findTargets();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (cancelSettle) cancelSettle();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isActive, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = React.useCallback(() => {
    setRect(null);
    onComplete && onComplete();
  }, [onComplete]);

  const handleNext = () => {
    if (stepIndex >= STEPS.length - 1) finish();
    else setStepIndex(i => i + 1);
  };

  React.useEffect(() => {
    if (!isActive) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive, finish]);

  if (!isActive || !step) return null;

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      {/* Lapisan penuh layar: blokir semua interaksi latar selama tour aktif */}
      <div style={{ position: 'fixed', inset: 0, zIndex: TOUR_Z, background: 'rgba(0,0,0,.6)' }} />

      {/* Spotlight: cutout terang di sekitar target, pakai trik box-shadow (tanpa lib eksternal) */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - CUTOUT_PAD,
            left: rect.left - CUTOUT_PAD,
            width: rect.width + CUTOUT_PAD * 2,
            height: rect.height + CUTOUT_PAD * 2,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.6)',
            zIndex: TOUR_Z + 1,
            pointerEvents: 'none',
            transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease',
          }}
        />
      )}

      {rect && (
        <div
          role="dialog"
          aria-live="polite"
          style={{
            position: 'fixed',
            ...tooltipAnchorStyle(rect),
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: TOUR_Z + 2,
            width: 'min(280px, calc(100vw - 24px))',
            maxHeight: '40vh',
            overflowY: 'auto',
            background: 'var(--paper)',
            color: 'var(--ink)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: 12,
            boxSizing: 'border-box',
            boxShadow: '0 12px 32px -8px rgba(0,0,0,.45)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, letterSpacing: '.04em' }}>
            {t('tour.langkah', { current: stepIndex + 1, total: STEPS.length })}
          </div>
          <div className="serif" style={{ fontSize: 16, fontWeight: 600, marginBottom: 3 }}>{t(step.titleKey)}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.4, marginBottom: 10 }}>{t(step.descKey)}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <button
              onClick={finish}
              style={{ padding: '6px 9px', background: 'transparent', color: 'var(--muted)', border: 0, fontSize: 12.5 }}
            >
              {t('tour.lewati')}
            </button>
            <button
              onClick={handleNext}
              style={{ padding: '7px 14px', background: 'var(--ink)', color: 'var(--cream)', border: 0, borderRadius: 10, fontSize: 12.5, fontWeight: 500 }}
            >
              {isLast ? t('tour.selesai') : t('tour.lanjut')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
