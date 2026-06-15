import React from 'react';
import { useTranslation } from 'react-i18next';
import { screenStyle, brandStyle, subtitleStyle, errorStyle, linkBtnStyle } from './PinPad';
import { isBiometricAvailable, authenticateBiometric } from '../lib/biometric';

// Layar kunci biometrik (metode tunggal — tanpa fallback PIN).
// Muncul setiap app dibuka saat biometrik adalah metode keamanan aktif.
// Prompt sidik jari otomatis saat layar tampil; tidak ada batas waktu.
export default function BiometricLock({ onSuccess, onEscape }) {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const promptedRef = React.useRef(false);

  const runAuth = React.useCallback(async () => {
    setBusy(true);
    setStatus('');
    const avail = await isBiometricAvailable();
    if (!avail) {
      setStatus(t('keamanan.biometrikTidakTersedia2'));
      setBusy(false);
      return;
    }
    const ok = await authenticateBiometric();
    setBusy(false);
    if (ok) onSuccess?.();
    else setStatus(t('keamanan.verifikasGagal'));
  }, [onSuccess]);

  // Prompt otomatis sekali saat layar pertama muncul
  React.useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;
    runAuth();
  }, [runAuth]);

  return (
    <div style={screenStyle}>
      <div style={{ fontSize: 30, marginBottom: 14 }} aria-hidden>🔒</div>
      <div style={brandStyle}>FinanceApp</div>
      <div style={subtitleStyle}>{t('keamanan.verifikasiSidikJari')}</div>

      <div style={{ fontSize: 72, margin: '34px 0 6px' }} aria-hidden>👆</div>
      <div style={{ ...errorStyle, opacity: status ? 1 : 0 }}>{status || ' '}</div>

      <button
        type="button"
        onClick={runAuth}
        disabled={busy}
        style={{
          marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', background: busy ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.10)',
          color: '#fff', border: '1px solid rgba(255,255,255,.18)', borderRadius: 26,
          fontSize: 14.5, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden>👆</span>
        {busy ? t('keamanan.memverifikasi') : t('keamanan.cobaLagi')}
      </button>

      <button type="button" onClick={onEscape} style={{ ...linkBtnStyle, marginTop: 26 }}>
        {t('keamanan.tidakBisaBiometrik')}
      </button>
    </div>
  );
}
