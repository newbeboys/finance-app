import React from 'react';
import { PinDots, Numpad, screenStyle, brandStyle, subtitleStyle, errorStyle, linkBtnStyle } from './PinPad';
import { verifyPin } from '../lib/pin';
import { isBiometricAvailable, authenticateBiometric } from '../lib/biometric';

const MAX_ATTEMPTS = 5;

// Layar kunci yang muncul setiap aplikasi dibuka saat PIN aktif.
export default function PinLock({ onUnlock, onForgot, biometricEnabled = false }) {
  const [entry, setEntry] = React.useState('');
  const [error, setError] = React.useState('');
  const [shake, setShake] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const [locked5x, setLocked5x] = React.useState(false);
  const [bioAvailable, setBioAvailable] = React.useState(false);
  const promptedRef = React.useRef(false);

  // Saat layar muncul: jika biometrik aktif & tersedia → prompt sidik jari otomatis
  React.useEffect(() => {
    if (!biometricEnabled || promptedRef.current) return;
    promptedRef.current = true;
    let alive = true;
    (async () => {
      const ok = await isBiometricAvailable();
      if (!alive) return;
      setBioAvailable(ok);
      if (ok && await authenticateBiometric()) { if (alive) onUnlock?.(); }
    })();
    return () => { alive = false; };
  }, [biometricEnabled, onUnlock]);

  const tryBiometric = async () => {
    if (await authenticateBiometric()) onUnlock?.();
  };

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setEntry('');
  };

  // Proses saat 6 digit terisi
  React.useEffect(() => {
    if (entry.length !== 6 || locked5x) return;
    const pin = entry;
    const t = setTimeout(() => {
      if (verifyPin(pin)) { onUnlock?.(); return; }
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) {
        setLocked5x(true);
        fail('Terlalu banyak percobaan, silakan login ulang');
        setTimeout(() => onForgot?.(), 1200);
      } else {
        fail('PIN salah, coba lagi');
      }
    }, 120);
    return () => clearTimeout(t);
  }, [entry, attempts, locked5x, onUnlock, onForgot]);

  const onDigit = (d) => { if (!locked5x) setEntry(e => (e.length < 6 ? e + d : e)); };
  const onDelete = () => { setError(''); setEntry(e => e.slice(0, -1)); };

  return (
    <div style={screenStyle}>
      <div style={{ fontSize: 30, marginBottom: 14 }} aria-hidden>🔒</div>
      <div style={brandStyle}>FinanceApp</div>
      <div style={subtitleStyle}>Masukkan PIN</div>

      <div style={{ margin: '30px 0 0' }}>
        <PinDots filled={entry.length} shake={shake} />
      </div>
      <div style={{ ...errorStyle, opacity: error ? 1 : 0 }}>{error || ' '}</div>

      <div style={{ marginTop: 14 }}>
        <Numpad onDigit={onDigit} onDelete={onDelete} />
      </div>

      {bioAvailable && (
        <button type="button" onClick={tryBiometric}
          style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', borderRadius: 24, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ fontSize: 18 }} aria-hidden>👆</span> Gunakan Sidik Jari
        </button>
      )}

      <button type="button" onClick={onForgot} style={{ ...linkBtnStyle, marginTop: bioAvailable ? 18 : 28 }}>
        Lupa PIN?
      </button>
    </div>
  );
}
