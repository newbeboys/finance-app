import { supabase } from '../supabase';

// ── Error logging terpusat (sisi client) ───────────────────────────────
// logError() menulis SATU baris ke tabel error_logs lewat RPC SECURITY DEFINER
// `log_error` (lihat migration 20260706000000_add_error_logs.sql). RPC dipilih
// karena user TIDAK punya izin INSERT langsung ke error_logs — penulisan hanya
// boleh lewat RPC (client) atau service_role (server/Edge Function).
//
// PRINSIP PENTING: fungsi ini TIDAK BOLEH menghentikan alur utama aplikasi.
// - Hanya dipanggil untuk error PENTING (uang / data permanen), bukan error UI.
// - Kalau menulis ke Supabase gagal (mis. user offline) ATAU logError sendiri
//   melempar exception, semuanya ditangkap di sini dan jatuh ke console.error.
//   Pemanggil TIDAK perlu meng-await hasilnya dan tidak akan pernah menerima throw.
//
// Parameter:
//   source   : string  — nama fungsi/modul asal error ('adjustBalance', 'debts', …)
//   message  : string  — pesan error asli dari catch block
//   metadata : object? — data tambahan relevan (wallet_id, debt_id, kode error, …)
//   severity : 'high' | 'medium' (default 'medium')
export async function logError(source, message, metadata = null, severity = 'medium') {
  try {
    const { error } = await supabase.rpc('log_error', {
      p_source:   String(source ?? 'unknown').slice(0, 200),
      p_message:  String(message ?? '').slice(0, 2000),
      p_metadata: metadata ?? null,
      p_severity: severity === 'high' ? 'high' : 'medium',
    });

    // Gagal menulis (offline, RLS, dll) → jangan lempar; cukup catat ke console
    // supaya error asli tetap terlihat saat debugging dan alur utama jalan terus.
    if (error) {
      console.error('[logError] gagal menulis error_logs:', error.message,
        '| source:', source, '| message:', message, '| metadata:', metadata);
    }
  } catch (e) {
    // Sabuk pengaman terakhir: logError TIDAK BOLEH bikin app crash.
    console.error('[logError] exception saat logging (diabaikan):', e?.message || e,
      '| source:', source, '| message:', message, '| metadata:', metadata);
  }
}

export default logError;
