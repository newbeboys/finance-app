import React, { useState } from 'react';
import './RestorePurchaseButton.css';

export function RestorePurchaseButton({ onRestore }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleRestore = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await onRestore?.();
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
    success: '✓ Berhasil dipulihkan',
    error:   'Tidak ditemukan — coba lagi',
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
