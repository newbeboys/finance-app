/**
 * Helper zona waktu untuk LABEL KOSMETIK (sapaan, nama bulan) — bukan untuk
 * data yang ditulis ke DB.
 *
 * Sumber kebenarannya adalah timezone TERSIMPAN milik user
 * (`user_subscriptions.timezone`, di-expose lewat `useSubscription().timezone`),
 * BUKAN jam perangkat. Jadi user yang jamnya diubah / sedang bepergian tetap
 * melihat label sesuai zona waktu yang dia simpan.
 *
 * Fallback 'Asia/Jakarta' sengaja TIDAK ditaruh di dalam fungsi ini — pemanggil
 * yang menyediakannya (lewat default prop `timezone = 'Asia/Jakarta'`), supaya
 * label tetap aman selama data subscription masih loading.
 */

/**
 * Jam sekarang (0–23) di zona waktu `tz`.
 * @param {string} tz - IANA time zone, mis. 'Asia/Jakarta'.
 * @returns {number} Jam dalam format 24 jam.
 */
export function hourInTimezone(tz) {
  return Number(new Date().toLocaleString('en-US', {
    hour: 'numeric', hourCycle: 'h23', timeZone: tz,
  }));
}
