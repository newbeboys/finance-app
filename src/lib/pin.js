// ── Penyimpanan PIN aplikasi (lapisan kunci lokal di atas login Supabase) ──
// PIN di-hash dengan SHA-256 + salt acak (lihat utils/pinHash.js) — tidak
// lagi pakai btoa() yang mudah di-decode. Hash & salt disimpan terpisah.
import { hashPin, verifyPin as verifyPinHash } from '../utils/pinHash';

const PIN_KEY = 'appPIN';
const SALT_KEY = 'appPIN_salt';
const ACTIVE_KEY = 'pinAktif';
const BIO_KEY = 'biometrikAktif';

// Encode lama (btoa) — hanya dipakai untuk migrasi PIN yang sudah terpasang
// sebelum update ini, lalu di-upgrade ke hash ber-salt saat verifikasi pertama.
const legacyEncode = (pin) => { try { return btoa(String(pin)); } catch { return null; } };

export function isPinActive() {
  try { return localStorage.getItem(ACTIVE_KEY) === 'true'; } catch { return false; }
}

export function isBiometricEnabled() {
  try { return localStorage.getItem(BIO_KEY) === 'true'; } catch { return false; }
}

// Verifikasi PIN (async — hashing pakai Web Crypto).
export async function verifyPin(pin) {
  if (!pin) return false;
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    const salt = localStorage.getItem(SALT_KEY);
    if (salt) return await verifyPinHash(pin, stored, salt);
    // ── Migrasi PIN lama (btoa, tanpa salt) ──
    // Cocok → upgrade ke hash ber-salt agar tak bisa di-decode lagi.
    if (stored === legacyEncode(pin)) {
      await setPin(pin);
      return true;
    }
    return false;
  } catch { return false; }
}

// Simpan PIN baru + aktifkan kunci aplikasi (async — hashing pakai Web Crypto).
// PIN & biometrik saling eksklusif → mengaktifkan PIN otomatis mematikan biometrik.
export async function setPin(pin) {
  try {
    const { hash, salt } = await hashPin(pin);
    localStorage.setItem(PIN_KEY, hash);
    localStorage.setItem(SALT_KEY, salt);
    localStorage.setItem(ACTIVE_KEY, 'true');
    localStorage.setItem(BIO_KEY, 'false');
  } catch {}
}

// Aktifkan biometrik sebagai SATU-SATUNYA metode → hapus PIN bila ada.
export function enableBiometricOnly() {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(SALT_KEY);
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
    localStorage.removeItem(SALT_KEY);
    localStorage.setItem(ACTIVE_KEY, 'false');
    localStorage.setItem(BIO_KEY, 'false');
  } catch {}
}
