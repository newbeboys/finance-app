import React from 'react';
import { useTranslation } from 'react-i18next';
import Lottie from 'lottie-react';
import goalsAnim from '../assets/animation/goals-animation.json';
import goalsSound from '../assets/sound/goals-sound.wav';
import { playSound } from '../lib/sound';
import { useScrollLock } from '../hooks/useScrollLock';

// Overlay perayaan saat sebuah goal mencapai 100%.
// Animasi diputar sekali (loop:false) + sound berbarengan, lalu hilang
// otomatis saat animasi selesai (onComplete). Tombol "Tutup" untuk skip.
export function GoalCompleteOverlay({ onClose }) {
  const { t } = useTranslation();
  useScrollLock(true);
  React.useEffect(() => {
    playSound(goalsSound);
  }, []);

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={animWrapStyle}>
          <Lottie
            animationData={goalsAnim}
            loop={false}
            autoplay={true}
            onComplete={onClose}
            style={{ width: '100%', height: '100%' }}
            rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          />
        </div>
        <div className="serif" style={titleStyle}>{t('tabungan.selamatTercapai')}</div>
        <button type="button" onClick={onClose} style={btnStyle}>{t('umum.tutup')}</button>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'rgba(42,44,32,.45)',
  backdropFilter: 'blur(4px)',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  animation: 'rise .25s ease-out',
};

const cardStyle = {
  width: 'min(360px, 100%)',
  background: 'var(--paper)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  padding: '24px 24px 28px',
  textAlign: 'center',
  boxShadow: '0 30px 80px -20px rgba(42,44,32,.4)',
  animation: 'rise .3s ease-out',
};

const animWrapStyle = {
  width: 220,
  height: 220,
  maxWidth: '60vw',
  maxHeight: '60vw',
  margin: '0 auto 8px',
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  margin: '4px 0 20px',
};

const btnStyle = {
  width: '85%',
  maxWidth: 280,
  height: 46,
  fontSize: 14.5,
  fontWeight: 600,
  background: 'var(--sage)',
  color: 'var(--cream)',
  border: 0,
  borderRadius: 23,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
