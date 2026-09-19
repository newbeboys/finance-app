/**
 * Helper zona waktu untuk LABEL KOSMETIK (sapaan, nama bulan) dan STATE AWAL
 * date-picker / filter bulan — bukan untuk data yang ditulis ke DB.
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

/**
 * Tanggal "hari ini" di zona waktu `tz`, dipecah jadi bagian-bagiannya.
 *
 * Dipakai sebagai SEED state bulan/tahun (MonthYearPicker, filter bulan), supaya
 * halaman terbuka di bulan menurut timezone tersimpan user, bukan jam perangkat.
 *
 * `month` sengaja 0-indexed — menyamakan konvensi dengan semua state
 * `{ year, month }` yang sudah ada (dan dengan `Date.prototype.getMonth()`).
 *
 * @param {string} tz - IANA time zone, mis. 'Asia/Jakarta'.
 * @returns {{ year: number, month: number, day: number }} month 0-11.
 */
export function todayPartsInTimezone(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day) };
}
