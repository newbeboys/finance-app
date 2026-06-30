import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

// Module-level state: SDK configure hanya 1x per sesi app.
let sdkConfigured = false;
let configuredUserId = null;

function isUserCancelledError(err) {
  const code = err?.code;
  return (
    code === 'PURCHASE_CANCELLED_ERROR' ||
    code === 'purchaseCancelled' ||
    code === 1 ||
    err?.userCancelled === true ||
    String(err?.message).toLowerCase().includes('cancel')
  );
}

// ── useRevenueCat ──────────────────────────────────────────────────────
// Kelola siklus hidup RevenueCat SDK untuk platform Android.
// Di web / iOS hook ini no-op dan return state default.
//
// Expose:
//   isInitialized  boolean  — SDK sudah siap (logIn berhasil)
//   isProActive    boolean  — entitlement "pro" aktif menurut RC
//   error          string|null
//   getOfferings() → Promise<Offerings>
//   purchasePackage(pkg) → Promise<CustomerInfo | null>  (null = user batal)
//   restorePurchases() → Promise<CustomerInfo>
//   getCustomerInfo() → Promise<CustomerInfo>
export function useRevenueCat(userId) {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isProActive, setIsProActive] = React.useState(false);
  const [error, setError] = React.useState(null);

  const isAndroid = Capacitor.getPlatform() === 'android';

  // ── Inisialisasi & login ────────────────────────────────────────────
  React.useEffect(() => {
    if (!isAndroid) {
      setIsInitialized(true);
      return;
    }

    const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;
    if (!apiKey) {
      setError('REVENUECAT_API_KEY_ANDROID tidak ditemukan di environment');
      return;
    }
    if (!userId) return;

    let cancelled = false;

    const init = async () => {
      try {
        if (!sdkConfigured) {
          await Purchases.configure({ apiKey });
          sdkConfigured = true;
        }

        if (userId !== configuredUserId) {
          await Purchases.logIn({ appUserID: userId });
          configuredUserId = userId;
        }

        if (cancelled) return;
        setIsInitialized(true);

        const { customerInfo } = await Purchases.getCustomerInfo();
        if (!cancelled) {
          setIsProActive(customerInfo.entitlements.active['pro'] !== undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'RevenueCat initialization failed');
          console.error('[useRevenueCat] init error:', err);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [isAndroid, userId]);

  // ── Logout saat user keluar ─────────────────────────────────────────
  React.useEffect(() => {
    if (isAndroid && sdkConfigured && !userId) {
      Purchases.logOut().catch(() => {});
      configuredUserId = null;
      setIsProActive(false);
      setIsInitialized(false);
    }
  }, [isAndroid, userId]);

  // ── Public API ──────────────────────────────────────────────────────

  const getOfferings = React.useCallback(async () => {
    if (!isAndroid) return null;
    const { offerings } = await Purchases.getOfferings();
    return offerings;
  }, [isAndroid]);

  // Mengembalikan CustomerInfo jika berhasil, atau null jika user membatalkan.
  // Melempar error untuk kasus lain (network error, dll).
  const purchasePackage = React.useCallback(async (pkg) => {
    if (!isAndroid) throw new Error('Purchase hanya tersedia di Android');
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const active = customerInfo.entitlements.active['pro'] !== undefined;
      setIsProActive(active);
      return customerInfo;
    } catch (err) {
      if (isUserCancelledError(err)) return null; // user batal → bukan error
      throw err;
    }
  }, [isAndroid]);

  const restorePurchases = React.useCallback(async () => {
    if (!isAndroid) throw new Error('Restore hanya tersedia di Android');
    const { customerInfo } = await Purchases.restorePurchases();
    const active = customerInfo.entitlements.active['pro'] !== undefined;
    setIsProActive(active);
    return customerInfo;
  }, [isAndroid]);

  const getCustomerInfo = React.useCallback(async () => {
    if (!isAndroid) return null;
    const { customerInfo } = await Purchases.getCustomerInfo();
    const active = customerInfo.entitlements.active['pro'] !== undefined;
    setIsProActive(active);
    return customerInfo;
  }, [isAndroid]);

  return {
    isInitialized,
    isProActive,
    error,
    getOfferings,
    purchasePackage,
    restorePurchases,
    getCustomerInfo,
  };
}
