const SETTLE_DELAY = 100; // scroll dianggap berhenti kalau tak ada event scroll selama ini
const MAX_WAIT = 500; // jaring pengaman kalau browser tak pernah kirim event scroll (target sudah di posisi akhir)

// Scroll elemen ke tengah viewport lalu tunggu sampai posisi scroll benar-benar
// berhenti sebelum memanggil onSettle — supaya spotlight/tooltip tour tidak
// dihitung dari koordinat yang masih di tengah animasi smooth-scroll.
// Return: fungsi cancel (panggil saat unmount/step berganti supaya onSettle
// yang sudah telat tidak dieksekusi lagi).
export function scrollIntoViewAndSettle(el, onSettle) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  let settleTimer;
  let safetyTimer;
  let cancelled = false;

  const cleanup = () => {
    window.removeEventListener('scroll', onScroll, true);
    clearTimeout(settleTimer);
    clearTimeout(safetyTimer);
  };

  const finish = () => {
    if (cancelled) return;
    cleanup();
    onSettle();
  };

  const onScroll = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(finish, SETTLE_DELAY);
  };

  window.addEventListener('scroll', onScroll, true);
  settleTimer = setTimeout(finish, SETTLE_DELAY);
  safetyTimer = setTimeout(finish, MAX_WAIT);

  return () => { cancelled = true; cleanup(); };
}
