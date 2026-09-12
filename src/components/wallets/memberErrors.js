/**
 * Pemetaan `reason` dari useWalletMembers → kunci pesan i18n (keputusan Q6).
 *
 * Satu tabel dipakai ketiga komponen dompet bersama. Sengaja dipusatkan, bukan
 * disalin per komponen: kalau tiap sheet memetakan sendiri, `rate_limited` di
 * satu tempat gampang berbunyi "coba lagi nanti" sementara di tempat lain
 * "terjadi kesalahan" — dan Q6 justru meminta tiap kegagalan punya pesan yang
 * jelas dan konsisten, bukan "kesalahan" generik.
 *
 * Semua `reason` yang bisa muncul HARUS ada di sini. Yang tidak dikenal jatuh
 * ke `unknown` — aman, tapi berarti ada jalur yang belum diberi pesan sendiri.
 */
const KEYS = {
  // Ditolak di klien sebelum RPC dipanggil, supaya tebakan yang jelas salah
  // tidak menghabiskan jatah rate limit user sendiri.
  invalid_format:  'dompetBersama.err.formatKode',

  // Balasan jsonb accept_wallet_invite.
  invalid_code:    'dompetBersama.err.kodeTidakValid',
  already_member:  'dompetBersama.err.sudahAnggota',
  own_wallet:      'dompetBersama.err.dompetSendiri',
  rate_limited:    'dompetBersama.err.terlaluSering',

  // Diterjemahkan dari RPC yang masih RAISE (generate/leave/remove).
  not_pro:         'dompetBersama.err.khususPro',
  not_owner:       'dompetBersama.err.bukanOwner',
  not_member:      'dompetBersama.err.bukanAnggota',
  member_gone:     'dompetBersama.err.anggotaSudahKeluar',
  no_access:       'dompetBersama.err.tidakPunyaAkses',
  no_session:      'dompetBersama.err.sesiBerakhir',

  unknown:         'dompetBersama.err.takDikenal',
};

export function memberErrorKey(reason) {
  return KEYS[reason] || KEYS.unknown;
}

/**
 * Sisa menit sampai `isoTimestamp`, minimal 1.
 *
 * Dipakai hanya untuk MENAMPILKAN sisa waktu lockout (`reset_at` dari
 * accept_wallet_invite). Jangan dipakai untuk memutuskan boleh-tidaknya
 * mencoba lagi: jendela rate limit ditentukan server, dan jam perangkat bisa
 * meleset. Tombolnya tetap hidup — server yang menolak kalau memang belum
 * waktunya.
 */
export function minutesUntil(isoTimestamp) {
  if (!isoTimestamp) return null;
  const ms = new Date(isoTimestamp).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(1, Math.ceil(ms / 60000));
}
