import React from 'react';
import Lottie from 'lottie-react';
import { useTranslation } from 'react-i18next';
import firstAnim from '../assets/animation/first-onboarding.json';
import secondAnim from '../assets/animation/second-boarding.json';
import lastAnim from '../assets/animation/kucing_tidur.json';

const SLIDE_ANIMS = [firstAnim, secondAnim, lastAnim];
const SLIDE_KEYS = ['slide1', 'slide2', 'slide3'];

const SWIPE_THRESHOLD = 50; // px geseran minimal untuk pindah layar

export default function OnboardingScreen({ onDone }) {
  const { t } = useTranslation();
  const [index, setIndex] = React.useState(0);
  const [drag, setDrag] = React.useState(0);      // offset jari saat menggeser (px)
  const dragging = React.useRef(false);
  const startX = React.useRef(0);
  const widthRef = React.useRef(1);

  const isLast = index === SLIDE_KEYS.length - 1;

  const goTo = React.useCallback((i) => {
    setIndex((cur) => Math.max(0, Math.min(SLIDES.length - 1, i ?? cur)));
  }, []);

  const handleNext = () => {
    if (isLast) onDone();
    else goTo(index + 1);
  };

  // ── Swipe gesture ──────────────────────────────────────────────
  const onTouchStart = (e) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    widthRef.current = e.currentTarget.offsetWidth || 1;
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    let dx = e.touches[0].clientX - startX.current;
    // Beri hambatan saat menggeser melewati ujung pertama/terakhir
    if ((index === 0 && dx > 0) || (isLast && dx < 0)) dx *= 0.35;
    setDrag(dx);
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag <= -SWIPE_THRESHOLD) goTo(index + 1);
    else if (drag >= SWIPE_THRESHOLD) goTo(index - 1);

    setDrag(0);
  };

  // Posisi track: geser per-index + ikut jari saat menyeret
  const trackStyle = {
    display: 'flex',
    height: '100%',
    transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`,
    transition: dragging.current ? 'none' : 'transform .38s cubic-bezier(.22,.61,.36,1)',
    willChange: 'transform',
  };

  return (
    <div style={pageStyle}>
      {/* Tombol Lewati (pojok kanan atas) */}
      <button type="button" onClick={onDone} style={skipStyle} aria-label={t('onboarding.lewati')}>
        {t('onboarding.lewati')}
      </button>

      {/* ── Tengah: animasi + judul + deskripsi (flex:1, terpusat) ── */}
      <div
        style={viewportStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div style={trackStyle}>
          {SLIDE_KEYS.map((key, i) => (
            <div key={i} style={slideStyle}>
              <div style={animWrapStyle}>
                <Lottie
                  animationData={SLIDE_ANIMS[i]}
                  loop={true}
                  autoplay={true}
                  style={{ width: '100%', height: '100%' }}
                  rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
                />
              </div>
              <h1 className="serif" style={titleStyle}>{t(`onboarding.${key}Judul`)}</h1>
              <p style={descStyle}>{t(`onboarding.${key}Teks`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bawah: dot indicator + tombol aksi ── */}
      <div style={footerStyle}>
        <div style={dotsStyle}>
          {SLIDE_KEYS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              style={{
                ...dotStyle,
                background: i === index ? 'var(--sage)' : 'var(--line)',
                opacity: i === index ? 1 : 0.55,
              }}
            />
          ))}
        </div>

        <button type="button" onClick={handleNext} style={ctaStyle}>
          {isLast ? t('onboarding.mulai') : t('onboarding.lanjut')}
        </button>
      </div>
    </div>
  );
}

// ── Styles (memakai token tema app agar mengikuti dark/light) ─────
const pageStyle = {
  position: 'fixed',
  inset: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--cream)',
  color: 'var(--ink)',
  paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
  zIndex: 1000,
  overflow: 'hidden',
};

const skipStyle = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
  right: 18,
  zIndex: 2,
  background: 'none',
  border: 0,
  padding: '8px 6px',
  fontSize: 13.5,
  fontWeight: 500,
  color: 'var(--muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// Area tengah yang bisa diswipe — mengisi sisa tinggi & memusatkan konten
const viewportStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  touchAction: 'pan-y',
};

const slideStyle = {
  flex: '0 0 100%',
  minWidth: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 24px',
  boxSizing: 'border-box',
};

// Lottie dibatasi maksimum 220×220 dan menyusut di layar sempit
const animWrapStyle = {
  width: 220,
  height: 220,
  maxWidth: '62vw',
  maxHeight: '62vw',
  display: 'grid',
  placeItems: 'center',
  marginBottom: 24,
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.25,
  margin: 0,
  textAlign: 'center',
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
};

const descStyle = {
  fontSize: 14,
  lineHeight: 1.5,
  color: 'var(--muted)',
  textAlign: 'center',
  margin: '10px 0 0',
  maxWidth: 320,
};

// Footer menempel di bawah, tidak ikut menyusut
const footerStyle = {
  flexShrink: 0,
  padding: '16px 24px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
};

const dotsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

// Dot bulat sempurna 8×8 — bedakan aktif via warna, bukan bentuk
const dotStyle = {
  width: 8,
  height: 8,
  flexShrink: 0,
  border: 0,
  padding: 0,
  borderRadius: '50%',
  cursor: 'pointer',
  transition: 'background .3s ease, opacity .3s ease',
};

const ctaStyle = {
  width: '85%',
  maxWidth: 420,
  height: 48,
  fontSize: 15,
  fontWeight: 600,
  background: 'var(--sage)',
  color: 'var(--cream)',
  border: 0,
  borderRadius: 24,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.01em',
  transition: 'transform .12s ease, filter .15s ease',
};
