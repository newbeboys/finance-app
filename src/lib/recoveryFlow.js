// ── Penanda alur reset password yang belum tuntas ──────────────────────
// verifyOtp({ type: 'recovery' }) langsung membuat session penuh di localStorage,
// PADAHAL password lama masih berlaku sampai updateUser() dipanggil. Kalau user
// menutup app di antara dua langkah itu, saat dibuka lagi Supabase mengembalikan
// session yang valid dan user masuk ke Beranda tanpa pernah mengganti password.
//
// Penanda di bawah ini menutup celah tersebut: ditulis SETELAH verifyOtp sukses,
// dihapus SETELAH updateUser sukses (atau saat user membatalkan alurnya). Selama
// penanda ada dan cocok dengan user sesi aktif, app.jsx menahan user di layar
// "set password baru" alih-alih meloloskannya ke Beranda.
//
// Disimpan bersama user_id supaya penanda basi (mis. sesi lain di perangkat yang
// sama) tidak ikut memblokir login user yang berbeda.

const KEY = 'finance_recovery_pending';

// Tandai: OTP sudah terverifikasi, password BELUM diganti.
export function markRecoveryPending(email, userId) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: email || '', userId: userId || '' }));
  } catch {}
}

// Baca penanda. Mengembalikan { email, userId } atau null bila tidak ada/rusak.
export function getRecoveryPending() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.userId) return null;
    return { email: String(parsed.email || ''), userId: String(parsed.userId) };
  } catch {
    return null;
  }
}

// Hapus penanda — dipanggil saat password berhasil diganti ATAU user membatalkan.
export function clearRecoveryPending() {
  try { localStorage.removeItem(KEY); } catch {}
}
