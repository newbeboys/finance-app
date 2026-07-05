import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Event types yang menandakan entitlement aktif
const ACTIVE_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
]);

// Event types yang menandakan entitlement sudah tidak aktif
const INACTIVE_EVENT_TYPES = new Set([
  'EXPIRATION',
]);

// ── Error logging sisi server ───────────────────────────────────────
// Tulis satu baris ke error_logs pakai service_role (bypass RLS) — bukan lewat
// RPC client. Dibungkus try-catch sendiri: kegagalan logging TIDAK boleh
// mengubah alur/response webhook. app_user_id disimpan di metadata (bukan kolom
// user_id) agar tidak melanggar FK bila app_user_id ternyata bukan UUID auth.users.
async function logServerError(
  source: string,
  message: string,
  metadata: Record<string, unknown> | null,
  severity: 'high' | 'medium' = 'medium',
) {
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await admin.from('error_logs').insert({
      source,
      message,
      metadata,
      severity,
    });
  } catch (e) {
    console.error('[revenuecat-webhook] logServerError gagal (diabaikan):', e);
  }
}

serve(async (req) => {
  // Hanya terima POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verifikasi shared secret dari RevenueCat
  const authHeader = req.headers.get('Authorization') ?? '';
  const expectedAuth = `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? ''}`;
  if (!authHeader || authHeader !== expectedAuth) {
    console.error('[revenuecat-webhook] Unauthorized request');
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    // Parsing event RC gagal → catat (medium: kemungkinan request rusak/bukan RC).
    await logServerError('revenuecat-webhook', 'Invalid JSON body', null, 'medium');
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const event = body?.event as Record<string, unknown> | undefined;
  if (!event) {
    await logServerError('revenuecat-webhook', 'Missing event in body',
      { bodyKeys: Object.keys(body ?? {}) }, 'medium');
    return new Response('Bad Request: missing event', { status: 400 });
  }

  const eventType = String(event.type ?? '');
  const appUserId = String(event.app_user_id ?? '');
  const productId = event.product_id ? String(event.product_id) : null;
  const expirationAtMs = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
  const purchasedAtMs = typeof event.purchased_at_ms === 'number' ? event.purchased_at_ms : null;
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? (event.entitlement_ids as string[])
    : [];

  console.log(`[revenuecat-webhook] event=${eventType} user=${appUserId} product=${productId}`);

  if (!appUserId) {
    return new Response('Bad Request: missing app_user_id', { status: 400 });
  }

  // Supabase service role client — bypass RLS untuk update webhook
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Tentukan is_active dari event type + expiration time
  let isActive: boolean;
  if (ACTIVE_EVENT_TYPES.has(eventType)) {
    isActive = true;
  } else if (INACTIVE_EVENT_TYPES.has(eventType)) {
    isActive = false;
  } else if (eventType === 'CANCELLATION') {
    // User batal tapi masih berhak akses sampai expires_at
    isActive = expirationAtMs !== null && expirationAtMs > Date.now();
  } else if (eventType === 'BILLING_ISSUE') {
    // Tagihan bermasalah — anggap tidak aktif (konservatif)
    isActive = false;
  } else {
    // Event tidak dikenal — log dan return 200 tanpa update
    console.log(`[revenuecat-webhook] event type tidak ditangani: ${eventType}`);
    return new Response('OK', { status: 200 });
  }

  const expiresAt = expirationAtMs ? new Date(expirationAtMs).toISOString() : null;
  const originalPurchaseAt = purchasedAtMs ? new Date(purchasedAtMs).toISOString() : null;
  const now = new Date().toISOString();

  // Cari user berdasarkan revenuecat_app_user_id atau user_id (RC memakai Supabase UUID)
  // app_user_id di RC = Supabase user UUID (di-set saat Purchases.logIn)
  const updates = {
    plan: isActive ? 'pro' : 'basic',
    billing_cycle: null as string | null,
    expires_at: isActive ? expiresAt : null,
    revenuecat_app_user_id: appUserId,
    product_id: productId,
    original_purchase_at: originalPurchaseAt ?? undefined,
    latest_event_type: eventType,
    latest_event_at: now,
    raw_event: event,
    updated_at: now,
  };

  // Coba update berdasarkan user_id langsung (app_user_id adalah Supabase UUID)
  const { error } = await supabase
    .from('user_subscriptions')
    .update(updates)
    .eq('user_id', appUserId);

  if (error) {
    console.error('[revenuecat-webhook] DB update error:', error.code, error.message);
    // Gagal update langganan = user bayar tapi status tak terupdate → high.
    await logServerError('revenuecat-webhook', error.message,
      { stage: 'update_user_subscriptions', app_user_id: appUserId, event_type: eventType, code: error.code },
      'high');
    return new Response('Internal Server Error', { status: 500 });
  }

  // Kalau yang di-update 0 baris (user belum punya baris), buat baris baru
  // Ini dapat terjadi kalau trigger signup belum jalan atau user baru
  const { count } = await supabase
    .from('user_subscriptions')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', appUserId);

  if (count === 0) {
    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({ user_id: appUserId, ...updates });
    if (insertError) {
      console.error('[revenuecat-webhook] insert error:', insertError.code, insertError.message);
      await logServerError('revenuecat-webhook', insertError.message,
        { stage: 'insert_user_subscriptions', app_user_id: appUserId, event_type: eventType, code: insertError.code },
        'high');
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  console.log(`[revenuecat-webhook] OK — user ${appUserId} plan=${updates.plan} active=${isActive}`);
  return new Response('OK', { status: 200 });
});
