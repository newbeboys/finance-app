import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { IconEye, IconEyeOff } from '../icons';

export function RegisterPage({ onSwitch, onAuthSuccess }) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: 'https://newbeboys.github.io/financeapp-email-verification/email-confirmed.html',
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      onAuthSuccess?.(); // register berhasil → tampilkan onboarding (saat session aktif)
    }
  }

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'color-mix(in oklch, var(--sage) 15%, transparent)', border: '1px solid color-mix(in oklch, var(--sage) 30%, transparent)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'var(--sage)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="serif" style={{ fontSize: 26, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{t('auth.pendaftaranBerhasil')}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 24 }}>
              {t('auth.linkVerifikasi', { email })}
            </p>
            <button onClick={onSwitch} style={{ ...btnStyle(false), maxWidth: 200, margin: '0 auto' }}>
              {t('auth.keHalamanLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>FinanceApp</div>
          <h1 className="serif" style={{ fontSize: 30, margin: 0, letterSpacing: '-0.015em' }}>{t('auth.buatAkunBaru')}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{t('auth.mulaiKelolaKeuangan')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('auth.namaLengkap')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('auth.namaKamu')}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('auth.password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.minPassword')}
                minLength={6}
                required
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

          {error && (
            <div style={{ fontSize: 13, color: 'var(--terra)', background: 'color-mix(in oklch, var(--terra) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--terra) 25%, transparent)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name || !email || !password}
            style={btnStyle(loading || !name || !email || !password)}
          >
            {loading ? t('auth.memuat') : t('auth.daftar')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--muted)' }}>
          {t('auth.sudahPunyaAkun')}{' '}
          <button onClick={onSwitch} style={{ background: 'none', border: 0, color: 'var(--ink)', fontWeight: 500, cursor: 'pointer', fontSize: 13.5, padding: 0, textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>
            {t('auth.masuk')}
          </button>
        </div>
      </div>
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
  display: 'block',
});
