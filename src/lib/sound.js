// Preferensi "Animasi & Suara" dari halaman Pengaturan (default ON).
// Satu sumber kebenaran dipakai gate suara (di sini) & animasi goals (app.jsx).
export function isSoundAnimEnabled() {
  try { return localStorage.getItem('animasiSuaraAktif') !== 'false'; }
  catch { return true; }
}

// Helper kecil untuk memutar sound effect lewat objek Audio() biasa.
// Aman dipanggil di mana saja: error (mis. autoplay diblokir browser
// sebelum ada interaksi user) ditelan diam-diam agar tak mengganggu UI.
export function playSound(src, volume = 1) {
  if (!isSoundAnimEnabled()) return; // toggle OFF → tak ada suara apa pun
  try {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* abaikan — sound bersifat opsional */
  }
}
