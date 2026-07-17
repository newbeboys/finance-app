import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import './RestorePurchaseButton.css';

// onRestore harus me-resolve dengan { hasPro: boolean } jika berhasil,
// atau melempar error untuk kegagalan nyata (network error, dll).
export function RestorePurchaseButton({ onRestore }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error | web
  const [hasPro, setHasPro] = useState(false);

  const handleRestore = async () => {
    if (status === 'loading') return;
    if (!Capacitor.isNativePlatform()) {
      // RevenueCat cuma jalan di Android — jangan panggil onRestore (yang ujungnya
      // memanggil rc.restorePurchases()) sama sekali di web.
      setStatus('web');
      setTimeout(() => setStatus('idle'), 3500);
      return;
    }
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
    web:     'Upgrade lewat aplikasi Android',
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
