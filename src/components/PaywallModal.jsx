import React from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

// ── Paywall (Fitur Khusus Pro) ─────────────────────────────────────
// Fase 1: TANPA payment asli. Modal hanya memberi tahu fitur ini khusus
// Pro + satu tombol "Mengerti". JANGAN tambah tombol "Upgrade Sekarang"
// sampai Google Play Billing diimplementasikan di fase berikutnya.
//
// Pakai lewat context supaya bisa dipicu dari mana saja (hook data,
// halaman, modal) tanpa prop-drilling:
//
//   const { openPaywall } = usePaywall();
//   openPaywall('Scan Nota');   // → "Scan Nota adalah fitur khusus Pro."
//
// Untuk pesan kustom (mis. limit kuota tercapai) oper objek dengan
// `message` — modal & visual tetap sama, hanya teks deskripsi diganti:
//   openPaywall({ message: 'Penggunaan transaksi sudah maksimal bulan ini. ...' });

const PaywallContext = React.createContext({
  openPaywall: () => {},
  closePaywall: () => {},
});

export function usePaywall() {
  return React.useContext(PaywallContext);
}

export function PaywallProvider({ children }) {
  const [state, setState] = React.useState(null); // null = tertutup

  // Terima string (nama fitur — pola lama) ATAU objek { featureName, message }.
  const openPaywall = React.useCallback((arg) => {
    if (arg && typeof arg === 'object') {
      setState({ featureName: arg.featureName || '', message: arg.message || '' });
    } else {
      setState({ featureName: arg || '', message: '' });
    }
  }, []);
  const closePaywall = React.useCallback(() => setState(null), []);

  const value = React.useMemo(() => ({ openPaywall, closePaywall }), [openPaywall, closePaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallModal open={state !== null} featureName={state?.featureName} message={state?.message} onClose={closePaywall} />
    </PaywallContext.Provider>
  );
}

// Gembok kecil (gemlock) — menandai fitur terlihat tapi terkunci (Basic).
// Dipakai di tombol scan, tombol tambah wallet, tema font, dll.
// Parent-nya harus position:relative.
export function LockBadge() {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: -6, right: -6,
      width: 16, height: 16, borderRadius: '50%',
      background: 'var(--gold)', color: '#fff',
      display: 'grid', placeItems: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,.3)',
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  );
}

// Modal presentational. Dark/light aware via CSS vars yang sudah ada.
// Terima `open` (dipakai provider) atau `isOpen` (sesuai spec) — alias.
export function PaywallModal({ open, isOpen, featureName, message, onClose }) {
  const visible = open ?? isOpen ?? false;
  useScrollLock(visible);

  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  // Pesan kustom (mis. kuota habis) dipakai apa adanya; selain itu pakai
  // kalimat baku berbasis nama fitur.
  const desc = message
    ? message
    : (featureName
        ? `${featureName} adalah fitur khusus Pro.`
        : 'Fitur ini khusus untuk pengguna Pro.');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(42,44,32,.45)', backdropFilter: 'blur(4px)',
        display: 'grid', placeItems: 'center', padding: 24,
        animation: 'rise .2s ease-out',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(380px, 100%)', padding: 28, textAlign: 'center',
          animation: 'rise .25s ease-out',
          boxShadow: '0 30px 80px -20px rgba(42,44,32,.5)',
        }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            display: 'grid', placeItems: 'center',
            background: 'color-mix(in oklch, var(--gold) 18%, var(--ivory))',
            color: 'var(--gold)', fontSize: 28,
          }}
          aria-hidden
        >
          👑
        </div>

        <div
          style={{
            display: 'inline-block', fontSize: 10.5, fontWeight: 600,
            letterSpacing: '.08em', textTransform: 'uppercase',
            color: 'var(--gold)',
            background: 'color-mix(in oklch, var(--gold) 14%, transparent)',
            padding: '4px 10px', borderRadius: 99, marginBottom: 12,
          }}
        >
          Pro
        </div>

        <div className="serif" style={{ fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Fitur Khusus Pro
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.55 }}>
          {desc}
          {!message && <>{' '}Tingkatkan ke Pro untuk membuka fitur ini tanpa batas.</>}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 22, width: '100%', padding: '13px',
            background: 'var(--ink)', color: 'var(--cream)', border: 0,
            borderRadius: 12, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}

export default PaywallModal;
