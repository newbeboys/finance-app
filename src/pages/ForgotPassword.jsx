import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { logError } from '../lib/errorLogger';
import { markRecoveryPending, clearRecoveryPending } from '../lib/recoveryFlow';
import { IconEye, IconEyeOff } from '../icons';

// Terjemahkan error Supabase Auth (selalu bahasa Inggris) ke pesan yang jelas
// untuk user. Pesan aslinya tetap dikirim ke logError supaya bisa didebug.
function mapAuthError(err, t) {
  if (!err) return '';
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || err.name || '').toLowerCase();

  // Gagal jaringan dilempar sebagai TypeError dari fetch, bukan AuthError Supabase.
  if (code === 'typeerror' || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return t('lupa.errJaringan');
  }
  if (code === 'otp_expired' || msg.includes('token has expired') || msg.includes('invalid token') || msg.includes('invalid or has expired')) {
    return t('lupa.errOtpSalah');
  }
  // Rate limit Supabase: 1 permintaan OTP per 60 detik.
  if (code.includes('rate_limit') || msg.includes('for security purposes') || msg.includes('rate limit')) {
    return t('lupa.errTerlaluSering');
  }
  if (msg.includes('should be at least') || msg.includes('password should be')) return t('lupa.passwordMinimal');
  if (msg.includes('different from the old password')) return t('lupa.errPasswordSama');
  if (msg.includes('unable to validate email') || msg.includes('user not found')) return t('lupa.errEmailTidakValid');
  return t('lupa.errUmum');
}

// resumeEmail terisi bila app dibuka ulang dengan sesi recovery yang belum tuntas
// (OTP sudah diverifikasi, password belum diganti) — lihat lib/recoveryFlow.js.
// Dalam kondisi itu layar langsung dibuka di step 3, bukan dari input email lagi.
export function ForgotPasswordPage({ onBack, onAuthSuccess, resumeEmail = null }) {
  const { t } = useTranslation();
  const [step, setStep] = React.useState(resumeEmail ? 3 : 1); // 1=email, 2=OTP, 3=password baru, 4=sukses
  const [email, setEmail] = React.useState(resumeEmail || '');
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [cooldown, setCooldown] = React.useState(0);

  // Hitung mundur cooldown kirim ulang
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(v => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Sukses → session dari verifyOtp sudah jadi session penuh, jadi user
  // langsung dibawa ke halaman utama tanpa perlu login ulang.
  React.useEffect(() => {
    if (step !== 4) return;
    const id = setTimeout(() => onAuthSuccess?.(), 2000);
    return () => clearTimeout(id);
  }, [step, onAuthSuccess]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      setCooldown(60);
      setInfo(t('lupa.kodeTerkirim'));
      setStep(2);
    } catch (err) {
      setError(mapAuthError(err, t));
      // Gagal kirim email reset (user belum login → user_id NULL, email di metadata).
      logError('auth-reset-password', err?.message || String(err), { email }, 'high');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      setCooldown(60);
      setInfo(t('lupa.kodeTerkirim'));
    } catch (err) {
      setError(mapAuthError(err, t));
      // Titik yang sama (resetPasswordForEmail) di jalur kirim-ulang.
      logError('auth-reset-password', err?.message || String(err), { email }, 'high');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' });
      if (err) throw err;
      // Sesi recovery sudah aktif tapi password lama MASIH berlaku. Tandai dulu,
      // supaya kalau app ditutup sekarang user dikembalikan ke step 3, bukan Beranda.
      markRecoveryPending(email, data?.user?.id || data?.session?.user?.id);
      setStep(3); // session recovery aktif → field password baru boleh tampil
    } catch (err) {
      setError(mapAuthError(err, t));
      // Medium: sering karena user salah ketik OTP, bukan murni kegagalan kirim email.
      logError('auth-verify-otp', err?.message || String(err), { email }, 'medium');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError(t('lupa.passwordMinimal')); return; }
    if (newPassword !== confirmPassword) { setError(t('lupa.passwordTidakCocok')); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      clearRecoveryPending(); // alur tuntas → sesi boleh dipakai masuk Beranda
      setStep(4); // tetap login — session dari verifyOtp kini jadi session penuh
    } catch (err) {
      setError(mapAuthError(err, t));
      logError('auth-update-password', err?.message || String(err), { email }, 'high');
    } finally {
      setLoading(false);
    }
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
            {info && <InfoBox>{info}</InfoBox>}
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
              onClick={() => { setStep(1); setOtp(''); setError(''); setInfo(''); }}
              style={{ ...ghostBtnStyle, borderColor: 'transparent', color: 'var(--muted)', fontSize: 13 }}
            >
              {t('lupa.kembali')}
            </button>
          </form>
        )}

        {/* Step 3 — Password Baru (hanya muncul setelah OTP terverifikasi) */}
        {step === 3 && (
          <form onSubmit={handleUpdatePassword} style={formStyle}>
            {resumeEmail && <InfoBox>{t('lupa.lanjutkanReset')}</InfoBox>}
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
              <p style={hintStyle}>{t('lupa.passwordMinimal')}</p>
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
            {/* Jalan keluar: tanpa ini user yang membuka app dengan sesi recovery
                tertinggal akan terkunci di layar ini. onBack juga men-signOut. */}
            <button type="button" onClick={onBack} disabled={loading} style={ghostBtnStyle}>
              {t('lupa.batalkan')}
            </button>
          </form>
        )}

        {/* Step 4 — Sukses, user sudah otomatis login */}
        {step === 4 && (
          <div style={formStyle}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'color-mix(in oklch, var(--sage) 16%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px', fontSize: 26, color: 'var(--sage)',
            }}>
              ✓
            </div>
            <button type="button" onClick={() => onAuthSuccess?.()} style={btnStyle(false)}>
              {t('lupa.keBeranda')}
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

function InfoBox({ children }) {
  return (
    <div style={{
      fontSize: 13,
      color: 'var(--sage)',
      background: 'color-mix(in oklch, var(--sage) 10%, transparent)',
      border: '1px solid color-mix(in oklch, var(--sage) 25%, transparent)',
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

const hintStyle = {
  fontSize: 11.5,
  color: 'var(--muted)',
  margin: '6px 0 0',
  lineHeight: 1.4,
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
