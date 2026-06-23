import { supabase } from '../supabase';

const SESSION_EXPIRED_KEY = 'finance_session_expired';
export const SESSION_EXPIRED_MSG = 'Session Anda telah berakhir. Silakan login kembali.';

/**
 * Validates user still exists in Supabase auth by making a server-side call.
 * Returns false only for definitive auth errors (user deleted/not found).
 * Returns true on network errors to avoid false positives that log users out.
 */
export async function validateUserStillExists() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // No HTTP status = network/fetch error — don't logout on network issues
      if (!error.status) return true;
      // HTTP error = auth service responded: user deleted or token invalid
      return false;
    }
    return !!data?.user;
  } catch {
    // Network failure — assume valid to avoid false logout
    return true;
  }
}

/**
 * Signs out the deleted user and stores an expiry message for the login page.
 */
export async function logoutDeletedUser() {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, SESSION_EXPIRED_MSG);
    // Belt-and-suspenders: clear Supabase auth tokens from localStorage
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
    } catch {}
    await supabase.auth.signOut();
  } catch {}
}

/**
 * Reads and clears the expired-session message set by logoutDeletedUser().
 * Call this on the login page to show a one-time notification.
 */
export function getAndClearExpiredMessage() {
  try {
    const msg = sessionStorage.getItem(SESSION_EXPIRED_KEY);
    if (msg) sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return msg || null;
  } catch {
    return null;
  }
}
