// ── Hashing PIN dengan Web Crypto API (SHA-256 + salt acak) ──────────
// Mengganti btoa() yang lama (base64 = mudah di-decode). Hash + salt
// disimpan terpisah; salt acak per-PIN mencegah rainbow table & membuat
// dua PIN sama menghasilkan hash berbeda. Tidak ada cara membalik hash
// menjadi PIN dari isi localStorage.
//
// Catatan: PIN 6 digit tetap punya ruang terbatas (10^6). Salt + SHA-256
// menutup celah "decode langsung"; untuk perlindungan brute-force lebih
// kuat, PBKDF2 dengan banyak iterasi bisa dipertimbangkan di versi depan.

const SALT_BYTES = 16;

const toHex = (buf) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex) =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));

// SHA-256 dari (salt ‖ pin) → string hex.
async function digestHex(saltBytes, pin) {
  const pinBytes = new TextEncoder().encode(String(pin));
  const data = new Uint8Array(saltBytes.length + pinBytes.length);
  data.set(saltBytes, 0);
  data.set(pinBytes, saltBytes.length);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

// Perbandingan waktu-konstan sederhana (cegah timing leak pada panjang sama).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Buat hash baru dari sebuah PIN → { hash, salt } (keduanya hex string).
export async function hashPin(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await digestHex(saltBytes, pin);
  return { hash, salt: toHex(saltBytes) };
}

// Verifikasi PIN terhadap hash + salt tersimpan → boolean.
export async function verifyPin(inputPin, storedHash, storedSalt) {
  if (!inputPin || !storedHash || !storedSalt) return false;
  try {
    const hash = await digestHex(fromHex(storedSalt), inputPin);
    return safeEqual(hash, storedHash);
  } catch {
    return false;
  }
}
