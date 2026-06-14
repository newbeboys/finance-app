// ── Penyimpanan PIN aplikasi (lapisan kunci lokal di atas login Supabase) ──
// Key localStorage sesuai spesifikasi. PIN di-encode dengan btoa() — bukan
// hash kriptografis sungguhan, hanya agar tak tersimpan plaintext.
const PIN_KEY = 'appPIN';
const ACTIVE_KEY = 'pinAktif';
const BIO_KEY = 'biometrikAktif';

const hash = (pin) => btoa(String(pin));

export function isPinActive() {
  try { return localStorage.getItem(ACTIVE_KEY) === 'true'; } catch { return false; }
}

export function isBiometricEnabled() {
  try { return localStorage.getItem(BIO_KEY) === 'true'; } catch { return false; }
}

export function verifyPin(pin) {
  try { return !!pin && localStorage.getItem(PIN_KEY) === hash(pin); } catch { return false; }
}

// Simpan PIN baru + aktifkan kunci aplikasi.
// PIN & biometrik saling eksklusif → mengaktifkan PIN otomatis mematikan biometrik.
export function setPin(pin) {
  try {
    localStorage.setItem(PIN_KEY, hash(pin));
    localStorage.setItem(ACTIVE_KEY, 'true');
    localStorage.setItem(BIO_KEY, 'false');
  } catch {}
}

// Aktifkan biometrik sebagai SATU-SATUNYA metode → hapus PIN bila ada.
export function enableBiometricOnly() {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.setItem(ACTIVE_KEY, 'false');
    localStorage.setItem(BIO_KEY, 'true');
  } catch {}
}

export function setBiometric(on) {
  try { localStorage.setItem(BIO_KEY, on ? 'true' : 'false'); } catch {}
}

// Reset penuh — dipakai saat "Lupa PIN" / terlalu banyak percobaan / matikan toggle
export function clearPin() {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.setItem(ACTIVE_KEY, 'false');
    localStorage.setItem(BIO_KEY, 'false');
  } catch {}
}
