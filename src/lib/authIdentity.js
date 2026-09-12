import { supabase } from '../supabase';
import i18n from '../i18n';

/**
 * Ambil `user_id` yang DIJAMIN cocok dengan JWT yang akan dikirim request ini.
 *
 * ┌─ KENAPA INI ADA ───────────────────────────────────────────────────────┐
 * │ Setiap hook menerima `userId` sebagai prop dari `session.user.id` di    │
 * │ app.jsx, lalu menaruhnya di payload INSERT. Prop itu adalah state React │
 * │ — umurnya bisa berbeda dari token yang benar-benar dilampirkan SDK ke   │
 * │ request (berganti akun di tab lain, sesi di-refresh, dsb). Kalau        │
 * │ keduanya melenceng, RLS menolak dengan:                                 │
 * │     42501 new row violates row-level security policy                    │
 * │ yang tidak menyebut identitas sama sekali dan sangat sulit didiagnosis. │
 * │                                                                         │
 * │ Fungsi ini menghapus kemungkinan itu: identitas diambil dari sumber     │
 * │ yang sama dengan token yang akan dipakai.                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * KENAPA getSession(), BUKAN getUser():
 *   getUser() memanggil jaringan ke /auth/v1/user setiap kali — satu
 *   round-trip tambahan pada SETIAP pencatatan transaksi, jalur tulis paling
 *   sering dipakai di aplikasi ini. getSession() membaca dari storage dan
 *   otomatis me-refresh bila token kedaluwarsa/hampir kedaluwarsa, tanpa
 *   round-trip di jalur normal — dan yang dikembalikannya adalah PERSIS sesi
 *   yang access token-nya akan dilampirkan SDK. Itu tepat yang kita butuhkan.
 *   Validasi ke server bukan tugas fungsi ini: RLS di database yang menjadi
 *   penjaga sesungguhnya, dan akun terhapus sudah ditangani
 *   validateUserStillExists() saat dashboard dibuka.
 *
 * CATATAN: ini HARDENING, bukan perbaikan bug 42501 pembuatan dompet
 * (12 Sep 2026). Bug itu berasal dari policy SELECT `wallets` yang bertabrakan
 * dengan INSERT ... RETURNING, dan sudah ditutup migrasi 20260918010000 di
 * lineage shared-wallet. Jangan mengira fungsi ini menggantikannya.
 *
 * @returns {Promise<{userId: string|null, error: Error|null}>}
 *   Tepat satu dari keduanya terisi. Tidak pernah mengembalikan userId kosong
 *   tanpa error — pemanggil boleh langsung memakai `userId` begitu `error` null.
 */
export async function requireUserId() {
  const { data, error } = await supabase.auth.getSession();

  // getSession() jarang melempar, tapi bisa gagal membaca storage (mode privat,
  // storage diblokir). Diperlakukan sama dengan tidak ada sesi: gagal tertutup.
  if (error) {
    console.error('[authIdentity] getSession FAILED:', error.message);
    return { userId: null, error: new Error(i18n.t('umum.sesiBerakhir')) };
  }

  const userId = data?.session?.user?.id || null;
  if (!userId) {
    // Sesi habis / user sudah logout di tab lain. JANGAN diteruskan dengan
    // userId kosong: payload tanpa user_id akan ditolak RLS sebagai 42501 juga,
    // dan pesannya kembali menyesatkan seperti semula.
    return { userId: null, error: new Error(i18n.t('umum.sesiBerakhir')) };
  }

  return { userId, error: null };
}

/**
 * Varian yang mengembalikan pesan sebagai STRING, bukan Error.
 *
 * Hanya untuk useCustomCategories, yang kontrak lamanya memang
 * `{ error: string|null, category }` — memaksakan objek Error ke sana akan
 * membuat pemanggilnya merender "[object Error]".
 *
 * @returns {Promise<{userId: string|null, error: string|null}>}
 */
export async function requireUserIdAsText() {
  const { userId, error } = await requireUserId();
  return { userId, error: error ? error.message : null };
}
