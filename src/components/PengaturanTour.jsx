import React from 'react';
import { useTranslation } from 'react-i18next';
import { scrollIntoViewAndSettle } from '../lib/scrollSettle';

const TOUR_Z = 900; // di atas BottomNav (100), di bawah modal lain (>=1000/2000/5000)
const CUTOUT_PAD = 8;
const EDGE_MARGIN = 20; // jarak aman tooltip ke tepi atas layar
const BOTTOM_CLEARANCE = 'calc(60px + env(safe-area-inset-bottom, 0px) + 20px)'; // jarak aman ke BottomNav + tepi bawah

// Step 1 menyorot kartu "Akun & Paket" (bukan literal dropdown/toggle
// Monthly/6 Bulan/Tahunan — itu cuma muncul di dalam UpgradeModal saat user
// Basic menekan "Upgrade ke Pro", dan tidak pernah tampil sebagai elemen
// statis untuk user Pro). Kartu ini yang paling stabil & konsisten ada di
// kedua tier, jadi dipakai sebagai target "Kelola Langganan".
// data-tour="settings-akun-paket" sengaja ditaruh di root SubscriptionStatus
// (bukan di SettingCard pembungkusnya) supaya cutout TIDAK ikut menyorot
// tombol dev "Set ke Basic/Pro (Testing)" yang dirender sebagai sibling di
// bawahnya saat import.meta.env.DEV.
const STEPS = [
  { targetId: 'settings-akun-paket', titleKey: 'tour.pengaturan.kelolaLangganan.title', descKey: 'tour.pengaturan.kelolaLangganan.desc' },
  { targetId: 'settings-keamanan',   titleKey: 'tour.pengaturan.amankanAplikasi.title', descKey: 'tour.pengaturan.amankanAplikasi.desc' },
  { targetId: null,                  titleKey: 'tour.pengaturan.jelajahiLainnya.title', descKey: 'tour.pengaturan.jelajahiLainnya.desc' },
];

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

export default function PengaturanTour({ isActive, onComplete }) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const targetElRef = React.useRef(null);

  // Sengaja TIDAK pakai useScrollLock: tour ini justru butuh background bisa
  // discroll (baik oleh scrollIntoView otomatis maupun user manual) supaya
  // target di bawah fold kelihatan. Spotlight/tooltip tetap sinkron karena
  // di-update live lewat listener scroll/resize di effect bawah.
  React.useEffect(() => {
    if (isActive) setStepIndex(0);
  }, [isActive]);

  const step = STEPS[stepIndex];

  // Cari elemen target (via data-tour), scroll ke tengah viewport, TUNGGU scroll
  // benar-benar berhenti, baru ukur posisinya. Retry beberapa frame kalau elemen
  // belum ter-mount saat step berganti. Step tanpa targetId (mis. step 3 "Jelajahi
  // Pengaturan Lainnya") tidak punya spotlight, jadi tak perlu dicari elemennya.
  React.useEffect(() => {
    if (!isActive || !step || !step.targetId) {
      setRect(null);
      return undefined;
    }
    let raf; let tries = 0;
    let cancelSettle;

    const measure = () => {
      const el = targetElRef.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
    };

    // Listener live cuma dipasang SETELAH scroll-into-view settle, supaya
    // pergerakan scroll saat animasi berlangsung tak memicu setRect prematur
    // (yang bikin cutout "kedip" di posisi salah).
    const attachLiveListeners = () => {
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
    };

    const findTarget = () => {
      const el = document.querySelector(`[data-tour="${step.targetId}"]`);
      if (el) {
        targetElRef.current = el;
        setRect(null); // overlay tetap penuh tanpa cutout selama scroll berlangsung
        cancelSettle = scrollIntoViewAndSettle(el, () => {
          measure();
          attachLiveListeners();
        });
      } else if (tries < 20) {
        tries += 1;
        raf = requestAnimationFrame(findTarget);
      }
    };
    findTarget();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (cancelSettle) cancelSettle();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isActive, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = React.useCallback(() => {
    setRect(null);
    targetElRef.current = null;
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
  const hasTarget = !!step.targetId;
  const showTooltip = hasTarget ? !!rect : true;

  return (
    <>
      {/* Lapisan penuh layar: blokir semua interaksi latar selama tour aktif */}
      <div style={{ position: 'fixed', inset: 0, zIndex: TOUR_Z, background: 'rgba(0,0,0,.6)' }} />

      {/* Spotlight: cutout terang di sekitar target, pakai trik box-shadow (tanpa lib eksternal).
          Hanya tampil untuk step yang punya target (bukan step "Jelajahi Pengaturan Lainnya"). */}
      {hasTarget && rect && (
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

      {showTooltip && (
        <div
          role="dialog"
          aria-live="polite"
          style={{
            position: 'fixed',
            ...(hasTarget
              ? { ...tooltipAnchorStyle(rect), left: '50%', transform: 'translateX(-50%)' }
              : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
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
