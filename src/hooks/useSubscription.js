import React from 'react';
import { supabase } from '../supabase';
import { PLAN_LIMITS } from '../lib/planLimits';

// ── Hook status langganan (Basic / Pro) ────────────────────────────
// Mengambil baris user_subscriptions milik user yang login.
//
// Expose: { plan, isPro, billingCycle, expiresAt, loading, limits,
//           refresh, setPlanForTesting }
//
// isPro = true HANYA jika plan === 'pro' DAN (expires_at null ATAU
// expires_at > sekarang). Bila sudah lewat expired → diperlakukan
// sebagai basic di UI (DB tidak diubah otomatis di fase ini).
//
// Saat loading, sengaja fail-closed → limits basic, supaya pembatasan
// tidak bocor sebelum data plan benar-benar termuat.
export function useSubscription(userId) {
  const [row, setRow] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetchRow = React.useCallback(async () => {
    if (!userId) { setRow(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('[useSubscription] fetch error:', error.code, error.message);
    setRow(data || null);
    setLoading(false);
  }, [userId]);

  React.useEffect(() => { fetchRow(); }, [fetchRow]);

  // Realtime: kalau baris langganan user ini berubah (mis. dari device lain
  // atau dari setPlanForTesting), UI ikut update tanpa refresh manual.
  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user_subscriptions:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setRow(null);
          else setRow(payload.new || null);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const plan = row?.plan === 'pro' ? 'pro' : 'basic';
  const expiresAt = row?.expires_at || null;
  const notExpired = !expiresAt || new Date(expiresAt) > new Date();
  const isPro = plan === 'pro' && notExpired;
  const limits = PLAN_LIMITS[isPro ? 'pro' : 'basic'];

  // Ubah plan secara MANUAL untuk testing. Hanya dipanggil dari UI yang
  // dibungkus import.meta.env.DEV (lihat SettingsPage) → otomatis hilang
  // dari build APK production.
  const setPlanForTesting = React.useCallback(async (newPlan) => {
    if (!userId) return { error: 'no user' };
    const now = new Date().toISOString();
    const payload = newPlan === 'pro'
      ? { plan: 'pro', billing_cycle: null, started_at: now, expires_at: null, updated_at: now }
      : { plan: 'basic', billing_cycle: null, started_at: null, expires_at: null, updated_at: now };

    const { error } = await supabase
      .from('user_subscriptions')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      console.error('[useSubscription] setPlanForTesting FAILED:', error.code, error.message);
      return { error };
    }
    await fetchRow();
    return { error: null };
  }, [userId, fetchRow]);

  return {
    plan: isPro ? 'pro' : 'basic',
    isPro,
    billingCycle: row?.billing_cycle || null,
    expiresAt,
    loading,
    limits,
    refresh: fetchRow,
    setPlanForTesting,
  };
}
