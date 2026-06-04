import React from 'react';
import { supabase } from '../supabase';

export function LoginPage({ onSwitch }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>FinanceApp</div>
          <h1 className="serif" style={{ fontSize: 30, margin: 0, letterSpacing: '-0.015em' }}>Selamat datang</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>Masuk untuk melanjutkan ke akunmu</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              placeholder="••••••••"
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
            disabled={loading || !email || !password}
            style={btnStyle(loading || !email || !password)}
          >
            {loading ? 'Memuat…' : 'Masuk'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: 'var(--muted)' }}>
          Belum punya akun?{' '}
          <button onClick={onSwitch} style={{ background: 'none', border: 0, color: 'var(--ink)', fontWeight: 500, cursor: 'pointer', fontSize: 13.5, padding: 0, textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>
            Daftar sekarang
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
});
