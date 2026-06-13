import React from 'react';
import { supabase } from '../supabase';

export function RegisterPage({ onSwitch, onAuthSuccess }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
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
            <h2 className="serif" style={{ fontSize: 26, margin: '0 0 10px', letterSpacing: '-0.01em' }}>Pendaftaran berhasil!</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 24 }}>
              Kami mengirimkan tautan verifikasi ke <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Cek kotak masukmu, lalu masuk.
            </p>
            <button onClick={onSwitch} style={{ ...btnStyle(false), maxWidth: 200, margin: '0 auto' }}>
              Ke halaman Login
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
          <h1 className="serif" style={{ fontSize: 30, margin: 0, letterSpacing: '-0.015em' }}>Buat akun baru</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>Mulai kelola keuanganmu</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nama lengkap</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama kamu"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
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
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
              style={inputStyle}
            />
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
            {loading ? 'Memuat…' : 'Daftar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--muted)' }}>
          Sudah punya akun?{' '}
          <button onClick={onSwitch} style={{ background: 'none', border: 0, color: 'var(--ink)', fontWeight: 500, cursor: 'pointer', fontSize: 13.5, padding: 0, textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>
            Masuk
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
