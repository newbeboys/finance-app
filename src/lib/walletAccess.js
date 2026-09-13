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
 * Daftar id dompet yang DIMILIKI user (`wallets.user_id = userId`).
 *
 * KENAPA INI PERLU, padahal `fetchSharedWalletIds` di atas sengaja TIDAK
 * memuat dompet sendiri: alasan "pemanggil sudah menyaringnya lewat user_id"
 * itu benar untuk tabel `wallets` (baris dompet selalu ditulis pemiliknya
 * sendiri, jadi `user_id=eq.me` pasti menemukannya), tapi TIDAK berlaku untuk
 * tabel `transactions` — sejak dompet bersama, baris transaksi di dompet SAYA
 * bisa ditulis ORANG LAIN, dan `user_id`-nya adalah si pencatat, bukan saya.
 * Tanpa daftar ini, query owner (`user_id.eq.me`) tidak akan pernah cocok
 * dengan transaksi anggotanya — owner tidak pernah melihat belanja anggota di
 * dompetnya sendiri, di initial load maupun refetch. (Terverifikasi lewat
 * e2e dompet bersama, 13 Sep 2026; RLS server sudah mengizinkannya lewat
 * `wallet_access_role`, yang kurang cuma permintaannya di sisi klien.)
 *
 * Dipakai `useTransactions` DIGABUNG dengan `fetchSharedWalletIds`, supaya
 * cabang `wallet_id.in.(…)` di klien mencerminkan persis policy SELECT
 * server: `wallet_access_role(wallet_id) IS NOT NULL` = dompet yang saya
 * miliki ATAU dompet yang saya jadi anggota aktifnya.
 *
 * Kegagalan TIDAK dilempar — alasan sama dengan fetchSharedMemberships.
 *
 * @param {string} userId
 * @returns {Promise<string[]>} uuid dompet milik user
 */
export async function fetchOwnedWalletIds(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId);

  if (error) {
    console.error('[walletAccess] fetchOwnedWalletIds FAILED:', error.code, error.message);
    return [];
  }
  return (data || []).map(r => r.id).filter(Boolean);
}

/**
 * Boleh-tidaknya user menghapus transaksi yang DIA CATAT SENDIRI.
 *
 * Dua syarat — cerminan cabang "milik sendiri" di RPC delete_transaction:
 *  1. dicatat user sendiri;
 *  2. dompetnya saat ini masih bisa ditulis (milik sendiri / editor).
 *
 * Syarat 2 berlaku sejak keputusan 12 Sep 2026, MENGGANTIKAN Task 2 #3 (dulu
 * viewer / bekas anggota tetap boleh menghapus transaksinya sendiri). Dompet
 * yang aksesnya sudah hilang tidak ada di `accounts` → false.
 *
 * INI BUKAN gerbang lengkap untuk tombol hapus — sejak 13 Sep 2026 owner juga
 * boleh menghapus transaksi anggotanya, lihat `canDeleteTransaction`. Fungsi
 * ini dipertahankan terpisah untuk pemanggil yang HARUS tetap ketat, yaitu
 * `useDebts.deleteDebt` (lihat catatan di sana).
 *
 * `accounts` wajib diteruskan — tanpa itu setiap transaksi ber-dompet ditolak
 * (gagal tertutup, bukan terbuka).
 *
 * @param {object} tx     transaksi format app (dari useTransactions)
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `canWrite`
 */
export function canDeleteOwnTransaction(tx, userId, accounts = []) {
  if (!tx || !userId || tx.user_id !== userId) return false;
  if (!tx.wallet_id) return true;
  const wallet = accounts.find(a => a.id === tx.wallet_id);
  return !!wallet && wallet.canWrite === true;
}

/**
 * Boleh-tidaknya user MENGHAPUS sebuah transaksi dari UI.
 *
 * Dua jalan, cerminan persis dua cabang RPC delete_transaction (migrasi
 * 20260919000000):
 *  1. transaksi itu dia catat sendiri → `canDeleteOwnTransaction`;
 *  2. ATAU dia OWNER dompet tempat transaksi itu berada — walau baris itu
 *     dicatat orang lain (keputusan 13 Sep 2026, membalik Task 2 #2).
 *
 * Kenapa owner dapat hapus tapi TIDAK dapat edit: menghapus itu operasi
 * pembersihan yang efeknya persis membatalkan baris + mengembalikan saldo,
 * sedangkan mengedit berarti menulis ulang catatan keuangan atas nama orang
 * lain. `canEditTransaction` karena itu sengaja TIDAK ikut dilonggarkan.
 *
 * Pendorong utamanya: transaksi yang penulisnya sudah keluar dari dompet
 * (`wallet_members.status='left'`) dulu terkunci permanen — penulisnya sudah
 * tidak punya akses, dan owner pun ditolak. Cabang 2 mencakup itu tanpa
 * perlu tahu status keanggotaan penulisnya: `role` di sini adalah peran
 * PENGHAPUS, bukan peran pencatat.
 *
 * `debt_id` sengaja TIDAK dicek di sini: baris hutang/piutang milik orang
 * lain tidak pernah masuk state `transactions` (filter `excludeDebt` di
 * `sharedOrFilter`), jadi owner tidak akan pernah melihatnya untuk dihapus.
 * Server tetap menjaganya sebagai lapis kedua.
 *
 * @param {object} tx     transaksi format app (dari useTransactions)
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `role`
 */
export function canDeleteTransaction(tx, userId, accounts = []) {
  if (canDeleteOwnTransaction(tx, userId, accounts)) return true;
  if (!tx || !userId || !tx.wallet_id) return false;
  // `role === 'owner'` diturunkan dari `wallets.user_id` baris dompet itu
  // sendiri (useWallets.toAppWallet), yang dijaga fresh oleh realtime —
  // BUKAN dari `roleById` yang cuma snapshot saat mount. Jadi sinyal owner
  // di sini tidak ikut basi saat peran anggota berubah di tengah sesi.
  const wallet = accounts.find(w => w.id === tx.wallet_id);
  return wallet?.role === 'owner';
}

/**
 * Boleh-tidaknya user MENGUBAH sebuah transaksi dari UI.
 *
 * Syaratnya tetap "hanya baris yang dia catat sendiri" — update_transaction
 * sejak migrasi 20260917000000 mensyaratkan dompet ASAL dan TUJUAN sama-sama
 * bisa ditulis. Dompet tujuan dijaga terpisah oleh modal edit (hanya
 * menawarkan dompet yang bisa ditulis) dan handleUpdateTransaction di app.jsx.
 *
 * SENGAJA tidak memakai `canDeleteTransaction` lagi: sejak owner-override 13
 * Sep 2026 keduanya BERBEDA, dan menyamakannya kembali akan diam-diam memberi
 * owner hak mengedit transaksi anggotanya.
 *
 * @param {object} tx
 * @param {string} userId
 * @param {object[]} accounts dompet format app (dari useWallets), dengan `canWrite`
 */
export function canEditTransaction(tx, userId, accounts = []) {
  return canDeleteOwnTransaction(tx, userId, accounts);
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
