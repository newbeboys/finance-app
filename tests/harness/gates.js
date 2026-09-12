// Entry harness gerbang izin transaksi (owner-delete, 13 Sep 2026).
//
// Mengekspos fungsi ASLI dari src/lib/walletAccess.js ke window supaya bisa
// dipanggil langsung dari Playwright. Lewat vite (bukan node biasa) karena
// walletAccess.js mengimpor '../supabase' — di vite.config.js harness, import
// itu dialihkan ke supabase-stub.js, jadi tidak ada klien Supabase sungguhan
// yang dibuat dan tidak ada env var yang dibutuhkan.
//
// Ketiganya fungsi murni: tidak ada state, tidak ada jaringan. Yang diuji di
// sini murni KEPUTUSAN IZIN di sisi klien. Penegakan sebenarnya ada di RPC
// delete_transaction + policy RLS (migrasi 20260919000000), yang TIDAK
// tercakup harness ini — lihat catatan di tests/owner-delete.harness.mjs.
import {
  canDeleteTransaction,
  canDeleteOwnTransaction,
  canEditTransaction,
  sharedOrFilter,
} from '../../src/lib/walletAccess';

window.__gates = { canDeleteTransaction, canDeleteOwnTransaction, canEditTransaction, sharedOrFilter };
document.body.insertAdjacentHTML('beforeend', '<div id="ready">ready</div>');
