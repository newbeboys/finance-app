import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

// Biometrik hanya berfungsi di perangkat native (APK Android/iOS).
// Di browser/localhost selalu mengembalikan false — itu normal & disengaja.
export async function isBiometricAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await BiometricAuth.checkBiometry();
    return !!result.isAvailable;
  } catch {
    return false;
  }
}

// Memunculkan prompt sidik jari. Resolve true bila sukses,
// false bila gagal/dibatalkan (→ fallback ke input PIN manual).
export async function authenticateBiometric() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await BiometricAuth.authenticate({
      reason: 'Verifikasi identitas untuk membuka FinanceApp',
      cancelTitle: 'Gunakan PIN',
      androidTitle: 'FinanceApp',
      androidSubtitle: 'Buka dengan sidik jari',
    });
    return true;
  } catch {
    return false;
  }
}
