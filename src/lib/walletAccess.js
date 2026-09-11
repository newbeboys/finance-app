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
 * Boleh-tidaknya user MENGHAPUS sebuah transaksi.
 *
 * Dua syarat — cerminan RPC delete_transaction (migrasi 20260917000000):
 *  1. dicatat user sendiri (Task 2 #2: owner pun tidak bisa menghapus
 *     transaksi anggota — transaksi orang lain di dompet bersama ikut ada di
 *     daftar klien, tapi tidak boleh ditawari tombol hapus);
 *  2. dompetnya saat ini masih bisa ditulis (milik sendiri / editor).
 *
 * Syarat 2 berlaku sejak keputusan 12 Sep 2026, MENGGANTIKAN Task 2 #3 (dulu
 * viewer / bekas anggota tetap boleh menghapus transaksinya sendiri). Dompet
 * yang aksesnya sudah hilang tidak ada di `accounts` → false. Konsekuensi yang
 * disengaja: transaksi seperti itu tidak bisa dihapus siapa pun sampai owner
 * menaikkan perannya kembali ke editor.
 *
 * `accounts` wajib diteruskan — tanpa itu setiap transaksi ber-dompet ditolak
 * (gagal tertutup, bukan terbuka).
 *
 * @param {object} tx     transaksi format app (dari useTransactions)
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `canWrite`
 */
export function canDeleteTransaction(tx, userId, accounts = []) {
  if (!tx || !userId || tx.user_id !== userId) return false;
  if (!tx.wallet_id) return true;
  const wallet = accounts.find(a => a.id === tx.wallet_id);
  return !!wallet && wallet.canWrite === true;
}

/**
 * Boleh-tidaknya user MENGUBAH sebuah transaksi dari UI.
 *
 * Syaratnya sama persis dengan hapus — update_transaction sejak migrasi
 * 20260917000000 mensyaratkan dompet ASAL dan TUJUAN sama-sama bisa ditulis.
 * Dompet tujuan dijaga terpisah oleh modal edit (hanya menawarkan dompet yang
 * bisa ditulis) dan handleUpdateTransaction di app.jsx.
 *
 * @param {object} tx
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `canWrite`
 */
export function canEditTransaction(tx, userId, accounts = []) {
  return canDeleteTransaction(tx, userId, accounts);
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
 * @param {{excludeDebt?: boolean}} [opts] excludeDebt: cabang dompet bersama
 *   hanya mengambil baris `debt_id IS NULL` — dipakai untuk `transactions`.
 *   Transaksi tertaut hutang/piutang tidak pernah dibagikan ke anggota dompet
 *   (Task 2 #4; policy SELECT sejak migrasi 20260916000000 juga begitu — ini
 *   cerminan klien-nya, defense in depth).
 */
export function sharedOrFilter(userId, sharedIds, walletCol, { excludeDebt = false } = {}) {
  if (!sharedIds.length) return null;
  // uuid tidak pernah mengandung koma/kurung, jadi aman digabung tanpa quoting.
  const inShared = `${walletCol}.in.(${sharedIds.join(',')})`;
  return `user_id.eq.${userId},${excludeDebt ? `and(${inShared},debt_id.is.null)` : inShared}`;
}
