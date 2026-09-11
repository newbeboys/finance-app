import { supabase } from '../supabase';

/**
 * Daftar id dompet BERSAMA yang boleh diakses user (Fitur B).
 *
 * Hanya dompet milik ORANG LAIN yang dibagikan ke user ini — dompet miliknya
 * sendiri TIDAK ikut, karena pemanggil sudah menyaringnya lewat `user_id`.
 * Pemisahan ini disengaja: dompet sendiri bisa disaring dengan `user_id=eq.X`
 * yang otomatis ikut mencakup dompet yang BARU dibuat nanti, sedangkan dompet
 * bersama butuh daftar id eksplisit (tidak ada kolom di `wallets` yang bisa
 * dipakai memfilter "dibagikan ke saya").
 *
 * Kenapa daftar id, bukan mengandalkan RLS saja: filter realtime Supabase
 * (`postgres_changes`) tidak mengerti konsep keanggotaan — dia cuma bisa
 * membandingkan satu kolom. Jadi daftar id ini memang harus ada di klien untuk
 * menyusun filter `id=in.(...)`, dan sekalian dipakai sebagai penyaring query
 * (defense in depth, sejalan konvensi repo: selalu batasi di klien JUGA,
 * tidak cuma mengandalkan RLS).
 *
 * Kegagalan TIDAK dilempar: fitur berbagi adalah tambahan, jadi kalau query ini
 * gagal user tetap harus bisa memakai dompetnya sendiri seperti biasa. Daftar
 * kosong = app berperilaku persis seperti sebelum Fitur B ada.
 *
 * @param {string} userId
 * @returns {Promise<string[]>} uuid dompet bersama, sudah unik
 */
export async function fetchSharedWalletIds(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('wallet_members')
    .select('wallet_id')
    .eq('user_id', userId)
    .eq('status', 'active');   // 'pending' belum, 'left' sudah tidak lagi

  if (error) {
    console.error('[walletAccess] fetchSharedWalletIds FAILED:', error.code, error.message);
    return [];
  }

  return [...new Set((data || []).map(r => r.wallet_id).filter(Boolean))];
}

/**
 * Rangkai filter PostgREST `.or()` untuk "milik saya ATAU dompet bersama".
 *
 * Dipakai lewat `query.or(orFilter(...))`. Mengembalikan null bila tidak ada
 * dompet bersama — pemanggil lalu memakai `.eq('user_id', userId)` biasa,
 * yang lebih murah dan persis perilaku lama.
 *
 * @param {string} userId
 * @param {string[]} sharedIds
 * @param {string} walletCol nama kolom dompet di tabel target ('id' di `wallets`,
 *                           'wallet_id' di `transactions`)
 */
export function sharedOrFilter(userId, sharedIds, walletCol) {
  if (!sharedIds.length) return null;
  // uuid tidak pernah mengandung koma/kurung, jadi aman digabung tanpa quoting.
  return `user_id.eq.${userId},${walletCol}.in.(${sharedIds.join(',')})`;
}
