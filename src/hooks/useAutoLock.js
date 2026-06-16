import React from 'react';

// ── Auto-lock: kunci ulang aplikasi setelah lama di background ───────
// Memantau perpindahan foreground ↔ background lewat Page Visibility API
// (berfungsi di WebView Capacitor maupun browser biasa). Saat aplikasi
// kembali ke depan setelah berada di background ≥ `timeoutMs`, panggil
// `onLock` untuk memunculkan kembali gerbang keamanan (PIN/biometrik).

// Konstanta timeout (tidak di-hardcode di pemanggil) — 1 menit.
export const AUTO_LOCK_MS = 60 * 1000;

export function useAutoLock(onLock, { timeoutMs = AUTO_LOCK_MS, enabled = true } = {}) {
  // Waktu (epoch ms) saat app terakhir masuk background; null = sedang di depan.
  const hiddenAtRef = React.useRef(null);
  // Simpan callback terbaru di ref agar listener tak perlu re-attach tiap render.
  const onLockRef = React.useRef(onLock);
  React.useEffect(() => { onLockRef.current = onLock; }, [onLock]);

  React.useEffect(() => {
    if (!enabled) return;

    const goBackground = () => {
      if (hiddenAtRef.current == null) hiddenAtRef.current = Date.now();
    };
    const goForeground = () => {
      const since = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (since != null && Date.now() - since >= timeoutMs) {
        onLockRef.current?.();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') goBackground();
      else goForeground();
    };

    // visibilitychange = sinyal utama (home button / pindah app di Android).
    // blur/focus = cadangan untuk kasus desktop (pindah jendela/aplikasi lain).
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', goBackground);
    window.addEventListener('focus', goForeground);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', goBackground);
      window.removeEventListener('focus', goForeground);
    };
  }, [enabled, timeoutMs]);
}
