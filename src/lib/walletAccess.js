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
  const memberships = await fetchSharedMemberships(userId);
  return memberships.map(m => m.walletId);
}

/**
 * Sama seperti fetchSharedWalletIds, tapi ikut membawa PERAN user di tiap
 * dompet bersama ('editor' | 'viewer'). useWallets butuh peran ini untuk
 * menandai dompet mana yang boleh dipakai mencatat transaksi — viewer tidak
 * boleh (record_transaction menolaknya).
 *
 * Kegagalan TIDAK dilempar — alasan sama dengan fetchSharedWalletIds.
 *
 * @param {string} userId
 * @returns {Promise<{walletId: string, role: string}[]>} unik per dompet
 */
export async function fetchSharedMemberships(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('wallet_members')
    .select('wallet_id, role')
    .eq('user_id', userId)
    .eq('status', 'active');   // 'pending' belum, 'left' sudah tidak lagi

  if (error) {
    console.error('[walletAccess] fetchSharedMemberships FAILED:', error.code, error.message);
    return [];
  }

  const byWallet = new Map();
  (data || []).forEach(r => { if (r.wallet_id) byWallet.set(r.wallet_id, r.role); });
  return [...byWallet].map(([walletId, role]) => ({ walletId, role }));
}

/**
 * Boleh-tidaknya user MENGUBAH/MENGHAPUS sebuah transaksi dari klien.
 *
 * Dua syarat, dua-duanya wajib:
 *  1. Transaksi itu dicatat user sendiri. Policy UPDATE/DELETE `transactions`
 *     hanya mengizinkan `user_id = auth.uid()` (keputusan Task 2 #2 — owner
 *     pun tidak bisa override transaksi anggota). Menulis ke baris orang lain
 *     TIDAK menghasilkan error, cuma 0 baris — dan alur hapus/edit di app.jsx
 *     lalu memanggil adjustBalance, sehingga saldo bergeser padahal
 *     transaksinya masih ada.
 *  2. Dompetnya masih bisa ditulis (milik sendiri, atau anggota ber-peran
 *     editor). Bekas anggota / viewer MASIH lolos policy DELETE (cuma cek
 *     user_id), tapi adjust_wallet_balance menolak mereka — hasilnya baris
 *     terhapus sementara saldo owner tidak ikut dibalik.
 *
 * Transaksi tanpa wallet_id (data lama) selalu boleh — tidak ada saldo dompet
 * yang ikut disentuh.
 *
 * @param {object} tx        transaksi format app (dari useTransactions)
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `canWrite`
 */
export function canModifyTransaction(tx, userId, accounts = []) {
  if (!tx || !userId || tx.user_id !== userId) return false;
  if (!tx.wallet_id) return true;
  const wallet = accounts.find(a => a.id === tx.wallet_id);
  return !!wallet && wallet.canWrite === true;
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
