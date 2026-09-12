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

// ── Status gerbang keamanan (dipakai di luar hook ini) ───────────────
// Disimpan di level MODUL, bukan state React, dan itu disengaja: pembacanya
// (auto-refetch transaksi) berjalan di dalam handler `visibilitychange`/
// `focus` yang SAMA dengan yang memicu lock. Di titik itu state React belum
// ter-commit, jadi `showPin` masih bernilai lama → refetch akan lolos persis
// saat app mau terkunci. Flag modul berubah sinkron, jadi pembaca yang
// menunda satu tick (lihat pemakaiannya di app.jsx) selalu melihat nilai final.
//
// Sumber kebenarannya tetap App: dia yang memanggil setAppLocked() saat
// memunculkan/menutup PinLock & BiometricLock. Hook ini cuma menampungnya
// supaya modul lain tidak perlu impor dari app.jsx (lingkaran impor).
let appLocked = false;
const lockSubs = new Set();

export function isAppLocked() {
  return appLocked;
}

export function setAppLocked(next) {
  const v = !!next;
  if (v === appLocked) return;
  appLocked = v;
  lockSubs.forEach(fn => { try { fn(v); } catch {} });
}

/** Dipanggil tiap status lock BERUBAH. Mengembalikan fungsi unsubscribe. */
export function subscribeAppLock(fn) {
  lockSubs.add(fn);
  return () => { lockSubs.delete(fn); };
}
