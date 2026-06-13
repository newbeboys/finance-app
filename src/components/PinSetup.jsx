import React from 'react';
import { PinDots, Numpad, screenStyle, brandStyle, subtitleStyle, errorStyle } from './PinPad';
import { setPin, verifyPin } from '../lib/pin';

// Layar buat PIN baru. Jika requireCurrent=true (Ubah PIN), verifikasi PIN lama
// dulu sebelum membuat yang baru.
export default function PinSetup({ requireCurrent = false, onComplete, onCancel }) {
  const [stage, setStage] = React.useState(requireCurrent ? 'current' : 'new');
  const [entry, setEntry] = React.useState('');
  const [firstPin, setFirstPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [shake, setShake] = React.useState(false);

  const titles = {
    current: 'Masukkan PIN lama',
    new: 'Buat PIN baru',
    confirm: 'Konfirmasi PIN baru',
  };

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setEntry('');
  };

  React.useEffect(() => {
    if (entry.length !== 6) return;
    const pin = entry;
    const t = setTimeout(() => {
      if (stage === 'current') {
        if (verifyPin(pin)) { setError(''); setEntry(''); setStage('new'); }
        else fail('PIN lama salah');
      } else if (stage === 'new') {
        setFirstPin(pin); setError(''); setEntry(''); setStage('confirm');
      } else { // confirm
        if (pin === firstPin) { setPin(pin); onComplete?.(); }
        else { setFirstPin(''); setStage('new'); fail('PIN tidak cocok, ulangi'); }
      }
    }, 120);
    return () => clearTimeout(t);
  }, [entry, stage, firstPin, onComplete]);

  const onDigit = (d) => setEntry(e => (e.length < 6 ? e + d : e));
  const onDelete = () => { setError(''); setEntry(e => e.slice(0, -1)); };

  return (
    <div style={screenStyle}>
      <button type="button" onClick={onCancel}
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 16px)', right: 18, background: 'none', border: 0, color: 'rgba(255,255,255,.7)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        Batal
      </button>

      <div style={brandStyle}>FinanceApp</div>
      <div style={subtitleStyle}>{titles[stage]}</div>

      <div style={{ margin: '30px 0 0' }}>
        <PinDots filled={entry.length} shake={shake} />
      </div>
      <div style={{ ...errorStyle, opacity: error ? 1 : 0 }}>{error || ' '}</div>

      <div style={{ marginTop: 14 }}>
        <Numpad onDigit={onDigit} onDelete={onDelete} />
      </div>
    </div>
  );
}
