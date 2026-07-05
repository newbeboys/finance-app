import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { logError } from '../lib/errorLogger';
import { IconEye, IconEyeOff } from '../icons';

export function ForgotPasswordPage({ onBack }) {
  const { t } = useTranslation();
  const [step, setStep] = React.useState(1); // 1=email, 2=OTP, 3=password baru, 4=sukses
  const [email, setEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [cooldown, setCooldown] = React.useState(0);

  // Hitung mundur cooldown kirim ulang
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(v => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Auto-redirect ke login 3 detik setelah sukses
  React.useEffect(() => {
    if (step !== 4) return;
    const id = setTimeout(onBack, 3000);
    return () => clearTimeout(id);
  }, [step, onBack]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) {
      setError(err.message);
      // Gagal kirim email reset (user belum login → user_id NULL, email di metadata).
      logError('auth-reset-password', err.message, { email }, 'high');
      return;
    }
    setCooldown(60);
    setStep(2);
  }

  async function handleResendOtp() {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) {
      setError(err.message);
      // Titik yang sama (resetPasswordForEmail) di jalur kirim-ulang.
      logError('auth-reset-password', err.message, { email }, 'high');
      return;
    }
    setCooldown(60);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
    setLoading(false);
    if (err) {
      setError(err.message);
      // Medium: sering karena user salah ketik OTP, bukan murni kegagalan kirim email.
      logError('auth-verify-otp', err.message, { email }, 'medium');
      return;
    }
    setStep(3);
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError(t('lupa.passwordTidakCocok')); return; }
    if (newPassword.length < 6) { setError(t('lupa.passwordMinimal')); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) { setLoading(false); setError(err.message); return; }
    try { await supabase.auth.signOut(); } catch {}
    setLoading(false);
    setTimeout(() => onBack(), 2000);
  }

  const subtitle = {
    1: t('lupa.step1Sub'),
    2: t('lupa.step2Sub'),
    3: t('lupa.step3Sub'),
    4: t('lupa.berhasilSub'),
  }[step];

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            FinanceApp
          </div>
          <h1 className="serif" style={{ fontSize: 30, margin: 0, letterSpacing: '-0.015em' }}>
            {step === 4 ? t('lupa.berhasil') : t('lupa.judul')}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>

        {/* Step 1 — Email */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} style={formStyle}>
            <div>
              <label style={labelStyle}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={loading || !email} style={btnStyle(loading || !email)}>
              {loading ? t('lupa.mengirim') : t('lupa.kirimKode')}
            </button>
            <button type="button" onClick={onBack} style={ghostBtnStyle}>
              {t('lupa.kembali')}
            </button>
          </form>
        )}

        {/* Step 2 — OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} style={formStyle}>
            <div>
              <label style={labelStyle}>{t('lupa.emailTujuan')}</label>
              <input
                type="email"
                value={email}
                readOnly
                style={{ ...inputStyle, color: 'var(--muted)', cursor: 'default' }}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('lupa.kodeOtp')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                autoComplete="one-time-code"
                style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: 18 }}
              />
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={loading || otp.length !== 6} style={btnStyle(loading || otp.length !== 6)}>
              {loading ? t('lupa.memverifikasi') : t('lupa.verifikasi')}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || loading}
              style={ghostBtnStyle}
            >
              {cooldown > 0 ? t('lupa.kirimUlangCooldown', { detik: cooldown }) : t('lupa.kirimUlang')}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setOtp(''); setError(''); }}
              style={{ ...ghostBtnStyle, borderColor: 'transparent', color: 'var(--muted)', fontSize: 13 }}
            >
              {t('lupa.kembali')}
            </button>
          </form>
        )}

        {/* Step 3 — Password Baru */}
        {step === 3 && (
          <form onSubmit={handleUpdatePassword} style={formStyle}>
            <div>
              <label style={labelStyle}>{t('lupa.passwordBaru')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={eyeBtnStyle}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <IconEyeOff size={16} stroke={1.6} /> : <IconEye size={16} stroke={1.6} />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('lupa.konfirmasiPassword')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={eyeBtnStyle}
                  aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showConfirm ? <IconEyeOff size={16} stroke={1.6} /> : <IconEye size={16} stroke={1.6} />}
                </button>
              </div>
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              style={btnStyle(loading || !newPassword || !confirmPassword)}
            >
              {loading ? t('lupa.menyimpan') : t('lupa.simpan')}
            </button>
          </form>
        )}

        {/* Step 4 — Sukses */}
        {step === 4 && (
          <div style={formStyle}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'color-mix(in oklch, var(--ink) 8%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px', fontSize: 26, color: 'var(--ink)',
            }}>
              ✓
            </div>
            <button type="button" onClick={onBack} style={btnStyle(false)}>
              {t('lupa.keLogin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div style={{
      fontSize: 13,
      color: 'var(--terra)',
      background: 'color-mix(in oklch, var(--terra) 10%, transparent)',
      border: '1px solid color-mix(in oklch, var(--terra) 25%, transparent)',
      borderRadius: 10,
      padding: '10px 12px',
      lineHeight: 1.4,
    }}>
      {children}
    </div>
  );
}

const pageStyle = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  background: 'var(--cream)',
};

const cardStyle = {
  width: '100%',
  maxWidth: 420,
  background: 'var(--paper)',
  border: '1px solid var(--line-soft)',
  borderRadius: 20,
  padding: '36px 32px',
  boxShadow: '0 4px 24px rgba(0,0,0,.06)',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const labelStyle = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--ink)',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  fontSize: 14,
  background: 'var(--ivory)',
  border: '1px solid var(--line-soft)',
  borderRadius: 12,
  color: 'var(--ink)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const eyeBtnStyle = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 0,
  padding: 6,
  cursor: 'pointer',
  color: 'var(--muted)',
  display: 'flex',
  alignItems: 'center',
  lineHeight: 0,
  borderRadius: 6,
};

const btnStyle = (disabled) => ({
  width: '100%',
  padding: '13px',
  fontSize: 14,
  fontWeight: 500,
  background: disabled ? 'var(--line)' : 'var(--ink)',
  color: disabled ? 'var(--muted)' : 'var(--cream)',
  border: 0,
  borderRadius: 12,
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 4,
  transition: 'background .15s',
  fontFamily: 'inherit',
});

const ghostBtnStyle = {
  width: '100%',
  padding: '11px',
  fontSize: 13.5,
  fontWeight: 400,
  background: 'transparent',
  color: 'var(--muted)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
