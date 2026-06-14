import React from 'react';

// Penghitung global modal yang sedang terbuka → mendukung modal bertumpuk
// (mis. halaman transaksi berulang + form di dalamnya). Latar baru benar-benar
// dibuka kembali saat modal TERAKHIR ditutup.
let lockCount = 0;
let savedScrollY = 0;

function lock() {
  lockCount += 1;
  if (lockCount > 1) return;                       // sudah dikunci modal lain
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = `-${savedScrollY}px`;  // pertahankan posisi scroll
  document.body.classList.add('modal-open');
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;                        // masih ada modal lain terbuka
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, savedScrollY);                 // kembalikan posisi scroll
}

/**
 * Kunci scroll latar (body) selama sebuah modal/popup terbuka, dan beri tahu
 * CSS untuk menonaktifkan scroll + memunculkan overlay. Aman untuk modal
 * bertumpuk berkat penghitung referensi.
 *
 * @param {boolean} active - true saat modal terbuka, false saat tertutup.
 */
export function useScrollLock(active) {
  React.useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;   // dipanggil saat modal ditutup / komponen unmount
  }, [active]);
}
