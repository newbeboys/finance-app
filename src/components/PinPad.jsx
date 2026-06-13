import React from 'react';

// Suntik keyframes shake sekali saja (tanpa menyentuh CSS global)
if (typeof document !== 'undefined' && !document.getElementById('pin-pad-style')) {
  const el = document.createElement('style');
  el.id = 'pin-pad-style';
  el.textContent =
    '@keyframes pin-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}' +
    '.pin-shake{animation:pin-shake .42s}';
  document.head.appendChild(el);
}

export function PinDots({ length = 6, filled = 0, shake = false }) {
  return (
    <div className={shake ? 'pin-shake' : ''} style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
      {Array.from({ length }).map((_, i) => (
        <span key={i} style={{
          width: 14, height: 14, borderRadius: '50%',
          background: i < filled ? '#fff' : 'transparent',
          border: '2px solid rgba(255,255,255,.45)',
          transition: 'background .15s, border-color .15s',
        }} />
      ))}
    </div>
  );
}

export function Numpad({ onDigit, onDelete }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: 264, margin: '0 auto' }}>
      {keys.map(k => (
        <button key={k} type="button" onClick={() => onDigit(k)} style={padBtn}>{k}</button>
      ))}
      <span />
      <button type="button" onClick={() => onDigit('0')} style={padBtn}>0</button>
      <button type="button" onClick={onDelete} style={padBtn} aria-label="Hapus">⌫</button>
    </div>
  );
}

const padBtn = {
  width: 72, height: 72, borderRadius: '50%',
  background: 'rgba(255,255,255,.07)', color: '#fff',
  border: '1px solid rgba(255,255,255,.13)',
  fontSize: 26, cursor: 'pointer', fontFamily: 'inherit',
  display: 'grid', placeItems: 'center',
  WebkitTapHighlightColor: 'transparent', userSelect: 'none',
};

// ── Style layar gelap fullscreen, dipakai PinLock & PinSetup ──
export const screenStyle = {
  position: 'fixed', inset: 0, zIndex: 2000,
  background: '#0E0F0B', color: '#fff',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 'calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 24px)',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
export const brandStyle = { fontSize: 13, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 6 };
export const subtitleStyle = { fontSize: 20, fontWeight: 600, color: '#fff' };
export const errorStyle = { minHeight: 18, fontSize: 13, color: '#FF8A7A', marginTop: 8, transition: 'opacity .15s', textAlign: 'center' };
export const linkBtnStyle = { background: 'none', border: 0, color: 'rgba(255,255,255,.65)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)' };
