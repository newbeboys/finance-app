import React, { useState } from 'react';
import './RestorePurchaseButton.css';

// onRestore harus me-resolve dengan { hasPro: boolean } jika berhasil,
// atau melempar error untuk kegagalan nyata (network error, dll).
export function RestorePurchaseButton({ onRestore }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [hasPro, setHasPro] = useState(false);

  const handleRestore = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      const result = await onRestore?.();
      setHasPro(result?.hasPro ?? false);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const LABELS = {
    idle:    'Pulihkan Pembelian',
    loading: 'Memeriksa...',
    success: hasPro ? '✓ Berhasil dipulihkan' : 'Tidak ada langganan untuk dipulihkan',
    error:   'Gagal memeriksa — coba lagi',
  };

  return (
    <button
      className={`rpb rpb--${status}`}
      onClick={handleRestore}
      disabled={status === 'loading'}
    >
      {LABELS[status]}
    </button>
  );
}

export default RestorePurchaseButton;
