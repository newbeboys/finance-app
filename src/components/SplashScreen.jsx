import React from 'react';
import logo from '../assets/animation/splash-screen.png';

/**
 * Splash screen animasi — lapisan pertama saat app dibuka.
 * Urutan: logo drop+bounce (0.9s) → nama app slide-up+fade (delay 0.9s)
 *         → tagline fade (delay 1.2s). Total tahan 2.5s lalu fade-out 0.3s.
 *
 * onDone() dipanggil tepat saat fade-out selesai → parent melepas splash
 * dan halaman berikutnya (sudah ter-mount di belakang) tampil mulus.
 */
export default function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    const tFade = setTimeout(() => setLeaving(true), 2200); // mulai fade-out
    const tDone = setTimeout(() => { if (onDone) onDone(); }, 2500); // selesai
    return () => { clearTimeout(tFade); clearTimeout(tDone); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0f0f1a',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.3s ease',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <style>{KEYFRAMES}</style>

      <img
        src={logo}
        alt="FinanceApp"
        style={{
          width: 180,
          height: 180,
          objectFit: 'contain',
          animation: 'splashDropBounce 0.9s ease-in both',
          willChange: 'transform, opacity',
        }}
      />

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: 0.3,
          animation: 'splashSlideUpFade 0.5s ease 0.9s both',
        }}
      >
        FinanceApp
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'rgba(255, 255, 255, 0.55)',
          letterSpacing: 0.5,
          animation: 'splashFadeIn 0.5s ease 1.2s both',
        }}
      >
        Less Spending · More Living
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes splashDropBounce {
  0%   { transform: translateY(-300px); opacity: 0; }
  60%  { transform: translateY(0px);    opacity: 1; }
  75%  { transform: translateY(-20px); }
  90%  { transform: translateY(5px); }
  100% { transform: translateY(0px); }
}
@keyframes splashSlideUpFade {
  0%   { transform: translateY(30px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}
@keyframes splashFadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
`;
